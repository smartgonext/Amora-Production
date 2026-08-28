import pytest
import uuid
from datetime import datetime, timedelta

@pytest.fixture(scope='session')
def app():
    import os
    os.environ['FLASK_ENV'] = 'testing'

    from app import create_app
    test_app = create_app('test', config_overrides={
        'JWT_SECRET_KEY': 'test-jwt-secret-key',
        'WTF_CSRF_ENABLED': False,
    })

    from app.extensions import db
    with test_app.app_context():
        db.create_all()
        yield test_app
        db.session.remove()
        db.drop_all()


@pytest.fixture(scope='session')
def client(app):
    return app.test_client()


STATE = {}


def json_post(client, url, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    return client.post(url, json=data or {}, headers=headers)


def json_get(client, url, token=None, params=None):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    return client.get(url, headers=headers, query_string=params)


class TestSpecialtyVertical:
    def test_setup_tenant_vertical(self, client):
        # Register a Crane & Forklift tenant
        subdomain = f'heavy{uuid.uuid4().hex[:6]}'
        r = json_post(client, '/api/v1/auth/register', {
            'company_name': 'Heavy Lifting Logistics',
            'subdomain': subdomain,
            'email': f'{subdomain}@heavy.com',
            'password': 'Test@1234',
            'admin_name': 'Heavy Admin',
            'business_type': 'Crane & Forklift'
        })
        assert r.status_code == 201
        body = r.get_json()
        STATE['token'] = body['data']['tokens']['access_token']
        STATE['company_id'] = body['data']['company']['id']
        STATE['email'] = f'{subdomain}@heavy.com'

    def test_create_equipment(self, client):
        # Create an equipment asset
        r = json_post(client, '/api/v1/equipment', {
            'name': 'Liebherr LTM 1050 Crane',
            'type': 'Crane',
            'model_number': 'LTM-1050',
            'ton_capacity': 50.0,
            'registration_number': 'MH-12-CR-1100',
            'min_hourly_rate': 2500,
            'min_daily_rate': 12000
        }, token=STATE['token'])
        assert r.status_code == 201
        body = r.get_json()
        assert body['data']['name'] == 'Liebherr LTM 1050 Crane'
        assert body['data']['rental_status'] == 'Available'
        STATE['equipment_id'] = body['data']['id']

    def test_create_rental_booking(self, client):
        # Register a customer
        cust_r = json_post(client, '/api/v1/customers', {
            'name': 'Mega Builders Corp',
            'phone': '9876543210',
            'email': 'mega@builders.com'
        }, token=STATE['token'])
        assert cust_r.status_code == 201
        cust_id = cust_r.get_json()['data']['id']
        STATE['customer_id'] = cust_id

        # Create rental booking
        r = json_post(client, '/api/v1/equipment/rentals', {
            'customer_id': cust_id,
            'equipment_id': STATE['equipment_id'],
            'start_date': datetime.utcnow().strftime('%Y-%m-%d'),
            'end_date': (datetime.utcnow() + timedelta(days=5)).strftime('%Y-%m-%d'),
            'rental_rate_applied': 11500,
            'security_deposit': 25000,
            'site_address': 'Metro Project Site A, Mumbai'
        }, token=STATE['token'])
        assert r.status_code == 201
        body = r.get_json()
        assert body['data']['status'] == 'Active'
        STATE['booking_id'] = body['data']['id']

        # Verify equipment status is Rented
        eq_r = json_get(client, '/api/v1/equipment', token=STATE['token'])
        eq_list = eq_r.get_json()['data']
        my_eq = next(x for x in eq_list if x['id'] == STATE['equipment_id'])
        assert my_eq['rental_status'] == 'Rented'

    def test_return_equipment(self, client):
        # Process the return
        r = json_post(client, f"/api/v1/equipment/rentals/{STATE['booking_id']}/return", {
            'damage_charges': 1500,
            'return_condition_notes': 'Slight scratch on boom arm, billing penalty applied.'
        }, token=STATE['token'])
        assert r.status_code == 200
        body = r.get_json()
        assert body['data']['status'] == 'Completed'
        assert body['data']['damage_charges'] == 1500

        # Verify equipment status is back to Available
        eq_r = json_get(client, '/api/v1/equipment', token=STATE['token'])
        eq_list = eq_r.get_json()['data']
        my_eq = next(x for x in eq_list if x['id'] == STATE['equipment_id'])
        assert my_eq['rental_status'] == 'Available'

    def test_amc_contracts_scheduling_and_parts_deduction(self, client):
        # Register a spare part product
        prod_r = json_post(client, '/api/v1/products', {
            'name': 'Hydraulic Filter HF-12',
            'sku': 'FILT-HF12',
            'price': 1450,
            'opening_stock': 10
        }, token=STATE['token'])
        assert prod_r.status_code == 201
        product_id = prod_r.get_json()['data']['id']

        # Create AMC Contract
        r = json_post(client, '/api/v1/equipment/amc', {
            'customer_id': STATE['customer_id'],
            'contract_title': 'Annual Hydraulic SLA CAT-20',
            'amc_value': 85000,
            'service_interval_days': 90,
            'machine_name': 'CAT Forklift 5T',
            'machine_serial': 'CAT-55091',
            'model': 'FL-50',
            'capacity': '5 Tons'
        }, token=STATE['token'])
        assert r.status_code == 201
        body = r.get_json()
        amc_id = body['data']['id']
        assert body['data']['contract_title'] == 'Annual Hydraulic SLA CAT-20'
        
        # Verify scheduled service list contains entries
        # Since start is today and end is 1 year from now, interval 90 days generates 4 visits
        # We can view the contract schedule details in the list
        list_r = json_get(client, '/api/v1/equipment/amc', token=STATE['token'])
        my_amc = next(x for x in list_r.get_json()['data'] if x['id'] == amc_id)
        assert len(my_amc['schedules']) >= 3
        
        # Find a pending schedule visit
        schedule_id = my_amc['schedules'][0]['id']
        
        # Log service visit and consume 2 hydraulic filters
        visit_r = json_post(client, f'/api/v1/equipment/amc/schedule/{schedule_id}/visit', {
            'findings_report': 'Completed regular fluid check. Replaced 2 filters.',
            'parts_consumed': [{'product_id': product_id, 'qty': 2}]
        }, token=STATE['token'])
        assert visit_r.status_code == 200
        
        # Verify product stock is auto-deducted (10 - 2 = 8)
        prod_get = json_get(client, '/api/v1/products', token=STATE['token'])
        my_prod = next(p for p in prod_get.get_json()['data'] if p['id'] == product_id)
        assert my_prod['current_stock'] == 8
