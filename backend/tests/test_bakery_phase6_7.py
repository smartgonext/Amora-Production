"""Tests for Phase 6 (HACCP QC + label) and Phase 7 (bake-day cost report)."""
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
from app.models.sales import SalesReturn, SalesReturnItem
from app.models.bakery import HaccpControlPoint, BakingPlan, BakingPlanItem


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
        tenant = Tenant(name='B67 T', subdomain='baker67', business_type='Bakery')
        db.session.add(tenant)
        db.session.flush()
        company = Company(tenant_id=tenant.id, name='B67 Co', business_type='Bakery')
        db.session.add(company)
        db.session.flush()
        cust = Customer(tenant_id=tenant.id, company_id=company.id,
                        name='Retailer', phone='2222222222')
        db.session.add(cust)
        db.session.flush()
        p = Product(tenant_id=tenant.id, name='Loaf', sku='LOAF', is_fresh=True,
                    selling_price=30, gst_rate=5, allergens=['Gluten'],
                    nutrition={'energy_kcal': 265, 'protein_g': 9})
        db.session.add(p)
        db.session.flush()

        # A bake plan for today with one line (for HACCP link + day cost).
        plan = BakingPlan(tenant_id=tenant.id, company_id=company.id,
                          plan_date=date.today(), shift='Morning', status='planned')
        db.session.add(plan)
        db.session.flush()
        db.session.add(BakingPlanItem(tenant_id=tenant.id, plan_id=plan.id,
                                      product_id=p.id, planned_qty=100, batch_size=20,
                                      num_batches=5, order_demand=80, forecast_qty=70))

        # An unsold return today (drives day-cost).
        s_r = SalesReturn(tenant_id=tenant.id, company_id=company.id,
                          customer_id=cust.id, return_number='RET-1',
                          return_date=datetime.utcnow(), reason='Unsold',
                          total_amount=150, status='Completed')
        db.session.add(s_r)
        db.session.flush()
        db.session.add(SalesReturnItem(tenant_id=tenant.id, sales_return_id=s_r.id,
                                       product_id=p.id, quantity=5, rate=30,
                                       gst_rate=5, total_amount=150))

        db.session.commit()
        return {'tenant': tenant.id, 'company': company.id, 'customer': cust.id,
                'product': p.id, 'plan': plan.id}


def test_haccp_create_and_list(app):
    data = _seed(app)
    with app.app_context():
        from app.services.bakery_operations import add_haccp_check, list_haccp_checks
        check = add_haccp_check(data['tenant'], data['company'], {
            'bake_plan_item_id': None,
            'work_order_id': None,
            'checkpoint_name': 'Oven Temp',
            'recorded_value': '210',
            'spec_min': 200, 'spec_max': 220, 'unit': 'C',
            'is_pass': True,
        })
        checks = list_haccp_checks(data['tenant'])
        assert len(checks) == 1
        assert checks[0].checkpoint_name == 'Oven Temp'
        assert checks[0].is_pass is True


def test_haccp_missing_name_raises(app):
    with app.app_context():
        from app.services.bakery_operations import add_haccp_check
        with pytest.raises(ValueError):
            add_haccp_check(1, 1, {})


def test_label_generator(app):
    data = _seed(app)
    with app.app_context():
        from app.services.bakery_service import generate_label
        lab = generate_label(data['product'])
    assert 'Gluten' in lab['allergens']
    assert '265' in lab['text']
    assert lab['is_fresh'] is True


def test_day_cost_report(app):
    data = _seed(app)
    with app.app_context():
        from app.services.bakery_operations import compute_day_cost
        report = compute_day_cost(data['tenant'], data['company'], date.today().isoformat())
    assert report['date'] == date.today().isoformat()
    assert report['unsold_return_cost'] == 150.0
    assert report['planned_units'] == 100


def test_phase67_endpoints(client, app):
    data = _seed(app)
    with app.app_context():
        user = User(tenant_id=data['tenant'], company_id=data['company'], name='Admin',
                    email='b67admin@test.com')
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()
    login = client.post('/api/v1/auth/login',
                        json={'email': 'b67admin@test.com', 'password': 'password123'})
    headers = {'Authorization': f"Bearer {login.json['data']['tokens']['access_token']}"}

    r = client.post('/api/v1/bakery/haccp', headers=headers, json={
        'checkpoint_name': 'Dough pH', 'recorded_value': '5.8',
        'spec_min': 4.5, 'spec_max': 6.2, 'unit': 'pH', 'is_pass': True,
    })
    assert r.status_code == 201
    assert r.json['data']['checkpoint_name'] == 'Dough pH'

    r2 = client.post('/api/v1/bakery/recipe-scale',
                     headers=headers, json={'bom_id': 0, 'target_dough_weight': 0})
    # BOM id 0 not found -> 4xx handled
    assert r2.status_code in (400, 404)

    r3 = client.get(f"/api/v1/bakery/day-cost?date={date.today().isoformat()}", headers=headers)
    assert r3.status_code == 200
    assert r3.json['data']['unsold_return_cost'] >= 0

    # label endpoint
    r4 = client.get(f"/api/v1/bakery/label/{data['product']}", headers=headers)
    assert r4.status_code == 200
    assert 'Gluten' in r4.json['data']['allergens']
