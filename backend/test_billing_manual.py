"""
Manual Test Script for Billing Functionality
Tests the /api/invoices endpoint directly
Run this while the backend server is running
"""
import requests
import json

# Configuration
BASE_URL = "http://localhost:5000/api/v1"
TEST_EMAIL = "demo@smartgonext.com"  # Use existing user
TEST_PASSWORD = "demo123"

def print_section(title):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)

def test_billing_flow():
    """Test the complete billing flow"""
    
    print_section("BILLING FUNCTIONALITY TEST")
    print("This test simulates clicking 'Complete & Generate (F8)' button")
    
    # Step 1: Login
    print_section("Step 1: Login")
    print(f"Logging in as: {TEST_EMAIL}")
    
    login_response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    token = login_response.json()['data']['tokens']['access_token']
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    print("✅ Login successful!")
    print(f"Token: {token[:50]}...")
    
    # Step 2: Get Customers
    print_section("Step 2: Fetch Customers")
    customers_response = requests.get(f"{BASE_URL}/customers", headers=headers)
    
    if customers_response.status_code != 200:
        print(f"❌ Failed to fetch customers: {customers_response.text}")
        return
    
    customers = customers_response.json()['data']
    if len(customers) == 0:
        print("❌ No customers found. Please create a customer first.")
        return
    
    customer = customers[0]
    print(f"✅ Found {len(customers)} customers")
    print(f"Using customer: {customer['name']} (ID: {customer['id']})")
    
    # Step 3: Get Products
    print_section("Step 3: Fetch Products")
    products_response = requests.get(f"{BASE_URL}/products", headers=headers)
    
    if products_response.status_code != 200:
        print(f"❌ Failed to fetch products: {products_response.text}")
        return
    
    products = products_response.json()['data']
    if len(products) == 0:
        print("❌ No products found. Please create products first.")
        return
    
    print(f"✅ Found {len(products)} products")
    for idx, product in enumerate(products[:3], 1):
        print(f"  {idx}. {product['name']} - ₹{product['selling_price']}")
    
    # Step 4: Prepare Invoice Data
    print_section("Step 4: Prepare Invoice Data")
    
    invoice_data = {
        'customer_id': customer['id'],
        'type': 'Sales',
        'payment_method': 'Cash',
        'payment_status': 'Paid',
        'notes': 'Test invoice from automated test script',
        'is_pos': True,
        'items': []
    }
    
    # Add first 2 products to invoice
    for product in products[:2]:
        item = {
            'product_id': product['id'],
            'product_name': product['name'],
            'hsn_code': product.get('hsn_code', '8429'),
            'qty': 2,
            'rate': product['selling_price'],
            'discount_percent': 5,
            'tax_percent': product.get('gst_rate', 18)
        }
        invoice_data['items'].append(item)
    
    print("Invoice Configuration:")
    print(f"  Customer: {customer['name']}")
    print(f"  Type: {invoice_data['type']}")
    print(f"  Payment Method: {invoice_data['payment_method']}")
    print(f"  Items: {len(invoice_data['items'])}")
    for idx, item in enumerate(invoice_data['items'], 1):
        print(f"    {idx}. {item['product_name']} - Qty: {item['qty']} @ ₹{item['rate']}")
    
    # Step 5: Generate Invoice (Simulate Button Click)
    print_section("Step 5: Generate Invoice")
    print("🔄 Simulating 'Complete & Generate (F8)' button click...")
    print("Sending POST request to /api/invoices...")
    
    try:
        invoice_response = requests.post(
            f"{BASE_URL}/invoices",
            json=invoice_data,
            headers=headers,
            timeout=10
        )
        
        print(f"\nResponse Status Code: {invoice_response.status_code}")
        print(f"Response Headers: {dict(invoice_response.headers)}")
        
        if invoice_response.status_code == 201:
            invoice = invoice_response.json()['data']
            
            print("\n" + "🎉"*35)
            print("✅ SUCCESS! INVOICE GENERATED!")
            print("🎉"*35)
            
            print("\n📄 Invoice Details:")
            print(f"   Invoice Number: {invoice['invoice_number']}")
            print(f"   Invoice Date: {invoice['invoice_date']}")
            print(f"   Customer: {customer['name']}")
            print(f"   Type: {invoice['type']}")
            print(f"   Payment Method: {invoice['payment_method']}")
            print(f"   Payment Status: {invoice['payment_status']}")
            print(f"   ")
            print(f"   Subtotal: ₹{invoice.get('subtotal', 0):.2f}")
            print(f"   Tax Amount: ₹{invoice.get('tax_amount', 0):.2f}")
            print(f"   Discount: ₹{invoice.get('discount_amount', 0):.2f}")
            print(f"   Total Amount: ₹{invoice.get('total_amount', 0):.2f}")
            print(f"   ")
            print(f"   Items Count: {len(invoice.get('items', []))}")
            
            if 'items' in invoice:
                print("\n   Line Items:")
                for idx, item in enumerate(invoice['items'], 1):
                    print(f"     {idx}. {item.get('product_name')} - "
                          f"Qty: {item.get('qty')} @ ₹{item.get('rate')} = "
                          f"₹{item.get('line_total', 0):.2f}")
            
            print("\n" + "="*70)
            print("✅ BUTTON FUNCTIONALITY WORKING CORRECTLY!")
            print("="*70)
            
            return True
            
        else:
            print(f"\n❌ FAILED! Invoice creation failed")
            print(f"Status Code: {invoice_response.status_code}")
            print(f"Response: {invoice_response.text}")
            
            try:
                error_data = invoice_response.json()
                if 'errors' in error_data:
                    print(f"\nErrors:")
                    for error in error_data['errors']:
                        print(f"  - {error}")
                if 'message' in error_data:
                    print(f"\nMessage: {error_data['message']}")
            except:
                pass
            
            return False
            
    except requests.exceptions.Timeout:
        print("\n❌ Request timed out! Server might be slow or not responding.")
        return False
    except requests.exceptions.ConnectionError:
        print("\n❌ Connection error! Is the backend server running on http://localhost:5000?")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        return False

if __name__ == "__main__":
    print("\n" + "#"*70)
    print("  BILLING PAGE - Complete & Generate (F8) - FUNCTIONALITY TEST")
    print("#"*70)
    print("\nPrerequisites:")
    print("  1. Backend server must be running on http://localhost:5000")
    print("  2. At least one customer must exist in the system")
    print("  3. At least one product must exist in the system")
    print("  4. User credentials must be valid")
    print("\nStarting test...")
    
    try:
        success = test_billing_flow()
        
        if success:
            print("\n" + "🎊"*35)
            print("ALL TESTS PASSED!")
            print("The 'Complete & Generate (F8)' button is working correctly!")
            print("🎊"*35)
        else:
            print("\n" + "⚠️"*35)
            print("TEST FAILED - Please check the errors above")
            print("⚠️"*35)
            
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user.")
    except Exception as e:
        print(f"\n\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
