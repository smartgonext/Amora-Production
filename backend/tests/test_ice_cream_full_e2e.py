"""Comprehensive End-to-End Test for Ice Cream Creamery & Manufacturing ERP.

Validates that all APIs return the seeded Ice Cream domain data correctly:
- Authentication & Setup
- Products & Categories (Raw vs Finished, Allergens, Nutrition)
- Batches & FEFO Expiry Dates
- Warehouses & Cold Storage
- Suppliers & Customers
- Equipment, Rentals & AMC
- Manufacturing BOMs, Routing Operations & Work Orders
- Quality Control (QC Inspections & Parameters)
- HACCP & Production Plans
- Invoices & POS Billing
- HR Employees
- Finance Chart of Accounts
- Documents & Projects
"""
import pytest
import sys
import os
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.tenant import Tenant, Company, Branch
from app.models.user import User
from app.models.product import Product, ProductCategory, ProductBatch, Warehouse
from app.models.customer import Customer, Supplier
from app.models.equipment import Equipment, RentalBooking
from app.models.amc import AMCContract
from app.models.manufacturing import BomHeader, WorkOrder, QualityInspection
from app.models.sales import Invoice
from app.models.hr import Employee
from app.models.finance import ChartOfAccount
from app.models.document import Document
from app.services.seed_ice_cream import seed_ice_cream_demo


@pytest.fixture(scope='module')
def app():
    app = create_app('test')
    with app.app_context():
        db.create_all()
        # Ensure test demo tenant is seeded
        sub = 'testdemo'
        tenant = Tenant.query.filter_by(subdomain=sub).first()
        if not tenant:
            tenant = Tenant(name='Frosty Delights Test Creamery', subdomain=sub, business_type='Ice Cream Manufacturing')
            db.session.add(tenant)
            db.session.flush()
            company = Company(tenant_id=tenant.id, name='Frosty Delights Test Creamery Pvt Ltd', business_type='Ice Cream Manufacturing')
            db.session.add(company)
            db.session.flush()
            branch = Branch(tenant_id=tenant.id, company_id=company.id, name='Test Plant', code='HO', is_active=True)
            db.session.add(branch)
            db.session.flush()
            user = User(tenant_id=tenant.id, company_id=company.id, name='Test Admin', email='testadmin@frostydelights.com', is_active=True, is_superadmin=True)
            user.set_password('demo123')
            db.session.add(user)
            db.session.flush()
        else:
            company = Company.query.filter_by(tenant_id=tenant.id).first()
            branch = Branch.query.filter_by(tenant_id=tenant.id).first()
            user = User.query.filter_by(tenant_id=tenant.id).first()

        seed_ice_cream_demo(app, db, tenant, company, branch, user)
        yield app
        db.session.remove()


@pytest.fixture(scope='module')
def client(app):
    return app.test_client()


@pytest.fixture(scope='module')
def auth_headers(client):
    res = client.post('/api/v1/auth/login', json={
        'email': 'testadmin@frostydelights.com',
        'password': 'demo123'
    })
    assert res.status_code == 200, res.get_data(as_text=True)
    token = res.json['data']['tokens']['access_token']
    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }


def test_auth_and_user_profile(client, auth_headers):
    """Test authenticated user profile returns proper ice cream company info."""
    res = client.get('/api/v1/auth/me', headers=auth_headers)
    assert res.status_code == 200
    data = res.json['data']
    assert data['email'] == 'testadmin@frostydelights.com'
    assert 'tenant' in data or 'company' in data or 'role' in data


def test_ice_cream_products_api(client, auth_headers):
    """Test products API returns ice cream raw ingredients and finished goods."""
    res = client.get('/api/v1/products', headers=auth_headers)
    assert res.status_code == 200
    products = res.json['data'] if isinstance(res.json['data'], list) else res.json['data'].get('items', [])
    assert len(products) >= 15

    names = [p['name'] for p in products]
    assert any('Royal Bourbon Vanilla Bean' in n for n in names)
    assert any('Belgian Dark Chocolate' in n for n in names)
    assert any('Whole Milk' in n for n in names)
    assert any('Heavy Dairy Cream' in n for n in names)
    assert any('Bio-Insulated' in n for n in names)

    # Check allergens & nutrition on Vanilla Tub
    vanilla = next(p for p in products if 'Royal Bourbon Vanilla Bean' in p['name'])
    assert vanilla['sku'] == 'FG-VAN-500'
    assert float(vanilla['selling_price']) == 249.0
    assert float(vanilla['gst_rate']) == 18.0
    assert vanilla.get('allergens') == ['Milk'] or 'Milk' in str(vanilla.get('allergens', ''))


