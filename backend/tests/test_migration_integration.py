import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.tenant import Tenant, Company, Branch, CustomFormSection, CustomFormField
from app.models.user import User
from app.models.product import Product
from app.models.customer import Customer
from app.models.equipment import Equipment, RentalBooking
from app.models.amc import AMCContract
from app.models.sales import Invoice

@pytest.fixture(scope='session')
def app():
    """Create application for testing"""
    app = create_app('test')
    with app.app_context():
        with db.engine.connect() as connection:
            transaction = connection.begin()
            connection.execute(db.text("SET FOREIGN_KEY_CHECKS = 0;"))
            db.metadata.drop_all(bind=connection)
            db.metadata.create_all(bind=connection)
            connection.execute(db.text("SET FOREIGN_KEY_CHECKS = 1;"))
            transaction.commit()
        yield app
        db.session.remove()

@pytest.fixture(autouse=True)
def clean_tables(app):
    with app.app_context():
        db.session.rollback()
        db.session.close()
        db.session.execute(db.text("SET FOREIGN_KEY_CHECKS = 0;"))
        keep_tables = {'tenants', 'companies', 'branches', 'users', 'roles', 'permissions', 'subscription_plans', 'subscriptions', 'licenses'}
        for table in reversed(db.metadata.sorted_tables):
            if table.name not in keep_tables:
                db.session.execute(table.delete())
        db.session.commit()
        db.session.execute(db.text("SET FOREIGN_KEY_CHECKS = 1;"))
        db.session.close()

@pytest.fixture(scope='session')
def client(app):
    return app.test_client()

@pytest.fixture(scope='session')
def auth_headers(client):
    with client.application.app_context():
        db.session.close()
        tenant = Tenant(name='Test ERP Tenant', subdomain='erptenant', db_status='active', is_active=True)
        db.session.add(tenant)
        db.session.flush()

        company = Company(tenant_id=tenant.id, name='ERP Company', email='erp@company.com')
        db.session.add(company)
        db.session.flush()

        branch = Branch(tenant_id=tenant.id, company_id=company.id, name='Main Branch', code='MAIN', is_main=True)
        db.session.add(branch)
        db.session.flush()

        user = User(tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, name='ERP Admin', email='erpadmin@test.com')
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()

    response = client.post('/api/v1/auth/login', json={
        'email': 'erpadmin@test.com',
        'password': 'password123'
    })
    token = response.json['data']['tokens']['access_token']
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

def test_product_custom_fields(client, auth_headers):
    # Create product with some custom/dynamic fields
    payload = {
        "name": "Super Engine Part",
        "sku": "ENG-PART-100",
        "purchase_price": 500.0,
        "selling_price": 750.0,
        "gst_rate": 18.0,
        "warranty_duration": "24 Months", # Dynamic
        "manufacturer_origin": "Germany"  # Dynamic
    }
    res = client.post('/api/v1/products', json=payload, headers=auth_headers)
    assert res.status_code == 201, res.json
    prod_data = res.json['data']
    
    # Flat serialization check
    assert prod_data['name'] == "Super Engine Part"
    assert prod_data['warranty_duration'] == "24 Months"
    assert prod_data['manufacturer_origin'] == "Germany"

def test_customer_custom_fields(client, auth_headers):
    payload = {
        "name": "Acme Industrial Corp",
        "phone": "9998887770",
        "email": "acme@industrial.com",
        "industry_vertical": "Manufacturing", # Dynamic
        "preferred_shipper": "DHL Express"    # Dynamic
    }
    res = client.post('/api/v1/customers', json=payload, headers=auth_headers)
    assert res.status_code == 201, res.json
    cust_data = res.json['data']
    
    assert cust_data['name'] == "Acme Industrial Corp"
    assert cust_data['industry_vertical'] == "Manufacturing"
    assert cust_data['preferred_shipper'] == "DHL Express"

def test_rental_custom_fields(client, auth_headers):
    # Setup prerequisite customer via API
    cust_res = client.post('/api/v1/customers', json={
        "name": "Rental Cust",
        "phone": "1234",
        "email": "rental@cust.com"
    }, headers=auth_headers)
    assert cust_res.status_code == 201, cust_res.json
    cust_id = cust_res.json['data']['id']

    # Setup prerequisite equipment via API
    eq_res = client.post('/api/v1/equipment', json={
        "name": "Caterpillar Forklift",
        "type": "Vehicle",
        "serial_number": "CAT-1"
    }, headers=auth_headers)
    assert eq_res.status_code == 201, eq_res.json
    eq_id = eq_res.json['data']['id']

    payload = {
        "customer_id": cust_id,
        "equipment_id": eq_id,
        "start_date": "2026-08-20",
        "end_date": "2026-08-30",
        "rental_rate_applied": 12000.0,
        "security_deposit": 25000.0,
        "site_address": "Docking bay 3, Port of Chennai",
        "operator_required": "Yes", # Dynamic
        "fuel_terms": "Full to Full" # Dynamic
    }
    res = client.post('/api/v1/equipment/rentals', json=payload, headers=auth_headers)
    assert res.status_code == 201, res.json
    rental_data = res.json['data']
    
    assert rental_data['security_deposit'] == 25000.0
    assert rental_data['operator_required'] == "Yes"
    assert rental_data['fuel_terms'] == "Full to Full"

def test_invoice_custom_fields(client, auth_headers):
    # Setup prerequisite customer via API
    cust_res = client.post('/api/v1/customers', json={
        "name": "Invoice Cust",
        "phone": "5678",
        "email": "invoice@cust.com"
    }, headers=auth_headers)
    assert cust_res.status_code == 201, cust_res.json
    cust_id = cust_res.json['data']['id']

    # Setup prerequisite product via API
    prod_res = client.post('/api/v1/products', json={
        "name": "Invoice Product",
        "sku": "INV-PROD-99",
        "purchase_price": 100.0,
        "selling_price": 200.0,
        "gst_rate": 18.0
    }, headers=auth_headers)
    assert prod_res.status_code == 201, prod_res.json
    prod_id = prod_res.json['data']['id']

    payload = {
        "customer_id": cust_id,
        "type": "Sales",
        "payment_method": "Cash",
        "payment_status": "Paid",
        "notes": "Test invoice custom fields",
        "is_pos": True,
        "items": [
            {
                "product_id": prod_id,
                "product_name": "Invoice Product",
                "hsn_code": "1234",
                "qty": 1,
                "rate": 200.0,
                "discount_percent": 0.0,
                "tax_percent": 18.0
            }
        ],
        "delivery_method": "Self Pick", # Dynamic
        "warranty_card_issued": "Yes"    # Dynamic
    }
    res = client.post('/api/v1/invoices', json=payload, headers=auth_headers)
    assert res.status_code == 201, res.json
    inv_data = res.json['data']

    assert inv_data['invoice_number'] is not None
    assert inv_data['delivery_method'] == "Self Pick"
    assert inv_data['warranty_card_issued'] == "Yes"

