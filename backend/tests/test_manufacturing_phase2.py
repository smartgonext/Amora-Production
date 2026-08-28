import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.tenant import Tenant, Company
from app.models.product import Product, ProductCategory, Warehouse
from app.models.manufacturing import (
    MaterialRequirementPlan, WorkOrder,
    QualityInspection, JobWorkOrder,
)
from app.models.customer import Supplier
from app.models.manufacturing import SupplierItemMapping, WorkCenter
from app.services.manufacturing_service import (
    create_bom, get_active_bom_for_product, compute_bom_costs, run_mrp,
    create_work_order, release_work_order, complete_operation,
    production_receipt, generate_purchase_orders,
)


@pytest.fixture
def app():
    app = create_app('test')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def seed(app):
    with app.app_context():
        t = Tenant(name='Mfg Tenant', subdomain='mfgtenant')
        db.session.add(t); db.session.flush()
        c = Company(tenant_id=t.id, name='Mfg Co')
        db.session.add(c); db.session.flush()
        cat = ProductCategory(tenant_id=t.id, name='Cat')
        db.session.add(cat); db.session.flush()
        raw = Product(tenant_id=t.id, category_id=cat.id, name='Steel',
                      purchase_price=100, current_stock=50)
        fin = Product(tenant_id=t.id, category_id=cat.id, name='Chair',
                      is_batch_tracked=True)
        db.session.add_all([raw, fin]); db.session.flush()
        wh = Warehouse(tenant_id=t.id, company_id=c.id, name='Main WH')
        wc = WorkCenter(tenant_id=t.id, name='Assembly',
                        hourly_labor_rate=50, hourly_machine_rate=30)
        db.session.add_all([wh, wc]); db.session.flush()
        sup = Supplier(tenant_id=t.id, name='Steel Co', phone='100')
        db.session.add(sup); db.session.flush()
        sim = SupplierItemMapping(
            tenant_id=t.id, supplier_id=sup.id, item_id=raw.id,
            unit_price=100, min_order_qty=0, is_preferred_supplier=True,
        )
        db.session.add(sim); db.session.flush()
        yield {
            'tenant': t, 'company': c, 'raw': raw, 'fin': fin,
            'wh': wh, 'wc': wc, 'supplier': sup,
        }


def _bom_payload(seed, include_routing=True):
    payload = {
        'name': 'Chair BOM', 'product_id': seed['fin'].id, 'standard_cost': 150,
        'status': 'active',
        'items': [{'item_id': seed['raw'].id, 'qty_required': 2, 'uom': 'Pcs'}],
    }
    if include_routing:
        payload['routing_operations'] = [
            {'operation_sequence': 10, 'operation_name': 'Assemble',
             'work_center_id': seed['wc'].id},
        ]
    return payload


def test_bom_create_and_costs(seed):
    bom = create_bom(seed['tenant'].id, seed['company'].id, _bom_payload(seed))
    assert bom.id is not None
    assert bom.version == 'V1.0'
    costs = compute_bom_costs(bom)
    assert costs['material_cost'] == 200
    assert costs['total_cost'] > 0
    active = get_active_bom_for_product(seed['tenant'].id, seed['fin'].id)
    assert active is not None and active.id == bom.id


def test_work_order_lifecycle_and_mrp(seed):
    bom = create_bom(seed['tenant'].id, seed['company'].id, _bom_payload(seed))
    wo = create_work_order(seed['tenant'].id, seed['company'].id,
                           {'bom_id': bom.id, 'planned_qty': 10})
    assert wo.status == 'planned'
    assert wo.wo_number.startswith('WO-')

    summary = run_mrp(seed['tenant'].id, work_order=wo)
    assert len(summary) == 1
    assert summary[0]['required_qty'] == 20
    assert summary[0]['shortage_qty'] == 0

    wo = release_work_order(wo, warehouse_id=seed['wh'].id, company_id=seed['company'].id)
    assert wo.status == 'wip'
    assert wo.operations.count() == 1
    assert seed['raw'].current_stock == 30

    op = wo.operations.first()
    op, cost = complete_operation(op, {'actual_setup_time': 10, 'actual_run_time': 30})
    assert op.status == 'completed'
    assert abs(cost['total_hours'] - 40 / 60) < 1e-6

    wo, batch, serials = production_receipt(
        wo, warehouse_id=seed['wh'].id, company_id=seed['company'].id, produced_qty=10)
    assert wo.status == 'qc_pending'
    assert wo.produced_qty == 10
    assert batch is not None and batch.batch_no.startswith('BATCH-')


