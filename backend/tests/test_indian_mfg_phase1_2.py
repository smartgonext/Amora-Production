"""Phase 1 & 2 Indian Manufacturing Upgrades tests.

Phase 1 — Procurement & Inventory Audit:
  * Multi-UOM conversion engine
  * GRN with Gate Entry, Lorry (vehicle) tracking and raw-material batch receipt
  * Incoming-QC accept/reject -> accepted qty posted to stock + ProductBatch
  * Batch traceability / lineage map

Phase 2 — Material Consumption & Returns (WIP Variance):
  * Actual material consumption recording
  * Excess material returns to warehouse
  * Yield / work-order variance analysis
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ['FLASK_ENV'] = 'testing'  # skip live MySQL auto DDL in tests

from sqlalchemy.pool import StaticPool
from flask_jwt_extended import create_access_token
from app import create_app, db
from app.models.tenant import Tenant, Company
from app.models.user import User
from app.models.product import Product, ProductCategory, Warehouse, ProductBatch
from app.models.customer import Supplier
from app.models.manufacturing import (
    ProductionMaterialIssue, WorkCenter,
)
from app.services.manufacturing_service import (
    create_bom, create_work_order, release_work_order, production_receipt,
    create_uom_conversion, list_uom_conversions, delete_uom_conversion,
    record_material_consumption, record_material_return, compute_work_order_analysis,
    record_batch_lineage, list_batch_lineage,
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
def client(app):
    return app.test_client()


@pytest.fixture
def seed(app):
    with app.app_context():
        t = Tenant(name='Mfg Tenant', subdomain='mfgphase')
        db.session.add(t); db.session.flush()
        c = Company(tenant_id=t.id, name='Mfg Co')
        db.session.add(c); db.session.flush()
        cat = ProductCategory(tenant_id=t.id, name='Cat')
        db.session.add(cat); db.session.flush()
        raw = Product(tenant_id=t.id, category_id=cat.id, name='Steel',
                      purchase_price=100, current_stock=50, is_batch_tracked=True)
        fin = Product(tenant_id=t.id, category_id=cat.id, name='Chair',
                      is_batch_tracked=True)
        db.session.add_all([raw, fin]); db.session.flush()
        wh = Warehouse(tenant_id=t.id, company_id=c.id, name='Main WH')
        wc = WorkCenter(tenant_id=t.id, name='Assembly',
                        hourly_labor_rate=50, hourly_machine_rate=30)
        db.session.add_all([wh, wc]); db.session.flush()
        sup = Supplier(tenant_id=t.id, name='Steel Co', phone='100')
        db.session.add(sup); db.session.flush()
        db.session.commit()
        yield {
            'tenant': t, 'company': c, 'raw': raw, 'fin': fin,
            'wh': wh, 'wc': wc, 'supplier': sup,
        }


# ===========================================================================
# Phase 1 — Multi-UOM Conversion Engine
# ===========================================================================

def test_uom_conversion_crud(seed):
    conv = create_uom_conversion(seed['tenant'].id, {
        'item_id': seed['raw'].id, 'from_uom': 'Drum', 'to_uom': 'Liter',
        'conversion_factor': 200,
    })
    assert conv.id is not None
    assert float(conv.conversion_factor) == 200.0

    convs = list_uom_conversions(seed['tenant'].id, item_id=seed['raw'].id)
    assert len(convs) == 1

    delete_uom_conversion(seed['tenant'].id, conv.id)
    assert list_uom_conversions(seed['tenant'].id, item_id=seed['raw'].id) == []


def test_uom_conversion_rejects_bad_factor(seed):
    with pytest.raises(ValueError):
        create_uom_conversion(seed['tenant'].id, {
            'item_id': seed['raw'].id, 'from_uom': 'Drum', 'to_uom': 'Liter',
            'conversion_factor': 0,
        })


# ===========================================================================
# Phase 1 — GRN with Gate Entry, Lorry Tracking & Raw Batch Receipt
# ===========================================================================

def _register_and_login(client, business_type='Manufacturing Unit'):
    sub = business_type.lower().replace(' ', '') + 'ph'
    email = f'{sub}@test.com'
    r = client.post('/api/v1/auth/register', json={
        'company_name': f'{business_type} Co', 'subdomain': sub, 'email': email,
        'password': 'password123', 'admin_name': 'Admin', 'business_type': business_type,
    })
    assert r.status_code in (200, 201), r.get_data(as_text=True)
    login = client.post('/api/v1/auth/login', json={'email': email, 'password': 'password123'})
    token = login.json['data']['tokens']['access_token']
    return {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}


def test_grn_gate_lorry_batch_receipt_updates_stock(client):
    h = _register_and_login(client)

    # Create raw material via API to guarantee same DB as the GRN request
    r = client.post('/api/v1/products', json={
        'name': 'Raw Mat', 'purchase_price': 50, 'is_raw_material': True,
        'opening_stock': 0, 'current_stock': 0,
    }, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    raw_id = r.json['data']['id']

    # Create GRN with gate entry, lorry tracking and raw-batch items
    r = client.post('/api/v1/purchases/grn', json={
        'grn_number': 'GRN-2026-00001',
        'received_date': '2026-08-10',
        'supplier_invoice_no': 'INV-101',
        'gate_entry_no': 'GE-448',
        'vehicle_no': 'TN-37-AB-1234',
        'lr_no': 'LR-7788',
        'items': [{
            'product_id': raw_id,
            'received_quantity': 100,
            'accepted_quantity': 95,
            'rejected_quantity': 5,
            'batch_no': 'RM-BATCH-2026-01',
            'mfg_date': '2026-07-01',
            'expiry_date': '2027-06-30',
            'rate': 50,
        }],
    }, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    grn = r.json['data']
    assert grn['gate_entry_no'] == 'GE-448'
    assert grn['vehicle_no'] == 'TN-37-AB-1234'
    assert grn['lr_no'] == 'LR-7788'
    assert grn['status'] == 'partial'  # 95 accepted of 100 received

    # Verify stock updated via API (same request-context DB)
    r = client.get(f'/api/v1/products/{raw_id}', headers=h)
    assert r.status_code == 200
    assert r.json['data']['current_stock'] == 95  # only accepted qty posted

    # Verify GRN detail includes raw-batch info
    r = client.get(f'/api/v1/purchases/grn/{grn["id"]}', headers=h)
    assert r.status_code == 200
    assert len(r.json['data']['items']) == 1
    assert r.json['data']['items'][0]['batch_no'] == 'RM-BATCH-2026-01'

def _seed_headers(app, seed):
    """Create an admin user for the seed tenant and return JWT auth headers."""
    with app.app_context():
        user = User(tenant_id=seed['tenant'].id, company_id=seed['company'].id,
                    name='Seed Admin', email='seed@test.com')
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()
        token = create_access_token(identity=str(user.id))
    return {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}


# ===========================================================================
# Phase 2 — Material Consumption, Returns & WIP Variance
# ===========================================================================

def _build_wo(seed):
    bom = create_bom(seed['tenant'].id, seed['company'].id, {
        'name': 'Chair BOM', 'product_id': seed['fin'].id, 'status': 'active',
        'standard_cost': 150,
        'items': [{'item_id': seed['raw'].id, 'qty_required': 2, 'uom': 'Pcs'}],
        'routing_operations': [{'operation_sequence': 10, 'operation_name': 'Assemble',
                                'work_center_id': seed['wc'].id}],
    })
    wo = create_work_order(seed['tenant'].id, seed['company'].id,
                           {'bom_id': bom.id, 'planned_qty': 10})
    wo = release_work_order(wo, warehouse_id=seed['wh'].id, company_id=seed['company'].id)
    issue = ProductionMaterialIssue.query.filter_by(work_order_id=wo.id).first()
    return wo, issue


def test_material_consumption_return_and_variance(seed):
    wo, issue = _build_wo(seed)
    # planned 20 (2/unit * 10), issued = min(20, stock 50) = 20
    assert float(issue.qty_planned) == 20.0
    assert float(issue.qty_issued) == 20.0

    # Actual consumption only 15 -> 5 unconsumed returns to warehouse
    issue = record_material_consumption(issue, 15)
    assert float(issue.qty_consumed) == 15.0
    assert float(issue.qty_returned) == 5.0
    assert float(issue.variance) == -5.0

    raw_db = Product.query.get(seed['raw'].id)
    # 50 initial - 20 issued + 5 returned = 35
    assert raw_db.current_stock == 35


def test_excess_return_via_record_material_return(seed):
    wo, issue = _build_wo(seed)
    issue = record_material_return(issue, 8)
    assert float(issue.qty_returned) == 8.0
    assert float(issue.qty_consumed) == 12.0  # issued 20 - returned 8
    assert float(issue.variance) == -8.0


def test_work_order_analysis_yield(seed):
    wo, issue = _build_wo(seed)
    record_material_consumption(issue, 20)
    wo, batch, _ = production_receipt(
        wo, warehouse_id=seed['wh'].id, company_id=seed['company'].id,
        batch_no='CH-001', produced_qty=9,
    )

    analysis = compute_work_order_analysis(wo)
    assert analysis['produced_qty'] == 9.0
    assert analysis['planned_qty'] == 10.0
    assert analysis['output_ratio_pct'] == 90.0
    assert analysis['material_yield_pct'] == 100.0  # 20 planned / 20 consumed
    assert len(analysis['rows']) == 1
    assert analysis['rows'][0]['item_id'] == seed['raw'].id


def test_work_order_analysis_endpoint(client, seed):
    """Verify the analysis endpoint works with proper auth (via test client)."""
    wo, issue = _build_wo(seed)
    record_material_consumption(issue, 18)
    production_receipt(wo, warehouse_id=seed['wh'].id, company_id=seed['company'].id,
                       batch_no='CH-002', produced_qty=8)
    h = _seed_headers(client.application, seed)
    # Use the app context that holds the data for the request
    with client.application.app_context():
        r = client.get(f'/api/v1/manufacturing/work-orders/{wo.id}/analysis', headers=h)
        assert r.status_code == 200
        # material_yield_pct = 20 planned / 18 consumed = 1.1111 * 100 = 111.11
        assert r.json['data']['material_yield_pct'] == 111.11
        assert r.json['data']['output_ratio_pct'] == 80.0  # 8 produced / 10 planned


# ===========================================================================
# Phase 1 — Batch Traceability / Lineage
# ===========================================================================

def test_batch_lineage_record_and_list(seed):
    wo, _ = _build_wo(seed)
    records = record_batch_lineage(seed['tenant'].id, {
        'work_order_id': wo.id,
        'finished_item_id': seed['fin'].id,
        'finished_batch_no': 'CH-100',
        'materials': [{
            'material_item_id': seed['raw'].id,
            'material_batch_no': 'RM-BATCH-2026-01',
            'qty_consumed': 18,
        }],
    })
    assert len(records) == 1

    listed = list_batch_lineage(seed['tenant'].id, finished_batch_no='CH-100')
    assert len(listed) == 1
    assert listed[0].material_batch_no == 'RM-BATCH-2026-01'


def test_batch_lineage_requires_materials(seed):
    with pytest.raises(ValueError):
        record_batch_lineage(seed['tenant'].id, {
            'work_order_id': 1, 'finished_item_id': seed['fin'].id,
            'finished_batch_no': 'CH-100', 'materials': [],
        })

