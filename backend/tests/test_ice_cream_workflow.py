"""End-to-end Ice Cream Manufacturing workflow test.

Validates the full connected chain required by the Ice Cream ERP upgrade:

Supplier -> Purchase Order (line items persisted, historical rate preserved)
-> GRN / Material Receipt (raw batch + stock) -> BOM/Recipe -> Work Order
release (raw-material batch consumption) -> Production Receipt (finished
batch with expiry) -> QC -> Finished Stock -> Quotation -> Quotation->Invoice
conversion -> Finished-goods stock deduction with batch allocation.

Uses a UNIQUE subdomain per run so it stays isolated from other tests that
share the persistent `smartgonext_erp_test` database.
"""
import pytest
import sys
import os
import uuid
from decimal import Decimal
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.tenant import Tenant
from app.models.product import Product, ProductBatch, StockLedger


@pytest.fixture(scope='module')
def app():
    app = create_app('test')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()


@pytest.fixture(scope='module')
def client(app):
    return app.test_client()


def _sub():
    return 'icecream' + uuid.uuid4().hex[:6]


def test_full_ice_cream_manufacturing_workflow(client):
    sub = _sub()
    email = f'{sub}@test.com'
    r = client.post('/api/v1/auth/register', json={
        'company_name': 'Ice Cream Co', 'subdomain': sub, 'email': email,
        'password': 'password123', 'admin_name': 'Admin',
        'business_type': 'Bakery',
    })
    assert r.status_code in (200, 201), r.get_data(as_text=True)
    login = client.post('/api/v1/auth/login', json={'email': email, 'password': 'password123'})
    token = login.json['data']['tokens']['access_token']
    h = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}

    tenant = Tenant.query.filter_by(subdomain=sub).first()
    assert tenant is not None

    # ---------- 1. Supplier ----------
    r = client.post('/api/v1/suppliers', json={
        'name': 'Milk Supplier', 'phone': '9876500001',
        'email': 'milk@supplier.com', 'gstin': 'GST98765',
    }, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    supplier_id = r.json['data']['id']

    # ---------- 2. Products: raw material + finished ice cream ----------
    with client.application.app_context():
        raw = Product(tenant_id=tenant.id, name='Whole Milk', is_raw_material=True,
                      purchase_price=Decimal('40.00'), current_stock=0)
        fin = Product(tenant_id=tenant.id, name='Vanilla Tub', is_batch_tracked=True,
                      best_before_days=180, selling_price=Decimal('220.00'),
                      purchase_price=Decimal('120.00'), current_stock=0)
        db.session.add_all([raw, fin]); db.session.flush()
        raw_id, fin_id = raw.id, fin.id
        db.session.commit()

    # ---------- 3. Warehouse ----------
    r = client.post('/api/v1/inventory/warehouses', json={'name': 'Cold Storage'}, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    warehouse_id = r.json['data']['id']

    # ---------- 4. PO with line items (historical rates preserved) ----------
    r = client.post('/api/v1/purchases', json={
        'supplier_id': supplier_id,
        'items': [{'product_id': raw_id, 'quantity': 100, 'rate': 45, 'gst_rate': 5}],
    }, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    po1 = r.json['data']
    assert len(po1['items']) == 1, 'PO line items must be persisted'
    assert float(po1['items'][0]['rate']) == 45.0

    r = client.post('/api/v1/purchases', json={
        'supplier_id': supplier_id,
        'items': [{'product_id': raw_id, 'quantity': 80, 'rate': 52, 'gst_rate': 5}],
    }, headers=h)
    assert r.status_code == 201
    assert float(r.json['data']['items'][0]['rate']) == 52.0

    from app.models.product import PurchaseItem
    with client.application.app_context():
        pr = PurchaseItem.query.filter_by(product_id=raw_id).all()
        rates = [float(i.rate) for i in pr if i.rate]
    assert sorted(rates) == sorted([45.0, 52.0]), rates

    # ---------- 5. GRN -> raw material batch + stock ----------
    grn_payload = {
        'warehouse_id': warehouse_id,
        'grn_number': 'GRN-IC-100001',
        'received_date': '2026-01-10',
        'status': 'approved',
        'items': [{
            'purchase_order_id': po1['id'],
            'product_id': raw_id,
            'received_quantity': 100, 'accepted_quantity': 100, 'rejected_quantity': 0,
            'batch_no': 'MILK-001', 'mfg_date': '2025-12-30', 'expiry_date': '2025-12-31',
            'rate': 45,
        }],
    }
    r = client.post('/api/v1/purchases/grn', json=grn_payload, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    with client.application.app_context():
        raw = Product.query.get(raw_id)
        assert raw.current_stock == 100, f'raw stock after GRN = {raw.current_stock}'

    # ---------- 6. BOM / Recipe ----------
    r = client.post('/api/v1/manufacturing/work-centers', json={
        'name': 'Mixing Line', 'hourly_labor_rate': 40, 'hourly_machine_rate': 20,
    }, headers=h)
    assert r.status_code == 201
    wc_id = r.json['data']['id']

    bom_payload = {
        'name': 'Vanilla Tub Recipe', 'product_id': fin_id, 'status': 'active',
        'items': [{'item_id': raw_id, 'qty_required': 2, 'uom': 'Ltr'}],
        'routing_operations': [{'operation_sequence': 10, 'operation_name': 'Mix',
                                'work_center_id': wc_id}],
    }
    r = client.post('/api/v1/manufacturing/boms', json=bom_payload, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    bom_id = r.json['data']['id']

    # ---------- 7. Work Order + release (raw-material batch consumption) ----------
    r = client.post('/api/v1/manufacturing/work-orders', json={
        'bom_id': bom_id, 'planned_qty': 10,
    }, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    wo_id = r.json['data']['id']

    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/release', json={}, headers=h)
    assert r.status_code == 200, r.get_data(as_text=True)

    with client.application.app_context():
        raw2 = Product.query.get(raw_id)
        assert raw2.current_stock == 80, f'raw after release = {raw2.current_stock}'
        from app.models.manufacturing import ProductionMaterialIssue
        issue = ProductionMaterialIssue.query.filter_by(work_order_id=wo_id).first()
        assert issue is not None and issue.batch_no == 'MILK-001', 'issue must keep raw batch no'

    # ---------- 8. Production receipt -> finished batch w/ expiry ----------
    r = client.post(f'/api/v1/manufacturing/work-orders/{wo_id}/receipt', json={
        'produced_qty': 10, 'batch_no': 'VT-001',
    }, headers=h)
    assert r.status_code == 200, r.get_data(as_text=True)
    gen = r.json['data']['generated_batch']
    assert gen is not None and gen['batch_no'] == 'VT-001'
    assert gen['expiry_date'] is not None, 'finished batch must carry best-before expiry'
    with client.application.app_context():
        fin = Product.query.get(fin_id)
        assert fin.current_stock == 10, fin.current_stock

    # ---------- 9. QC -> completes WO ----------
    r = client.post('/api/v1/manufacturing/qc/inspections', json={
        'reference_type': 'work_order', 'reference_id': wo_id,
        'passed_qty': 10, 'failed_qty': 0, 'qc_status': 'passed',
    }, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    r = client.get(f'/api/v1/manufacturing/work-orders/{wo_id}', headers=h)
    assert r.json['data']['status'] == 'completed'

    # ---------- 10. Customer + Quotation ----------
    r = client.post('/api/v1/customers', json={
        'name': 'Choco Retail', 'phone': '9000000001',
    }, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    customer_id = r.json['data']['id']

    r = client.post('/api/v1/sales/quotations', json={
        'customer_id': customer_id,
        'items': [{'product_id': fin_id, 'qty': 4, 'rate': 220, 'tax_percent': 18}],
    }, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    quotation_id = r.json['data']['id']

    # ---------- 11. Quotation -> Invoice (carries forward + stock deducted) ----------
    r = client.post(f'/api/v1/sales/quotations/{quotation_id}/convert-to-invoice', json={
        'payment_method': 'Credit', 'payment_status': 'Unpaid',
    }, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    inv = r.json['data']
    assert inv['customer_id'] == customer_id
    assert len(inv['items']) == 1 and inv['items'][0]['rate'] == 220.0
    assert float(inv['total_amount']) > 0
    with client.application.app_context():
        fin2 = Product.query.get(fin_id)
        assert fin2.current_stock == 6, f'finished after sale = {fin2.current_stock}'
        fb = ProductBatch.query.filter_by(product_id=fin_id, batch_no='VT-001').first()
        assert fb.quantity == 6, f'finished batch qty = {fb.quantity}'
        from app.models.sales import Invoice
        inv_row = Invoice.query.filter_by(id=inv['id']).first()
        sale = StockLedger.query.filter_by(product_id=fin_id, type='Sale',
                                           reference_type='invoice',
                                           reference_id=inv_row.id).first()
        assert sale is not None, 'a traceable Sale ledger movement must exist'
        assert sale.quantity_delta == -4

    # ---------- 12. raw->finished lineage ----------
    r = client.post('/api/v1/manufacturing/batch-lineage', json={
        'work_order_id': wo_id,
        'finished_item_id': fin_id,
        'finished_batch_no': 'VT-001',
        'materials': [{'material_item_id': raw_id, 'material_batch_no': 'MILK-001',
                       'qty_consumed': 20}],
    }, headers=h)
    assert r.status_code in (200, 201), r.get_data(as_text=True)


def test_direct_invoice_stock_and_batch_deduction(client):
    sub = 'invoice' + uuid.uuid4().hex[:6]
    email = f'{sub}@test.com'
    r = client.post('/api/v1/auth/register', json={
        'company_name': 'Invoice Direct Co', 'subdomain': sub, 'email': email,
        'password': 'password123', 'admin_name': 'Admin',
        'business_type': 'Bakery',
    })
    assert r.status_code in (200, 201), r.get_data(as_text=True)
    login = client.post('/api/v1/auth/login', json={'email': email, 'password': 'password123'})
    token = login.json['data']['tokens']['access_token']
    h = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}

    # Create batch-tracked product with initial stock and batch
    from datetime import datetime, timedelta
    with client.application.app_context():
        tenant = Tenant.query.filter_by(subdomain=sub).first()
        assert tenant is not None
        
        prod = Product(tenant_id=tenant.id, name='Direct Ice Cream', is_batch_tracked=True,
                       selling_price=Decimal('150.00'), current_stock=20)
        db.session.add(prod)
        db.session.flush()
        
        batch = ProductBatch(
            tenant_id=tenant.id,
            product_id=prod.id,
            batch_no='DIR-001',
            quantity=20,
            expiry_date=datetime.utcnow() + timedelta(days=30),
            mfg_date=datetime.utcnow(),
            purchase_price=Decimal('80.00')
        )
        db.session.add(batch)
        prod_id = prod.id
        db.session.commit()

    # Create customer
    r = client.post('/api/v1/customers', json={
        'name': 'Direct Customer', 'phone': '9000000009',
    }, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    customer_id = r.json['data']['id']

    # Post direct invoice via invoices endpoint
    r = client.post('/api/v1/invoices', json={
        'customer_id': customer_id,
        'invoice_number': f'INV-DIR-{uuid.uuid4().hex[:4].upper()}',
        'items': [{
            'product_id': prod_id,
            'qty': 5,
            'rate': 150.00,
            'tax_percent': 18.00
        }],
        'payment_method': 'Cash',
        'payment_status': 'Paid'
    }, headers=h)
    assert r.status_code == 201, r.get_data(as_text=True)
    inv_id = r.json['data']['id']

    # Verify stock and batch quantity
    with client.application.app_context():
        p_db = Product.query.get(prod_id)
        assert p_db.current_stock == 15
        
        b_db = ProductBatch.query.filter_by(product_id=prod_id, batch_no='DIR-001').first()
        assert b_db.quantity == 15

        # Check ledger
        ledger = StockLedger.query.filter_by(product_id=prod_id, type='Sale', reference_type='invoice', reference_id=inv_id).first()
        assert ledger is not None
        assert ledger.quantity_delta == -5
        assert ledger.batch_id == b_db.id