def test_mrp_shortage_and_auto_po_generation(seed):
    seed['raw'].current_stock = 0
    db.session.commit()
    bom = create_bom(seed['tenant'].id, seed['company'].id, _bom_payload(seed, include_routing=False))
    wo = create_work_order(seed['tenant'].id, seed['company'].id,
                           {'bom_id': bom.id, 'planned_qty': 10})
    summary = run_mrp(seed['tenant'].id, work_order=wo)
    assert summary[0]['shortage_qty'] == 20
    assert summary[0]['suggested_po_qty'] == 20
    assert summary[0]['supplier_id'] == seed['supplier'].id

    pos = generate_purchase_orders(seed['tenant'].id, seed['company'].id)
    assert len(pos) == 1
    assert pos[0].supplier_id == seed['supplier'].id
    plans = MaterialRequirementPlan.query.filter_by(status='po_generated').all()
    assert len(plans) == 1


def test_qc_and_job_work_models(app):
    with app.app_context():
        t = Tenant(name='Q', subdomain='q')
        db.session.add(t); db.session.flush()
        c = Company(tenant_id=t.id, name='C')
        db.session.add(c); db.session.flush()
        sup = Supplier(tenant_id=t.id, name='Vendor', phone='2')
        db.session.add(sup); db.session.flush()
        wo = WorkOrder(tenant_id=t.id, company_id=c.id, wo_number='WO-0001',
                       planned_qty=5, status='planned')
        db.session.add(wo); db.session.flush()
        qc = QualityInspection(
            tenant_id=t.id, reference_type='work_order', reference_id=wo.id,
            passed_qty=4, failed_qty=1, qc_status='conditional',
            check_parameters=[{'name': 'weight', 'standard': '1kg', 'actual': '0.98kg', 'result': 'ok'}],
        )
        jw = JobWorkOrder(
            tenant_id=t.id, work_order_id=wo.id, vendor_id=sup.id,
            issue_challan_no='CH-001', materials_sent=[{'item_id': 1, 'qty': 2}],
            status='sent',
        )
        db.session.add_all([qc, jw]); db.session.commit()
        assert qc.id is not None and jw.id is not None
        assert jw.status == 'sent'



# --- HTTP API integration tests ---