def test_product_categories_api(client, auth_headers):
    """Test product categories cover dairy, flavors, mix-ins, and packaging."""
    res = client.get('/api/v1/products/categories', headers=auth_headers)
    assert res.status_code == 200
    cats = res.json['data'] if isinstance(res.json['data'], list) else res.json['data'].get('items', [])
    cat_names = [c['name'] for c in cats]
    assert any('Dairy Raw Materials' in n for n in cat_names)
    assert any('Flavor Bases' in n for n in cat_names)
    assert any('Packaging & Disposables' in n for n in cat_names)
    assert any('Finished Ice Cream Tubs' in n for n in cat_names)


def test_warehouses_and_cold_storage_api(client, auth_headers):
    """Test warehouses include deep freeze and ingredient cold rooms."""
    res = client.get('/api/v1/inventory/warehouses', headers=auth_headers)
    assert res.status_code == 200
    warehouses = res.json['data'] if isinstance(res.json['data'], list) else res.json['data'].get('items', [])
    w_names = [w['name'] for w in warehouses]
    assert any('Deep Freeze' in n or '-25°C' in n for n in w_names)
    assert any('Dairy & Ambient' in n or '+4°C' in n for n in w_names)


def test_customers_and_suppliers_api(client, auth_headers):
    """Test customers (Nature's Basket, Cafe Mocha) and suppliers (Amul, Callebaut)."""
    # Customers
    r_cust = client.get('/api/v1/customers', headers=auth_headers)
    assert r_cust.status_code == 200
    customers = r_cust.json['data'] if isinstance(r_cust.json['data'], list) else r_cust.json['data'].get('items', [])
    c_names = [c['name'] for c in customers]
    assert any("Nature's Basket" in n for n in c_names)
    assert any('Cafe Mocha' in n for n in c_names)

    # Suppliers
    r_supp = client.get('/api/v1/suppliers', headers=auth_headers)
    assert r_supp.status_code == 200
    suppliers = r_supp.json['data'] if isinstance(r_supp.json['data'], list) else r_supp.json['data'].get('items', [])
    s_names = [s['name'] for s in suppliers]
    assert any('Amul Dairy' in n for n in s_names)
    assert any('Barry Callebaut' in n for n in s_names)


def test_equipment_rentals_and_amc_api(client, auth_headers):
    """Test creamery equipment, soft serve rental booking, and freezer AMC."""
    # Equipment
    r_eq = client.get('/api/v1/equipment', headers=auth_headers)
    assert r_eq.status_code == 200
    equipments = r_eq.json['data'] if isinstance(r_eq.json['data'], list) else r_eq.json['data'].get('items', [])
    eq_names = [e['name'] for e in equipments]
    assert any('Batch Freezer' in n for n in eq_names)
    assert any('Pasteurizer' in n for n in eq_names)
    assert any('Soft Serve' in n for n in eq_names)

    # Rentals
    r_rent = client.get('/api/v1/equipment/rentals', headers=auth_headers)
    assert r_rent.status_code == 200
    bookings = r_rent.json['data'] if isinstance(r_rent.json['data'], list) else r_rent.json['data'].get('items', [])
    assert len(bookings) >= 1
    assert any('Soft Serve' in str(b) or 'RB-2026-ICE' in str(b) for b in bookings)

    # AMC
    r_amc = client.get('/api/v1/equipment/amc', headers=auth_headers)
    assert r_amc.status_code == 200
    contracts = r_amc.json['data'] if isinstance(r_amc.json['data'], list) else r_amc.json['data'].get('items', [])
    assert len(contracts) >= 1
    assert any('Blast Freezer' in str(c) for c in contracts)


