"""
Test Billing Flow - End-to-End Test for Invoice Generation
This test simulates the complete billing flow from the POS terminal
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.user import User
from app.models.tenant import Company, Branch
from app.models.customer import Customer
from app.models.product import Product
from app.models.sales import Invoice, InvoiceItem


@pytest.fixture
def app():
    """Create application for testing"""
    app = create_app('test')
    
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Create authenticated user and return auth headers"""
    with client.application.app_context():
        # Create tenant first
        from app.models.tenant import Tenant
        tenant = Tenant(
            name='Test Tenant',
            subdomain='testcompany',
            db_status='active',
            is_active=True,
            business_type='Construction & Heavy Equipment',
            contact_email='tenant@test.com',
            contact_phone='9876543210'
        )
        db.session.add(tenant)
        db.session.flush()
        
        # Create company
        company = Company(
            tenant_id=tenant.id,
            name='Test Company',
            gstin='29ABCDE1234F1Z5',
            pan='ABCDE1234F',
            email='test@company.com',
            phone='9876543210',
            address='Test Address',
            city='Test City',
            state='Karnataka',
            pincode='560001'
        )
        db.session.add(company)
        db.session.flush()
        
        # Create branch
        branch = Branch(
            tenant_id=tenant.id,
            company_id=company.id,
            name='Main Branch',
            code='MAIN',
            address='Test Branch Address',
            city='Test City',
            state='Karnataka',
            pincode='560001',
            phone='9876543210',
            is_main=True
        )
        db.session.add(branch)
        db.session.flush()
        
        # Create user
        user = User(
            tenant_id=tenant.id,
            company_id=company.id,
            branch_id=branch.id,
            name='Test User',
            email='testuser@test.com'
        )
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()
    
    # Login
    response = client.post('/api/v1/auth/login', json={
        'email': 'testuser@test.com',
        'password': 'password123'
    })
    
    assert response.status_code == 200
    token = response.json['data']['tokens']['access_token']
    
    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }


@pytest.fixture
def test_customer(client, auth_headers):
    """Create a test customer"""
    customer_data = {
        'name': 'Test Customer',
        'phone': '9876543210',
        'email': 'customer@test.com',
        'address': 'Customer Address',
        'city': 'Test City',
        'state': 'Karnataka',
        'pincode': '560001',
        'gstin': '29XYZAB1234C1Z5'
    }
    
    response = client.post('/api/v1/customers', 
                          json=customer_data, 
                          headers=auth_headers)
    
    assert response.status_code == 201
    return response.json['data']


@pytest.fixture
def test_products(client, auth_headers):
    """Create test products"""
    products = []
    
    product_data_list = [
        {
            'name': 'Excavator Rental',
            'category': 'Heavy Equipment',
            'hsn_code': '8429',
            'unit': 'Day',
            'purchase_price': 5000,
            'selling_price': 8000,
            'gst_rate': 18,
            'stock_quantity': 10,
            'reorder_level': 2,
            'is_service': False
        },
        {
            'name': 'Bulldozer Rental',
            'category': 'Heavy Equipment',
            'hsn_code': '8429',
            'unit': 'Day',
            'purchase_price': 6000,
            'selling_price': 10000,
            'gst_rate': 18,
            'stock_quantity': 5,
            'reorder_level': 1,
            'is_service': False
        },
        {
            'name': 'Installation Service',
            'category': 'Services',
            'hsn_code': '9954',
            'unit': 'Service',
            'purchase_price': 0,
            'selling_price': 5000,
            'gst_rate': 18,
            'stock_quantity': 999,
            'reorder_level': 0,
            'is_service': True
        }
    ]
    
    for product_data in product_data_list:
        response = client.post('/api/v1/products', 
                              json=product_data, 
                              headers=auth_headers)
        assert response.status_code == 201
        products.append(response.json['data'])
    
    return products