from app.models.tenant import Branch  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.product import ProductCategory as _Cat  # noqa: E402


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    with client.application.app_context():
        t = Tenant(name='Api Tenant', subdomain='apitenant', db_status='active', is_active=True)
        db.session.add(t); db.session.flush()
        c = Company(tenant_id=t.id, name='Api Co'); db.session.add(c); db.session.flush()
        b = Branch(tenant_id=t.id, company_id=c.id, name='Main', code='MAIN', is_main=True)
        db.session.add(b); db.session.flush()
        u = User(tenant_id=t.id, company_id=c.id, branch_id=b.id, name='Admin', email='apitest@test.com')
        u.set_password('password123'); db.session.add(u); db.session.commit()
        ids = (t.id, c.id)
    res = client.post('/api/v1/auth/login', json={'email': 'apitest@test.com', 'password': 'password123'})
    token = res.json['data']['tokens']['access_token']
    return {'headers': {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
            'tenant_id': ids[0], 'company_id': ids[1]}


def test_manufacturing_api_full_flow(client, auth_headers):
    h = auth_headers['headers']
    # 1. Config
    r = client.post('/api/v1/manufacturing/config', json={'mfg_type': 'discrete', 'enabled_features': ['routing']}, headers=h)
    assert r.status_code == 200 and r.json['data']['mfg_type'] == 'discrete'
    # 2. Work center
    r = client.post('/api/v1/manufacturing/work-centers', json={'name': 'Assembly', 'hourly_labor_rate': 50, 'hourly_machine_rate': 30}, headers=h)
    assert r.status_code == 201; wc_id = r.json['data']['id']
    # 3. Products + supplier (in db context)
    with client.application.app_context():
        cat = _Cat(tenant_id=auth_headers['tenant_id'], name='Cat'); db.session.add(cat); db.session.flush()
        raw = Product(tenant_id=auth_headers['tenant_id'], category_id=cat.id, name='Steel', purchase_price=100, current_stock=50)
        fin = Product(tenant_id=auth_headers['tenant_id'], category_id=cat.id, name='Chair', is_batch_tracked=True)
        db.session.add_all([raw, fin]); db.session.flush()
        sup = Supplier(tenant_id=auth_headers['tenant_id'], name='Sup', phone='1')
        db.session.add(sup); db.session.flush()
        db.session.commit()
        raw_id, fin_id, sup_id = raw.id, fin.id, sup.id
    # 4. Supplier-item mapping
    r = client.post('/api/v1/manufacturing/supplier-item-mappings', json={'supplier_id': sup_id, 'item_id': raw_id, 'unit_price': 100, 'min_order_qty': 0, 'is_preferred_supplier': True}, headers=h)
    assert r.status_code == 201
    # 5. BOM
    r = client.post('/api/v1/manufacturing/boms', json={'name': 'Chair BOM', 'product_id': fin_id, 'status': 'active', 'standard_cost': 150, 'routing_operations': [{'operation_sequence': 10, 'operation_name': 'Assemble', 'work_center_id': wc_id}], 'items': [{'item_id': raw_id, 'qty_required': 2, 'uom': 'Pcs'}]}, headers=h)
    assert r.status_code == 201; bom_id = r.json['data']['id']
    r = client.get(f'/api/v1/manufacturing/boms/{bom_id}', headers=h)
    assert r.status_code == 200 and r.json['data']['cost_breakup']['material_cost'] == 200
    # 6. Work order
    r = client.post('/api/v1/manufacturing/work-orders', json={'bom_id': bom_id, 'planned_qty': 10}, headers=h)
    assert r.status_code == 201; wo_id = r.json['data']['id']
    # 7. MRP
    r = client.post('/api/v1/manufacturing/mrp/run', json={'work_order_id': wo_id}, headers=h)
    assert r.status_code == 200 and len(r.json['data']) == 1
    r = client.get('/api/v1/manufacturing/mrp', headers=h)
    assert r.status_code == 200 and r.json['meta']['count'] == 1
    # 8. Release -> start -> complete operation
    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/release', json={}, headers=h)
    assert r.status_code == 200 and r.json['data']['status'] == 'wip'
    ops = r.json['data']['operations']; op_id = ops[0]['id']
    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/start-operation', json={'operation_id': op_id}, headers=h)
    assert r.status_code == 200 and r.json['data']['status'] == 'in_progress'
    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/complete-operation', json={'operation_id': op_id, 'actual_setup_time': 10, 'actual_run_time': 30}, headers=h)
    assert r.status_code == 200 and r.json['data']['status'] == 'completed'
    # 9. Receipt
    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/receipt', json={'produced_qty': 10}, headers=h)
    assert r.status_code == 200 and r.json['data']['status'] == 'qc_pending'
    assert r.json['data']['generated_batch'] is not None
    assert r.json['data']['produced_qty'] == 10
    # 10. QC inspection -> moves work order to completed
    r = client.post('/api/v1/manufacturing/qc/inspections', json={'reference_type': 'work_order', 'reference_id': wo_id, 'passed_qty': 10, 'failed_qty': 0, 'qc_status': 'passed'}, headers=h)
    assert r.status_code == 201
    # 11. Job work order
    r = client.post('/api/v1/manufacturing/job-orders', json={'work_order_id': wo_id, 'vendor_id': sup_id, 'issue_challan_no': 'CH-001', 'materials_sent': [{'item_id': raw_id, 'qty': 2}]}, headers=h)
    assert r.status_code == 201 and r.json['data']['status'] == 'sent'
    jw_id = r.json['data']['id']
    r = client.post(f'/api/v1/manufacturing/job-orders/{jw_id}/receive', json={'received_units': 1}, headers=h)
    assert r.status_code == 200 and r.json['data']['status'] == 'completed'
    # Job order completed status persists (status field is an id, not status text)
    assert r.json['data']['id'] == jw_id


