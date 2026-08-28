"""Phase 5 - Step 5.1: End-to-End Manufacturing API tests.

Covers the full workflow requested in the plan:
  1. BOM creation
  2. MRP auto-PO generation
  3. Work Order release
  4. WIP operation completion
  5. Final production stock update & receipt

Uses the live API (register -> config -> BOM -> WO -> MRP -> release -> ops
-> receipt) against the configured database, matching the codebase test setup.
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.tenant import Tenant, Company, Branch
from app.models.user import User
from app.models.product import Product, ProductCategory, Warehouse
from app.models.customer import Supplier
from app.models.manufacturing import MaterialRequirementPlan, SupplierItemMapping, WorkCenter


@pytest.fixture
def app():
    app = create_app('test')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def _register_and_login(client, business_type):
    sub = business_type.lower().replace(' ', '') + 'e2e'
    email = f'{sub}@test.com'
    r = client.post('/api/v1/auth/register', json={
        'company_name': f'{business_type} Co', 'subdomain': sub, 'email': email,
        'password': 'password123', 'admin_name': 'Admin', 'business_type': business_type,
    })
    assert r.status_code in (200, 201), r.get_data(as_text=True)
    login = client.post('/api/v1/auth/login', json={'email': email, 'password': 'password123'})
    token = login.json['data']['tokens']['access_token']
    return {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}


def _create_products(client, h, tenant_id, fin_batch=False):
    with client.application.app_context():
        cat = ProductCategory(tenant_id=tenant_id, name='Cat'); db.session.add(cat); db.session.flush()
        raw = Product(tenant_id=tenant_id, category_id=cat.id, name='Raw Material', purchase_price=100, current_stock=50)
        fin = Product(tenant_id=tenant_id, category_id=cat.id, name='Finished Item', is_batch_tracked=fin_batch)
        db.session.add_all([raw, fin]); db.session.flush()
        sup = Supplier(tenant_id=tenant_id, name='Raw Supplier', phone='100')
        db.session.add(sup); db.session.flush()
        db.session.commit()
        return raw.id, fin.id, sup.id


def _setup_bom(client, h, fin_id, raw_id, wc_id, stock_ok=True):
    payload = {
        'name': 'E2E BOM', 'product_id': fin_id, 'status': 'active', 'standard_cost': 150,
        'routing_operations': [{'operation_sequence': 10, 'operation_name': 'Assemble', 'work_center_id': wc_id}],
        'items': [{'item_id': raw_id, 'qty_required': 2, 'uom': 'Pcs'}],
    }
    r = client.post('/api/v1/manufacturing/boms', json=payload, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    return r.json['data']['id']

def test_discrete_e2e_full_flow(client):
    """Discrete (Furniture/Electronics) end-to-end: BOM -> WO -> MRP -> release
    -> operations -> production receipt, asserting stock updates at each stage."""
    h = _register_and_login(client, 'Manufacturing Unit')

    # 1. BOM creation
    r = client.post('/api/v1/manufacturing/work-centers', json={'name': 'Assembly', 'hourly_labor_rate': 50, 'hourly_machine_rate': 30}, headers=h)
    assert r.status_code == 201
    wc_id = r.json['data']['id']

    tenant = Tenant.query.filter_by(subdomain='manufacturingunite2e').first()
    raw_id, fin_id, sup_id = _create_products(client, h, tenant.id)
    r = client.post('/api/v1/manufacturing/supplier-item-mappings', json={'supplier_id': sup_id, 'item_id': raw_id, 'unit_price': 100, 'min_order_qty': 0, 'is_preferred_supplier': True}, headers=h)
    assert r.status_code == 201

    bom_id = _setup_bom(client, h, fin_id, raw_id, wc_id)
    r = client.get(f'/api/v1/manufacturing/boms/{bom_id}', headers=h)
    assert r.status_code == 200
    assert r.json['data']['cost_breakup']['material_cost'] == 200  # 2 x 100
    assert len(r.json['data']['routing_operations']) == 1

    # 2. Work Order
    r = client.post('/api/v1/manufacturing/work-orders', json={'bom_id': bom_id, 'planned_qty': 10}, headers=h)
    assert r.status_code == 201
    wo_id = r.json['data']['id']

    # 3. MRP run -> requirement 20, no shortage (stock 50)
    r = client.post('/api/v1/manufacturing/mrp/run', json={'work_order_id': wo_id}, headers=h)
    assert r.status_code == 200
    assert r.json['data'][0]['required_qty'] == 20
    assert r.json['data'][0]['shortage_qty'] == 0

    # 4. Release to WIP: generates routing sheet + issues material (stock 50 -> 30)
    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/release', json={}, headers=h)
    assert r.status_code == 200 and r.json['data']['status'] == 'wip'
    assert len(r.json['data']['operations']) == 1
    raw_product = Product.query.get(raw_id)
    assert raw_product.current_stock == 30

    # 5. WIP operation completion (start + complete) with cost tracking
    op_id = r.json['data']['operations'][0]['id']
    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/start-operation', json={'operation_id': op_id}, headers=h)
    assert r.status_code == 200 and r.json['data']['status'] == 'in_progress'
    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/complete-operation', json={'operation_id': op_id, 'actual_setup_time': 10, 'actual_run_time': 30}, headers=h)
    assert r.status_code == 200 and r.json['data']['status'] == 'completed'
    assert r.json['data']['cost_breakup']['total_cost'] > 0

    # 6. Final production receipt -> finished stock increases + batch for batch-tracked
    fin_before = Product.query.get(fin_id).current_stock
    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/receipt', json={'produced_qty': 10}, headers=h)
    assert r.status_code == 200
    assert r.json['data']['status'] == 'qc_pending'
    assert r.json['data']['produced_qty'] == 10
    assert Product.query.get(fin_id).current_stock == fin_before + 10

    # 7. QC passes -> completed
    r = client.post('/api/v1/manufacturing/qc/inspections', json={'reference_type': 'work_order', 'reference_id': wo_id, 'passed_qty': 10, 'failed_qty': 0, 'qc_status': 'passed'}, headers=h)
    assert r.status_code == 201
    r = client.get(f'/api/v1/manufacturing/work-orders/{wo_id}', headers=h)
    assert r.json['data']['status'] == 'completed'

def test_mrp_auto_po_generation(client):
    """MRP auto-PO: shortage is calculated, rounded to MOQ, and a PO is
    created against the preferred supplier; plan flagged po_generated."""
    h = _register_and_login(client, 'Manufacturing Unit')
    r = client.post('/api/v1/manufacturing/work-centers', json={'name': 'Line', 'hourly_machine_rate': 20}, headers=h)
    wc_id = r.json['data']['id']
    tenant = Tenant.query.filter_by(subdomain='manufacturingunite2e').first()
    raw_id, fin_id, sup_id = _create_products(client, h, tenant.id)
    # Force a shortage: current stock 50 but MOQ math below assumes zero stock
    with client.application.app_context():
        raw = Product.query.get(raw_id); raw.current_stock = 0; db.session.commit()
    r = client.post('/api/v1/manufacturing/supplier-item-mappings', json={'supplier_id': sup_id, 'item_id': raw_id, 'unit_price': 100, 'min_order_qty': 5, 'is_preferred_supplier': True}, headers=h)
    assert r.status_code == 201

    bom_id = _setup_bom(client, h, fin_id, raw_id, wc_id)
    r = client.post('/api/v1/manufacturing/work-orders', json={'bom_id': bom_id, 'planned_qty': 10}, headers=h)
    wo_id = r.json['data']['id']

    r = client.post('/api/v1/manufacturing/mrp/run', json={'work_order_id': wo_id}, headers=h)
    assert r.status_code == 200
    plan = r.json['data'][0]
    assert plan['shortage_qty'] == 20
    # MOQ 5 -> suggested PO rounded up to a multiple of 5
    assert plan['suggested_po_qty'] == 20
    assert plan['supplier_id'] == sup_id

    r = client.post('/api/v1/manufacturing/mrp/generate-po', json={}, headers=h)
    assert r.status_code == 200
    assert len(r.json['data']) == 1
    assert r.json['data'][0]['supplier_id'] == sup_id
    plans = MaterialRequirementPlan.query.filter_by(raw_material_id=raw_id, status='po_generated').all()
    assert len(plans) == 1


def test_process_ice_cream_batch_flow(client):
    """Process (Ice Cream) flow: recipe-minded BOM + batch-tracked finished
    product -> production receipt creates a batch record."""
    h = _register_and_login(client, 'Bakery')  # process-type profile
    r = client.post('/api/v1/manufacturing/config', json={'mfg_type': 'process', 'bom_label': 'Recipe', 'enabled_features': ['batch_production', 'expiry_tracking', 'qc']}, headers=h)
    assert r.status_code == 200 and r.json['data']['mfg_type'] == 'process'

    r = client.post('/api/v1/manufacturing/work-centers', json={'name': 'Mixing', 'hourly_labor_rate': 40}, headers=h)
    wc_id = r.json['data']['id']
    tenant = Tenant.query.filter_by(subdomain='bakerye2e').first()
    raw_id, fin_id, sup_id = _create_products(client, h, tenant.id, fin_batch=True)

    bom_id = _setup_bom(client, h, fin_id, raw_id, wc_id)
    r = client.post('/api/v1/manufacturing/work-orders', json={'bom_id': bom_id, 'planned_qty': 5}, headers=h)
    wo_id = r.json['data']['id']

    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/release', json={}, headers=h)
    assert r.status_code == 200
    batch_no = 'IC-001'
    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/receipt', json={'produced_qty': 5, 'batch_no': batch_no}, headers=h)
    assert r.status_code == 200
    assert r.json['data']['generated_batch'] is not None
    assert r.json['data']['generated_batch']['batch_no'] == batch_no
    assert Product.query.get(fin_id).current_stock == 5

