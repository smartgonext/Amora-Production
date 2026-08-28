"""Tests for Phase 4: FEFO/freshness, unsold-return -> credit note, routes."""
import pytest
import sys
import os
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.tenant import Tenant, Company
from app.models.user import User
from app.models.product import Product, ProductBatch
from app.models.customer import Customer
from app.models.sales import SalesReturn
from app.models.bakery import DeliveryRoute


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


def _seed(app):
    with app.app_context():
        tenant = Tenant(name='B4 T', subdomain='baker4', business_type='Bakery')
        db.session.add(tenant)
        db.session.flush()
        company = Company(tenant_id=tenant.id, name='B4 Co', business_type='Bakery')
        db.session.add(company)
        db.session.flush()
        cust = Customer(tenant_id=tenant.id, company_id=company.id,
                        name='Retailer', phone='1111111111')
        db.session.add(cust)
        db.session.flush()
        p = Product(tenant_id=tenant.id, name='Loaf', sku='LOAF', is_fresh=True,
                    selling_price=30, gst_rate=5)
        db.session.add(p)
        db.session.flush()

        today = date.today()
        b1 = ProductBatch(tenant_id=tenant.id, product_id=p.id, batch_no='B-OLD',
                          expiry_date=datetime.combine(today - timedelta(days=1), datetime.min.time()),
                          quantity=10)
        b2 = ProductBatch(tenant_id=tenant.id, product_id=p.id, batch_no='B-SOON',
                          expiry_date=datetime.combine(today + timedelta(days=2), datetime.min.time()),
                          quantity=20)
        b3 = ProductBatch(tenant_id=tenant.id, product_id=p.id, batch_no='B-FRESH',
                          expiry_date=datetime.combine(today + timedelta(days=20), datetime.min.time()),
                          quantity=30)
        db.session.add_all([b1, b2, b3])
        db.session.commit()
        return {'tenant': tenant.id, 'company': company.id,
                'customer': cust.id, 'product': p.id}


def test_fefo_pick_list_orders_by_expiry(app):
    data = _seed(app)
    with app.app_context():
        from app.services.bakery_operations import fefo_pick_list
        rows = fefo_pick_list(data['tenant'], product_id=data['product'])
    # Ordered by expiry ascending: expired -> near_expiry -> fresh
    assert len(rows) == 3
    assert [r['batch_no'] for r in rows] == ['B-OLD', 'B-SOON', 'B-FRESH']
    assert rows[0]['status'] == 'expired'
    assert rows[1]['status'] == 'near_expiry'
    assert rows[2]['status'] == 'fresh'


def test_record_unsold_return_creates_credit_note_and_restocks(app):
    data = _seed(app)
    with app.app_context():
        from app.services.bakery_operations import record_unsold_return
        r = record_unsold_return(data['tenant'], data['company'], {
            'customer_id': data['customer'],
            'items': [{'product_id': data['product'], 'quantity': 5, 'rate': 30, 'gst_rate': 5}],
        })
        rid = r.id
        s = db.session.get(SalesReturn, rid)
        assert s.return_number.startswith('RET-')
        assert len([i for i in s.items if not i.is_deleted]) == 1
        p = db.session.get(Product, data['product'])
        assert p.current_stock == 5


def test_delivery_route_create_and_list(app):
    data = _seed(app)
    with app.app_context():
        from app.services.bakery_operations import create_delivery_route, list_delivery_routes
        route = create_delivery_route(data['tenant'], data['company'], {
            'route_date': date.today().isoformat(),
            'vehicle_no': 'TN-01-AB-1234',
            'driver': 'Ravi',
            'customer_ids': [data['customer']],
        })
        r = db.session.get(DeliveryRoute, route.id)
        assert len([s for s in r.stops if not s.is_deleted]) == 1
        routes = list_delivery_routes(data['tenant'], d=date.today().isoformat())
        assert any(x.id == route.id for x in routes)


def test_phase4_endpoints(client, app):
    data = _seed(app)
    with app.app_context():
        user = User(tenant_id=data['tenant'], company_id=data['company'], name='Admin',
                    email='b4admin@test.com')
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()
    login = client.post('/api/v1/auth/login',
                        json={'email': 'b4admin@test.com', 'password': 'password123'})
    headers = {'Authorization': f"Bearer {login.json['data']['tokens']['access_token']}"}

    r = client.get('/api/v1/bakery/fefo', headers=headers)
    assert r.status_code == 200
    assert len(r.json['data']) == 3

    r2 = client.post('/api/v1/bakery/unsold-returns', headers=headers, json={
        'customer_id': data['customer'],
        'items': [{'product_id': data['product'], 'quantity': 2, 'rate': 30}],
    })
    assert r2.status_code == 201
    assert r2.json['data']['return_number']

    r3 = client.post('/api/v1/bakery/delivery-routes', headers=headers, json={
        'route_date': date.today().isoformat(), 'driver': 'Ravi',
        'customer_ids': [data['customer']],
    })
    assert r3.status_code == 201
