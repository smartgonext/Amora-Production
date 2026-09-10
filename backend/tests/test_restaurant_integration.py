"""
Tests for Store Channel / Restaurant Integration API.
Covers:
  - GET  /api/v1/store/products
  - POST /api/v1/store/dispatch
  - GET  /api/v1/store/dispatches
  - POST /api/v1/store/dispatches/<id>/receive
"""
import pytest
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.tenant import Tenant, Company
from app.models.product import Product, Warehouse
from app.models.restaurant_store import StoreChannel, StoreDispatch

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

def test_restaurant_integration_flow(client, app):
    # 1. Seed tenant, company, product, warehouse, and store channel
    with app.app_context():
        tenant = Tenant(name='Test Tenant', subdomain='test', business_type='Bakery')
        db.session.add(tenant)
        db.session.flush()
        
        company = Company(tenant_id=tenant.id, name='Test Company', business_type='Bakery')
        db.session.add(company)
        db.session.flush()
        
        product = Product(
            tenant_id=tenant.id,
            company_id=company.id,
            name='Bakers Vanilla Tub',
            sku='BVT-101',
            selling_price=120.00,
            current_stock=10,
            is_service=False,
            is_raw_material=False
        )
        db.session.add(product)
        db.session.flush()

        warehouse = Warehouse(
            tenant_id=tenant.id,
            company_id=company.id,
            name='Manufacturer Warehouse',
            location='Bakery',
            is_active=True
        )
        db.session.add(warehouse)
        db.session.flush()

        store = StoreChannel(
            tenant_id=tenant.id,
            company_id=company.id,
            name='Test Restaurant Store',
            code='REST_01',
            api_key='test-restaurant-key',
            is_active=True
        )
        db.session.add(store)
        db.session.commit()

        product_id = product.id
        store_id = store.id

    # 2. Test GET /api/v1/store/products
    headers = {'X-API-Key': 'test-restaurant-key'}
    res = client.get('/api/v1/store/products?include_zero_stock=1', headers=headers)
    assert res.status_code == 200
    data = res.json['data']
    assert data['store_code'] == 'REST_01'
    assert len(data['products']) == 1
    assert data['products'][0]['name'] == 'Bakers Vanilla Tub'
    assert data['products'][0]['ready_stock'] == 10

    # 3. Test POST /api/v1/store/dispatch (request 4 units transfer)
    dispatch_payload = {
        'items': [{'product_id': product_id, 'qty': 4}],
        'notes': 'Test dispatch'
    }
    res = client.post('/api/v1/store/dispatch', headers=headers, json=dispatch_payload)
    assert res.status_code == 201
    dispatch_data = res.json['data']
    assert dispatch_data['status'] == 'dispatched'
    assert dispatch_data['total_qty'] == 4
    assert len(dispatch_data['receivable_lines']) == 1
    assert dispatch_data['receivable_lines'][0]['qty'] == 4
    dispatch_id = dispatch_data['id']

    # 4. Check ERP Side Stock Reduction (10 -> 6)
    with app.app_context():
        p = db.session.get(Product, product_id)
        assert p.current_stock == 6

    # 5. Test GET /api/v1/store/dispatches
    res = client.get('/api/v1/store/dispatches?status=dispatched', headers=headers)
    assert res.status_code == 200
    dispatches = res.json['data']
    assert len(dispatches) == 1
    assert dispatches[0]['id'] == dispatch_id

    # 6. Test POST /api/v1/store/dispatches/<id>/receive
    res = client.post(f'/api/v1/store/dispatches/{dispatch_id}/receive', headers=headers)
    assert res.status_code == 200
    assert res.json['data']['status'] == 'received'

    # 7. Verify status in database
    with app.app_context():
        d = db.session.get(StoreDispatch, dispatch_id)
        assert d.status == 'received'
        assert d.items.first().qty_received == 4