def test_complete_billing_flow(client, auth_headers, test_customer, test_products):
    """
    Test Case 1: Complete Billing Flow - Sales Invoice
    Simulates user selecting customer, adding items, and generating invoice
    """
    print("\n" + "="*60)
    print("TEST: Complete Billing Flow - Sales Invoice")
    print("="*60)
    
    # Step 1: Prepare invoice data
    invoice_data = {
        'customer_id': test_customer['id'],
        'type': 'Sales',
        'payment_method': 'Cash',
        'payment_status': 'Paid',
        'notes': 'Test invoice from automated billing test',
        'is_pos': True,
        'items': [
            {
                'product_id': test_products[0]['id'],
                'product_name': test_products[0]['name'],
                'hsn_code': test_products[0]['hsn_code'],
                'qty': 2,
                'rate': test_products[0]['selling_price'],
                'discount_percent': 5,
                'tax_percent': 18
            },
            {
                'product_id': test_products[1]['id'],
                'product_name': test_products[1]['name'],
                'hsn_code': test_products[1]['hsn_code'],
                'qty': 1,
                'rate': test_products[1]['selling_price'],
                'discount_percent': 0,
                'tax_percent': 18
            }
        ]
    }
    
    print(f"\n✓ Customer Selected: {test_customer['name']}")
    print(f"✓ Items Added: {len(invoice_data['items'])}")
    for idx, item in enumerate(invoice_data['items'], 1):
        print(f"  {idx}. {item['product_name']} - Qty: {item['qty']} @ ₹{item['rate']}")
    
    # Step 2: Generate Invoice (simulate button click / F8 press)
    print("\n🔄 Generating Invoice... (Simulating 'Complete & Generate' button click)")
    
    response = client.post('/api/v1/invoices', 
                          json=invoice_data, 
                          headers=auth_headers)
    
    # Step 3: Verify Response
    print(f"\nResponse Status: {response.status_code}")
    
    if response.status_code != 201:
        print(f"❌ FAILED: {response.json}")
        assert False, f"Invoice creation failed: {response.json}"
    
    invoice = response.json['data']
    
    print(f"✅ SUCCESS: Invoice Generated!")
    print(f"\n📄 Invoice Details:")
    print(f"   Invoice Number: {invoice['invoice_number']}")
    print(f"   Invoice Date: {invoice['invoice_date']}")
    print(f"   Customer: {test_customer['name']}")
    print(f"   Payment Method: {invoice['payment_method']}")
    print(f"   Payment Status: {invoice['payment_status']}")
    print(f"   Subtotal: ₹{invoice['subtotal']}")
    print(f"   Tax Amount: ₹{invoice['tax_amount']}")
    print(f"   Total Amount: ₹{invoice['total_amount']}")
    print(f"   Items Count: {len(invoice['items'])}")
    
    # Step 4: Verify Invoice Data
    assert invoice['invoice_number'] is not None
    assert invoice['customer_id'] == test_customer['id']
    assert invoice['type'] == 'Sales'
    assert invoice['payment_method'] == 'Cash'
    assert invoice['payment_status'] == 'Paid'
    assert invoice['is_pos'] == True
    assert len(invoice['items']) == 2
    assert invoice['total_amount'] > 0
    
    print("\n✅ All assertions passed!")


def test_billing_with_credit_payment(client, auth_headers, test_customer, test_products):
    """
    Test Case 2: Billing with Credit Payment
    Test invoice generation with credit payment method
    """
    print("\n" + "="*60)
    print("TEST: Billing with Credit Payment")
    print("="*60)
    
    invoice_data = {
        'customer_id': test_customer['id'],
        'type': 'Sales',
        'payment_method': 'Credit',
        'payment_status': 'Unpaid',
        'notes': 'Credit invoice test',
        'is_pos': True,
        'items': [
            {
                'product_id': test_products[2]['id'],
                'product_name': test_products[2]['name'],
                'hsn_code': test_products[2]['hsn_code'],
                'qty': 1,
                'rate': test_products[2]['selling_price'],
                'discount_percent': 10,
                'tax_percent': 18
            }
        ]
    }
    
    print(f"\n✓ Payment Method: Credit")
    print(f"✓ Expected Payment Status: Unpaid")
    
    response = client.post('/api/v1/invoices', 
                          json=invoice_data, 
                          headers=auth_headers)
    
    assert response.status_code == 201
    invoice = response.json['data']
    
    print(f"\n✅ Invoice Generated: {invoice['invoice_number']}")
    print(f"   Payment Status: {invoice['payment_status']}")
    
    assert invoice['payment_method'] == 'Credit'
    assert invoice['payment_status'] == 'Unpaid'
    
    print("\n✅ Credit payment test passed!")