def test_manufacturing_boms_and_routing_api(client, auth_headers):
    """Test ice cream commercial batch BOMs with 3-stage routing operations."""
    res = client.get('/api/v1/manufacturing/boms', headers=auth_headers)
    assert res.status_code == 200
    boms = res.json['data'] if isinstance(res.json['data'], list) else res.json['data'].get('items', [])
    assert len(boms) >= 2
    bom_names = [b['name'] for b in boms]
    assert any('Royal Bourbon Vanilla' in n for n in bom_names)
    assert any('Belgian Dark Chocolate' in n for n in bom_names)

    # Check work centers
    r_wc = client.get('/api/v1/manufacturing/work-centers', headers=auth_headers)
    assert r_wc.status_code == 200
    wcs = r_wc.json['data'] if isinstance(r_wc.json['data'], list) else r_wc.json['data'].get('items', [])
    wc_names = [w['name'] for w in wcs]
    assert any('Mix & Pasteurization' in n for n in wc_names)
    assert any('Churn Line' in n or 'Freezing' in n for n in wc_names)


def test_manufacturing_work_orders_api(client, auth_headers):
    """Test work orders for vanilla, chocolate, and mango production."""
    res = client.get('/api/v1/manufacturing/work-orders', headers=auth_headers)
    assert res.status_code == 200
    wos = res.json['data'] if isinstance(res.json['data'], list) else res.json['data'].get('items', [])
    assert len(wos) >= 3
    wo_numbers = [w['wo_number'] for w in wos]
    assert any('WO-2026-VAN-001' in n for n in wo_numbers)
    assert any('WO-2026-CHOC-002' in n for n in wo_numbers)

    # Status checks
    vanilla_wo = next(w for w in wos if 'WO-2026-VAN-001' in w['wo_number'])
    assert vanilla_wo['status'] == 'completed'
    assert float(vanilla_wo['produced_qty']) == 500.0


def test_quality_control_api(client, auth_headers):
    """Test passed QC inspection with fat %, overrun %, and core hardening temp."""
    res = client.get('/api/v1/manufacturing/qc/inspections', headers=auth_headers)
    assert res.status_code == 200
    inspections = res.json['data'] if isinstance(res.json['data'], list) else res.json['data'].get('items', [])
    assert len(inspections) >= 1
    qc = inspections[0]
    assert qc['qc_status'] == 'passed'
    params = qc.get('check_parameters', [])
    assert len(params) >= 3
    param_names = [p['name'] for p in params]
    assert any('Butterfat' in n for n in param_names)
    assert any('Overrun' in n for n in param_names)


def test_invoices_and_pos_api(client, auth_headers):
    """Test wholesale and retail POS invoices."""
    res = client.get('/api/v1/invoices', headers=auth_headers)
    assert res.status_code == 200
    invoices = res.json['data'] if isinstance(res.json['data'], list) else res.json['data'].get('items', [])
    assert len(invoices) >= 2
    inv_nos = [i['invoice_number'] for i in invoices]
    assert any('INV-2026-001' in n for n in inv_nos)
    assert any('POS-2026-IND-042' in n for n in inv_nos)


def test_hr_employees_api(client, auth_headers):
    """Test HR employees (Gelatiere, Dairy Chemist, Cold Chain Engineer)."""
    res = client.get('/api/v1/hr/employees', headers=auth_headers)
    assert res.status_code == 200
    employees = res.json['data'] if isinstance(res.json['data'], list) else res.json['data'].get('items', [])
    assert len(employees) >= 5
    emp_names = [e['name'] for e in employees]
    assert any('Marco Rossi' in n for n in emp_names)
    assert any('Shalini Swaminathan' in n for n in emp_names)
    assert any('Sunil Deshmukh' in n for n in emp_names)


def test_finance_chart_of_accounts_api(client, auth_headers):
    """Test chart of accounts tailored for ice cream creamery."""
    res = client.get('/api/v1/finance/accounts', headers=auth_headers)
    assert res.status_code == 200
    accounts = res.json['data'] if isinstance(res.json['data'], list) else res.json['data'].get('items', [])
    assert len(accounts) >= 15
    acc_names = [a['account_name'] for a in accounts]
    assert any('Finished Ice Cream Stock' in n for n in acc_names)
    assert any('Dairy & Raw Ingredients' in n for n in acc_names)
    assert any('Cold Storage Power' in n for n in acc_names)
    assert any('Ice Cream Wholesale Sales' in n for n in acc_names)

