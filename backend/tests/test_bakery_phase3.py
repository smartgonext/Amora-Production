"""Tests for Phase 3: Daily Bake Plan (production scheduling)."""
import pytest
import sys
import os
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.tenant import Tenant, Company
from app.models.product import Product, ProductCategory
from app.models.customer import Customer
from app.models.sales import SalesOrder, SalesOrderItem, Invoice, InvoiceItem
from app.models.manufacturing import BomHeader, BomItem
from app.models.bakery import BakingPlan


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
        tenant = Tenant(name='Bake T', subdomain='bakeplan', business_type='Bakery')
        db.session.add(tenant)
        db.session.flush()
        company = Company(tenant_id=tenant.id, name='Bake Co', business_type='Bakery')
        db.session.add(company)
        db.session.flush()

        cat = ProductCategory(tenant_id=tenant.id, name='Bakery')
        db.session.add(cat)
        db.session.flush()

        loaf = Product(tenant_id=tenant.id, name='White Loaf', sku='LOAF',
                       category_id=cat.id, is_raw_material=False, is_fresh=True)
        cake = Product(tenant_id=tenant.id, name='Celebration Cake', sku='CAKE',
                       category_id=cat.id, is_raw_material=False)
        flour = Product(tenant_id=tenant.id, name='Flour', sku='FLOUR',
                        category_id=cat.id, is_raw_material=True)
        db.session.add_all([loaf, cake, flour])
        db.session.flush()

        cust = Customer(tenant_id=tenant.id, company_id=company.id,
                        name='Retail', phone='9999999999')
        db.session.add(cust)
        db.session.flush()

        bom = BomHeader(tenant_id=tenant.id, company_id=company.id,
                        product_id=loaf.id, version='V1.0', name='Loaf recipe', status='active')
        db.session.add(bom)
        db.session.flush()
        db.session.add(BomItem(bom_id=bom.id, item_id=flour.id, qty_required=10))

        today = date.today()
        so = SalesOrder(tenant_id=tenant.id, company_id=company.id, customer_id=cust.id,
                        order_number='SO-1', order_date=datetime.now(),
                        delivery_date=datetime.combine(today, datetime.min.time()),
                        status='Confirmed')
        db.session.add(so)
        db.session.flush()
        db.session.add(SalesOrderItem(tenant_id=tenant.id, sales_order_id=so.id, product_id=loaf.id,
                                      quantity=20, rate=10))

        weekday = today.weekday()
        ref = (today - timedelta(days=7)) - timedelta(
            days=(((today - timedelta(days=7)).weekday() - weekday) % 7))
        inv = Invoice(tenant_id=tenant.id, company_id=company.id, type='Sales',
                      invoice_number='INV-1',
                      invoice_date=datetime.combine(ref, datetime.min.time()),
                      customer_id=cust.id, total_amount=50)
        db.session.add(inv)
        db.session.flush()
        db.session.add(InvoiceItem(tenant_id=tenant.id, invoice_id=inv.id, product_id=loaf.id, quantity=5, rate=10))

        db.session.commit()
        return {'tenant': tenant.id, 'company': company.id,
                'loaf': loaf.id, 'cake': cake.id}


def test_build_plan_creates_lines_for_bakeable_only(app):
    data = _seed(app)
    with app.app_context():
        from app.services.bakery_planner import build_daily_bake_plan
        plan, created = build_daily_bake_plan(data['tenant'], data['company'], date.today())
        assert created is True
        plan = db.session.get(BakingPlan, plan.id)
        items = [i for i in plan.items if not i.is_deleted]
        product_ids = {i.product_id for i in items}
        assert data['loaf'] in product_ids
        assert data['cake'] not in product_ids
        line = [i for i in items if i.product_id == data['loaf']][0]
        assert line.order_demand == 20
        assert line.forecast_qty >= 5
        assert line.planned_qty >= 20


def test_build_plan_idempotent(app):
    data = _seed(app)
    with app.app_context():
        from app.services.bakery_planner import build_daily_bake_plan
        p1, _ = build_daily_bake_plan(data['tenant'], data['company'], date.today())
        pid1 = p1.id
        p2, c2 = build_daily_bake_plan(data['tenant'], data['company'], date.today())
    assert c2 is False
    # The second call returned the persisted plan (same id).
    assert p2.id == pid1


def test_plan_line_update_recomputes_batches(app):
    data = _seed(app)
    with app.app_context():
        from app.services.bakery_planner import build_daily_bake_plan, update_plan_line
        plan, _ = build_daily_bake_plan(data['tenant'], data['company'], date.today())
        plan = db.session.get(BakingPlan, plan.id)
        lines = [i for i in plan.items if not i.is_deleted]
        line = [i for i in lines if i.product_id == data['loaf']][0]
        update_plan_line(line.id, data['tenant'],
                         {'planned_qty': 50, 'batch_size': 20})
        updated = db.session.get(type(line), line.id)
        assert updated.planned_qty == 50
        assert updated.batch_size == 20
        assert updated.num_batches == 3  # ceil(50/20)


def test_bake_plan_endpoint(client, app):
    data = _seed(app)
    from app.models.user import User
    with app.app_context():
        user = User(tenant_id=data['tenant'], company_id=data['company'],
                    name='Admin', email='bakeadmin@test.com')
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()
    login = client.post('/api/v1/auth/login', json={
        'email': 'bakeadmin@test.com', 'password': 'password123'})
    token = login.json['data']['tokens']['access_token']
    headers = {'Authorization': f'Bearer {token}'}

    r = client.post('/api/v1/bakery/bake-plans',
                    json={'plan_date': date.today().isoformat(), 'shift': 'Morning'},
                    headers=headers)
    assert r.status_code == 201
    plan_id = r.json['data']['id']

    r2 = client.get(f'/api/v1/bakery/bake-plans/{plan_id}', headers=headers)
    assert r2.status_code == 200
    assert r2.json['data']['id'] == plan_id