def test_billing_validation_no_customer(client, auth_headers, test_products):
    """
    Test Case 3: Validation - No Customer Selected
    Should fail when no customer is selected
    """
    print("\n" + "="*60)
    print("TEST: Validation - No Customer Selected")
    print("="*60)
    
    invoice_data = {
        'type': 'Sales',
        'payment_method': 'Cash',
        'payment_status': 'Paid',
        'is_pos': True,
        'items': [
            {
                'product_id': test_products[0]['id'],
                'product_name': test_products[0]['name'],
                'hsn_code': test_products[0]['hsn_code'],
                'qty': 1,
                'rate': test_products[0]['selling_price'],
                'discount_percent': 0,
                'tax_percent': 18
            }
        ]
    }
    
    response = client.post('/api/v1/invoices', 
                          json=invoice_data, 
                          headers=auth_headers)
    
    print(f"\nResponse Status: {response.status_code}")
    print(f"Expected: 400 (Bad Request)")
    
    assert response.status_code == 400
    print("\n✅ Validation correctly rejected invoice without customer!")


def test_billing_validation_no_items(client, auth_headers, test_customer):
    """
    Test Case 4: Validation - No Items Added
    Should fail when no items are added
    """
    print("\n" + "="*60)
    print("TEST: Validation - No Items Added")
    print("="*60)
    
    invoice_data = {
        'customer_id': test_customer['id'],
        'type': 'Sales',
        'payment_method': 'Cash',
        'payment_status': 'Paid',
        'is_pos': True,
        'items': []
    }
    
    response = client.post('/api/v1/invoices', 
                          json=invoice_data, 
                          headers=auth_headers)
    
    print(f"\nResponse Status: {response.status_code}")
    print(f"Expected: 400 (Bad Request)")
    
    assert response.status_code == 400
    print("\n✅ Validation correctly rejected invoice without items!")


def test_billing_upi_payment(client, auth_headers, test_customer, test_products):
    """
    Test Case 5: Billing with UPI Payment
    Test invoice generation with UPI payment method
    """
    print("\n" + "="*60)
    print("TEST: Billing with UPI Payment")
    print("="*60)
    
    invoice_data = {
        'customer_id': test_customer['id'],
        'type': 'Sales',
        'payment_method': 'UPI',
        'payment_status': 'Paid',
        'notes': 'UPI payment test',
        'is_pos': True,
        'items': [
            {
                'product_id': test_products[0]['id'],
                'product_name': test_products[0]['name'],
                'hsn_code': test_products[0]['hsn_code'],
                'qty': 1,
                'rate': test_products[0]['selling_price'],
                'discount_percent': 0,
                'tax_percent': 18
            }
        ]
    }
    
    print(f"\n✓ Payment Method: UPI")
    
    response = client.post('/api/v1/invoices', 
                          json=invoice_data, 
                          headers=auth_headers)
    
    assert response.status_code == 201
    invoice = response.json['data']
    
    print(f"\n✅ Invoice Generated: {invoice['invoice_number']}")
    print(f"   Payment Method: {invoice['payment_method']}")
    print(f"   Payment Status: {invoice['payment_status']}")
    
    assert invoice['payment_method'] == 'UPI'
    assert invoice['payment_status'] == 'Paid'
    
    print("\n✅ UPI payment test passed!")


if __name__ == '__main__':
    print("\n" + "="*60)
    print("BILLING FLOW TEST SUITE")
    print("Testing 'Complete & Generate (F8)' Functionality")
    print("="*60)
    
    pytest.main([__file__, '-v', '-s'])
