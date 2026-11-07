import urllib.request
import json

def test_frontend_api_proxy():
    # 1. Test Login through frontend proxy (port 3000 -> 5000)
    login_payload = json.dumps({'email': 'demo@smartgonext.com', 'password': 'demo123'}).encode('utf-8')
    req = urllib.request.Request('http://localhost:3000/api/v1/auth/login', data=login_payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        token = data['data']['tokens']['access_token']
        print('[OK] LOGIN VIA FRONTEND PROXY SUCCESS! Token acquired.')

    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

    # 2. Test Products
    req = urllib.request.Request('http://localhost:3000/api/v1/products', headers=headers)
    with urllib.request.urlopen(req) as resp:
        prods = json.loads(resp.read().decode('utf-8'))['data']
        print(f'[OK] PRODUCTS VIA FRONTEND PROXY: {len(prods)} items found.')
        sample_names = [p['name'] for p in prods[:4]]
        print('    Samples:', sample_names)

    # 3. Test Manufacturing BOMs
    req = urllib.request.Request('http://localhost:3000/api/v1/manufacturing/boms', headers=headers)
    with urllib.request.urlopen(req) as resp:
        boms = json.loads(resp.read().decode('utf-8'))['data']
        print(f'[OK] MFG BOMS VIA FRONTEND PROXY: {len(boms)} formulas found.')
        for b in boms:
            print(f'    Formula: {b["name"]}')

    # 4. Test Work Orders
    req = urllib.request.Request('http://localhost:3000/api/v1/manufacturing/work-orders', headers=headers)
    with urllib.request.urlopen(req) as resp:
        wos = json.loads(resp.read().decode('utf-8'))['data']
        print(f'[OK] WORK ORDERS VIA FRONTEND PROXY: {len(wos)} orders found.')
        for w in wos:
            print(f'    Order: {w["wo_number"]} - Status: {w["status"]}')

    # 5. Test Customers & Suppliers
    req = urllib.request.Request('http://localhost:3000/api/v1/customers', headers=headers)
    with urllib.request.urlopen(req) as resp:
        custs = json.loads(resp.read().decode('utf-8'))['data']
        print(f'[OK] CUSTOMERS VIA FRONTEND PROXY: {len(custs)} found: {[c["name"] for c in custs[:3]]}')

    req = urllib.request.Request('http://localhost:3000/api/v1/suppliers', headers=headers)
    with urllib.request.urlopen(req) as resp:
        supps = json.loads(resp.read().decode('utf-8'))['data']
        print(f'[OK] SUPPLIERS VIA FRONTEND PROXY: {len(supps)} found: {[s["name"] for s in supps[:3]]}')

    # 6. Test Equipment & Rentals
    req = urllib.request.Request('http://localhost:3000/api/v1/equipment', headers=headers)
    with urllib.request.urlopen(req) as resp:
        eqs = json.loads(resp.read().decode('utf-8'))['data']
        print(f'[OK] EQUIPMENT VIA FRONTEND PROXY: {len(eqs)} assets found: {[e["name"] for e in eqs[:3]]}')

    req = urllib.request.Request('http://localhost:3000/api/v1/equipment/rentals', headers=headers)
    with urllib.request.urlopen(req) as resp:
        rentals = json.loads(resp.read().decode('utf-8'))['data']
        print(f'[OK] RENTALS VIA FRONTEND PROXY: {len(rentals)} bookings found.')

    # 7. Test Invoices & POS
    req = urllib.request.Request('http://localhost:3000/api/v1/invoices', headers=headers)
    with urllib.request.urlopen(req) as resp:
        invs = json.loads(resp.read().decode('utf-8'))['data']
        print(f'[OK] INVOICES VIA FRONTEND PROXY: {len(invs)} bills found: {[i["invoice_number"] for i in invs]}')

    # 8. Test HR Employees
    req = urllib.request.Request('http://localhost:3000/api/v1/hr/employees', headers=headers)
    with urllib.request.urlopen(req) as resp:
        emps = json.loads(resp.read().decode('utf-8'))['data']
        print(f'[OK] HR EMPLOYEES VIA FRONTEND PROXY: {len(emps)} employees found: {[e["name"] for e in emps[:3]]}')

    # 9. Test Finance Accounts
    req = urllib.request.Request('http://localhost:3000/api/v1/finance/accounts', headers=headers)
    with urllib.request.urlopen(req) as resp:
        accs = json.loads(resp.read().decode('utf-8'))['data']
        print(f'[OK] FINANCE ACCOUNTS VIA FRONTEND PROXY: {len(accs)} accounts found.')

    print('\n============================================================')
    print('ALL FRONTEND-TO-BACKEND APIS CONNECTED & VERIFIED 100%!')
    print('============================================================')

if __name__ == '__main__':
    test_frontend_api_proxy()
