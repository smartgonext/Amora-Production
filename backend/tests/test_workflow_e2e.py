"""
SmartGoNext Universal ERP — Full Project End-To-End Workflow Test
==================================================================
Walks through the ENTIRE product API one module at a time, exactly like a user
would use the application, and exercises CRUD + read APIs across every route:

  1. Health checks
  2. Auth: register / login / me / select-branch
  3. Setup wizard: company, business-type, tax-settings, all 6 template
     designers (invoice, quotation, agreement, receipt, purchase_order,
     delivery_challan), number-series, finish, status
  4. Products CRUD
  5. Suppliers CRUD
  6. Purchases (PO, GRN, returns)
  7. Inventory (warehouses, transfers, adjustments, ledger)
  8. HR (employees, attendance, monthly, payroll)
  9. Customers CRUD
  10. Sales (quotations, orders, challans, returns, receipts)
  11. Invoices CRUD
  12. Users / Roles / Permissions
  13. Branches
  14. Companies & settings
  15. Finance (accounts, cash, bank, expenses, categories, payments)
  16. Documents
  17. Reports
  18. Global search
  19. Notifications
  20. Event bus
  21. Custom fields / form builder
  22. Devices
  23. Backup
  24. Licensing / subscriptions
  25. Settings / number series

Soft-assert style: every API call is recorded PASS/FAIL with the reason, and a
failure NEVER blocks the next API from being exercised ("check anything fail,
log the reason, go next API"). A final summary is printed and a minimum set of
critical steps must pass.

Run (from d:\\ERP\\backend):
    ..\\venv\\Scripts\\python.exe -m pytest tests/test_workflow_e2e.py -v -s --tb=short
"""

import pytest
import uuid


# ---------------------------------------------------------------------------
# App fixture (SQLite in-memory, self-contained)
# ---------------------------------------------------------------------------
@pytest.fixture(scope='session')
def app():
    import os
    os.environ['FLASK_ENV'] = 'testing'

    from app import create_app
    test_app = create_app('test', config_overrides={
        'JWT_SECRET_KEY': 'test-jwt-secret-key-workflow',
        'JWT_ACCESS_TOKEN_EXPIRES': False,
        'JWT_REFRESH_TOKEN_EXPIRES': False,
        'WTF_CSRF_ENABLED': False,
    })

    from app.extensions import db
    with test_app.app_context():
        db.create_all()   # idempotent: creates any missing tables on MySQL
        yield test_app
        db.session.remove()


@pytest.fixture(scope='session')
def client(app):
    return app.test_client()


# ---------------------------------------------------------------------------
# Soft-assert checker + shared state
# ---------------------------------------------------------------------------
RESULTS = []          # list of (status, label, detail)
STATE = {}            # shared ids / tokens across steps
CRITICAL = []         # critical checks that must pass at the end

def record(status, label, detail=''):
    RESULTS.append((status, label, detail))
    print(f"      [{status:<4}] {label}" + (f"   -> {detail}" if detail else ""))


def check(ok, label, detail='', critical=False):
    status = 'PASS' if ok else 'FAIL'
    record(status, label, detail)
    if critical:
        CRITICAL.append((status, label, detail))
    return ok


def go(client, label, method, url, payload=None, params=None, expect=None,
       auth=True):
    """Fire one API call, record PASS/FAIL with reason, keep going regardless."""
    method = method.lower()
    headers = {'Content-Type': 'application/json'}
    if auth and STATE.get('token'):
        headers['Authorization'] = f"Bearer {STATE['token']}"

    fn = getattr(client, method)
    try:
        if method == 'get':
            resp = fn(url, headers=headers, query_string=params)
        else:
            resp = fn(url, json=payload, headers=headers, query_string=params)
    except Exception as e:                     # defensive
        record('FAIL', label, f'EXCEPTION {e!r}')
        _rollback_db()
        return None

    code = resp.status_code
    body = None
    try:
        body = resp.get_json()
    except Exception:
        body = None

    detail = ''
    ok = True
    if expect is not None and code != expect:
        ok = False
        detail = f'expect HTTP {expect}, got {code}'
    if body is not None and isinstance(body, dict) and body.get('errors'):
        detail = (detail + '; ' if detail else '') + f"errors={body['errors']}"

    record('PASS' if ok else 'FAIL', label, detail)
    _rollback_db()
    return (code, body)


def _rollback_db():
    """Clear any pending/rolled-back transaction so one failure never blocks
    the remaining API calls."""
    try:
        from app.extensions import db
        db.session.rollback()
    except Exception:
        pass


def _extract(resp, key, default=None):
    """Pull `key` out of a (code, body) response tuple safely."""
    try:
        return resp[1]['data'][key]
    except Exception:
        return default


def _run_section(name, client, fn):
    print(f"\n--- {name} ---")
    try:
        fn(client)
    except Exception as e:                     # defensive
        record('FAIL', f'{name} section crashed', f'{e!r}')


# ===========================================================================
# ORCHESTRATOR — runs every module in the correct business order
# ===========================================================================
def test_full_project_end_to_end_workflow(client):
    _run_section('1. Health', client, _health)
    _run_section('2. Auth', client, _auth)
    if not STATE.get('token'):
        record('FAIL', 'Abort remaining steps', 'No auth token obtained')
    else:
        _run_section('3. Setup Wizard', client, _setup)
        _run_section('4. Products', client, _products)
        _run_section('5. Suppliers', client, _suppliers)
        _run_section('6. Purchases', client, _purchases)
        _run_section('7. Inventory', client, _inventory)
        _run_section('8. HR', client, _hr)
        _run_section('9. Customers', client, _customers)
        _run_section('10. Sales', client, _sales)
        _run_section('11. Invoices', client, _invoices)
        _run_section('12. Users/Roles', client, _users_roles)
        _run_section('13. Branches', client, _branches)
        _run_section('14. Companies/Settings', client, _companies_settings)
        _run_section('15. Finance', client, _finance)
        _run_section('16. Documents', client, _documents)
        _run_section('17. Reports', client, _reports)
        _run_section('18. Search', client, _search)
        _run_section('19. Notifications', client, _notifications)
        _run_section('20. Event Bus', client, _events)
        _run_section('21. Custom Fields', client, _custom_fields)
        _run_section('22. Devices', client, _devices)
        _run_section('23. Backup', client, _backup)
        _run_section('24. Licensing/Subscriptions', client, _licensing)
        _run_section('25. Settings', client, _settings)
        _run_section('26. Delete (safe-delete)', client, _delete_checks)

    _print_summary()


def _print_summary():
    passed = sum(1 for s, _, _ in RESULTS if s == 'PASS')
    failed = len(RESULTS) - passed
    print("\n" + "=" * 78)
    print(f"WORKFLOW SUMMARY  —  PASS: {passed}  FAIL: {failed}  TOTAL: {len(RESULTS)}")
    print("=" * 78)
    if failed:
        print("FAILED API CALLS (with reason):")
        for s, label, detail in RESULTS:
            if s == 'FAIL':
                print(f"   [FAIL] {label}" + (f"   -> {detail}" if detail else ""))
    print("=" * 78)

    critical_failed = [r for r in CRITICAL if r[0] == 'FAIL']
    if critical_failed:
        raise AssertionError(
            f"{len(critical_failed)} critical workflow steps failed: "
            + "; ".join(f"{l} ({d})" for _, l, d in critical_failed))

# ===========================================================================
# 1. HEALTH
# ===========================================================================
def _health(client):
    go(client, 'GET /health', 'GET', '/api/v1/health', expect=200)
    go(client, 'GET /health/ready', 'GET', '/api/v1/health/ready', expect=200)
    go(client, 'GET / (gateway)', 'GET', '/', expect=200)


# ===========================================================================
# 2. AUTH — register, login, me, select-branch
# ===========================================================================
def _auth(client):
    sub = f"wf{uuid.uuid4().hex[:8]}"
    email = f"admin@{sub}.com"
    pwd = "Passw0rd!"

    r = go(client, 'AUTH register', 'POST', '/api/v1/auth/register', {
        'company_name': 'Workflow ERP Co', 'subdomain': sub, 'email': email,
        'password': pwd, 'admin_name': 'Admin', 'business_type': 'Retail',
    }, expect=201, auth=False)
    check(r is not None and r[1] and r[1].get('data'), 'AUTH register returns data',
          critical=True)
    STATE['email'] = email
    STATE['password'] = pwd
    if r and r[1] and r[1].get('data'):
        STATE['token'] = r[1]['data']['tokens']['access_token']
        STATE['company_id'] = r[1]['data']['company']['id']

    r = go(client, 'AUTH login', 'POST', '/api/v1/auth/login',
           {'email': email, 'password': pwd}, expect=200, auth=False)
    check(r is not None and r[1] and r[1].get('data'), 'AUTH login returns data',
          critical=True)
    if r and r[1] and r[1].get('data'):
        STATE['token'] = r[1]['data']['tokens']['access_token']
        STATE['user_id'] = r[1]['data']['user']['id']

    go(client, 'AUTH /me', 'GET', '/api/v1/auth/me', expect=200)
    r = go(client, 'AUTH select-branch (clear)', 'POST', '/api/v1/auth/select-branch',
           {'branch_id': None}, expect=200)
    if r and r[1] and r[1].get('data', {}).get('access_token'):
        STATE['token'] = r[1]['data']['access_token']


# ===========================================================================
# 3. SETUP WIZARD — company, business type, tax, 6 templates, series, finish
# ===========================================================================
def _setup(client):
    go(client, 'SETUP update company', 'PUT', '/api/v1/setup/company', {
        'name': 'Workflow ERP Co', 'address': '1 Main Road, Pune',
        'city': 'Pune', 'state': 'MH', 'pincode': '411001', 'gstin': '27ABCDE1234F1Z5',
        'email': STATE.get('email'), 'phone': '9800000000', 'currency': 'INR',
    }, expect=200)

    go(client, 'SETUP business-type', 'PUT', '/api/v1/setup/business-type',
       {'business_type': 'Retail'}, expect=200)

    go(client, 'SETUP tax-settings', 'PUT', '/api/v1/setup/tax-settings', {
        'gst_enabled': True, 'cgst_rate': 9.0, 'sgst_rate': 9.0,
        'igst_rate': 18.0, 'default_gst_rate': 18.0,
    }, expect=200)

    for doc in ['invoice', 'quotation', 'agreement', 'receipt',
                'purchase_order', 'delivery_challan']:
        r = go(client, f'SETUP GET template {doc}', 'GET',
               f'/api/v1/setup/templates/{doc}', expect=200)
        # default design must NOT be empty
        if r and r[1] and r[1].get('data'):
            layout = r[1]['data'].get('layout_json') or {}
            check(layout.get('elements'), f'SETUP {doc} default not empty',
                  critical=True)
        # save a custom layout (editable / changeable)
        go(client, f'SETUP save template {doc}', 'PUT',
           f'/api/v1/setup/templates/{doc}', {
               'name': 'Default', 'is_default': True,
               'layout_json': {'canvas_width': 595, 'canvas_height': 842,
                               'elements': [{
                                   'type': 'text', 'text': 'HELLO TEMPLATE',
                                   'x_pct': 10, 'y_pct': 5, 'w_pct': 50, 'h_pct': 5,
                                   'z_index': 1,
                               }]},
           }, expect=200)

    series = [{'document_type': d, 'prefix': p, 'starting_number': 1,
               'current_number': 1, 'padding': 5, 'reset_frequency': 'yearly'}
              for d, p in [('invoice', 'INV-'), ('quotation', 'QT-'),
                           ('purchase_order', 'PO-'), ('receipt', 'RCT-'),
                           ('delivery_challan', 'DC-')]]
    go(client, 'SETUP number-series PUT', 'PUT', '/api/v1/setup/number-series',
       series, expect=200)
    go(client, 'SETUP number-series GET', 'GET', '/api/v1/setup/number-series',
       expect=200)

    go(client, 'SETUP finish', 'POST', '/api/v1/setup/finish', {}, expect=200)
    go(client, 'SETUP status', 'GET', '/api/v1/setup/status', expect=200)


# ===========================================================================
# 4. PRODUCTS — CRUD
# ===========================================================================
def _products(client):
    r = go(client, 'PRODUCT create', 'POST', '/api/v1/products', {
        'name': 'Laptop Pro', 'sku': 'LAP-001', 'hsn_code': '84713000',
        'gst_rate': 18.0, 'purchase_price': 40000, 'selling_price': 50000,
        'opening_stock': 10, 'min_stock_level': 2,
    }, expect=201)
    pid = _extract(r, 'id')
    STATE['product_id'] = pid

    r = go(client, 'PRODUCT create service', 'POST', '/api/v1/products', {
        'name': 'Installation Service', 'is_service': True, 'selling_price': 1000,
    }, expect=201)
    STATE['service_id'] = _extract(r, 'id')

    go(client, 'PRODUCT list', 'GET', '/api/v1/products', expect=200)
    go(client, 'PRODUCT list search', 'GET', '/api/v1/products',
       params={'search': 'Laptop'}, expect=200)
    if pid:
        go(client, 'PRODUCT get', 'GET', f'/api/v1/products/{pid}', expect=200)
        go(client, 'PRODUCT update', 'PUT', f'/api/v1/products/{pid}',
           {'selling_price': 52000, 'current_stock': 12}, expect=200)


# ===========================================================================
# 5. SUPPLIERS — CRUD
# ===========================================================================
def _suppliers(client):
    r = go(client, 'SUPPLIER create', 'POST', '/api/v1/suppliers', {
        'name': 'Tech Supply House', 'phone': '9876500011',
        'email': 'supplier@texample.com', 'address': 'MIDC Pune',
        'city': 'Pune', 'gstin': '27SUPPL1234Q1Z5', 'credit_limit': 50000,
    }, expect=201)
    spid = _extract(r, 'id')
    STATE['supplier_id'] = spid

    go(client, 'SUPPLIER list', 'GET', '/api/v1/suppliers', expect=200)
    go(client, 'SUPPLIER search', 'GET', '/api/v1/suppliers',
       params={'search': 'Tech'}, expect=200)
    if spid:
        go(client, 'SUPPLIER get', 'GET', f'/api/v1/suppliers/{spid}', expect=200)
        go(client, 'SUPPLIER update', 'PUT', f'/api/v1/suppliers/{spid}',
           {'credit_limit': 100000}, expect=200)

# ===========================================================================
# 6. PURCHASES — PO, GRN, returns
# ===========================================================================
def _purchases(client):
    r = go(client, 'PURCHASE create PO', 'POST', '/api/v1/purchases', {
        'supplier_id': STATE.get('supplier_id'), 'total_amount': 120000,
        'status': 'Received', 'notes': 'Bulk order',
    }, expect=201)
    poid = _extract(r, 'id')
    STATE['po_id'] = poid

    go(client, 'PURCHASE list PO', 'GET', '/api/v1/purchases', expect=200)
    if poid:
        go(client, 'PURCHASE get PO', 'GET', f'/api/v1/purchases/{poid}', expect=200)

    r = go(client, 'PURCHASE create GRN', 'POST', '/api/v1/purchases/grn', {
        'purchase_order_id': poid, 'notes': 'All received',
    }, expect=201)
    STATE['grn_id'] = _extract(r, 'id')
    go(client, 'PURCHASE list GRN', 'GET', '/api/v1/purchases/grn', expect=200)

    r = go(client, 'PURCHASE create return', 'POST', '/api/v1/purchases/returns', {
        'supplier_id': STATE.get('supplier_id'), 'purchase_order_id': poid,
        'reason': 'Damaged goods', 'total_amount': 1000,
    }, expect=201)
    STATE['purchase_return_id'] = _extract(r, 'id')
    go(client, 'PURCHASE list returns', 'GET', '/api/v1/purchases/returns', expect=200)


# ===========================================================================
# 7. INVENTORY — warehouses, transfers, adjustments, ledger
# ===========================================================================
def _inventory(client):
    r1 = go(client, 'INV create warehouse 1', 'POST', '/api/v1/inventory/warehouses',
            {'name': 'Main Warehouse', 'location': 'Pune'}, expect=201)
    wh1 = _extract(r1, 'id')
    r2 = go(client, 'INV create warehouse 2', 'POST', '/api/v1/inventory/warehouses',
            {'name': 'Store Warehouse', 'location': 'Mumbai'}, expect=201)
    wh2 = _extract(r2, 'id')
    go(client, 'INV list warehouses', 'GET', '/api/v1/inventory/warehouses', expect=200)

    pid = STATE.get('product_id')
    go(client, 'INV create transfer', 'POST', '/api/v1/inventory/transfers', {
        'from_warehouse_id': wh1, 'to_warehouse_id': wh2,
        'product_id': pid, 'qty': 2, 'reference_no': 'TR-001',
    }, expect=201)
    go(client, 'INV list transfers', 'GET', '/api/v1/inventory/transfers', expect=200)

    go(client, 'INV create adjustment', 'POST', '/api/v1/inventory/adjustments', {
        'warehouse_id': wh1, 'product_id': pid, 'qty_delta': 5,
        'reason': 'Stock count correction',
    }, expect=201)
    go(client, 'INV list adjustments', 'GET', '/api/v1/inventory/adjustments', expect=200)

    go(client, 'INV ledger (all)', 'GET', '/api/v1/inventory/ledger', expect=200)
    if pid:
        go(client, 'INV ledger (by product)', 'GET', '/api/v1/inventory/ledger',
           params={'product_id': pid}, expect=200)


# ===========================================================================
# 8. HR — employees, attendance, monthly, payroll
# ===========================================================================
def _hr(client):
    r = go(client, 'HR create employee', 'POST', '/api/v1/hr/employees', {
        'name': 'Ravi Kumar', 'phone': '9999012345', 'email': 'ravi@company.com',
        'department': 'Sales', 'designation': 'Sales Associate',
        'basic_salary': 20000, 'hra': 5000, 'gross_salary': 25000,
    }, expect=201)
    empid = _extract(r, 'id')
    STATE['employee_id'] = empid
    go(client, 'HR list employees', 'GET', '/api/v1/hr/employees', expect=200)

    go(client, 'HR attendance (single)', 'POST', '/api/v1/hr/attendance',
       {'employee_id': empid, 'status': 'Present'}, expect=201)
    go(client, 'HR attendance bulk', 'POST', '/api/v1/hr/attendance/bulk',
       {'date': '2026-08-13', 'status': 'Present', 'employee_ids': [empid]}, expect=200)
    go(client, 'HR attendance bulk-month', 'POST', '/api/v1/hr/attendance/bulk-month',
       {'year': 2026, 'month': 8, 'status': 'Present', 'include_weekends': False},
       expect=200)
    go(client, 'HR list attendance', 'GET', '/api/v1/hr/attendance', expect=200)
    go(client, 'HR monthly attendance', 'GET', '/api/v1/hr/attendance/monthly',
       params={'year': 2026, 'month': 8}, expect=200)

    r = go(client, 'PAYROLL run', 'POST', '/api/v1/hr/payroll',
           {'run_name': 'August 2026'}, expect=201)
    STATE['payroll_id'] = _extract(r, 'id')
    go(client, 'PAYROLL list', 'GET', '/api/v1/hr/payroll', expect=200)

# ===========================================================================
# 9. CUSTOMERS — CRUD
# ===========================================================================
def _customers(client):
    r = go(client, 'CUSTOMER create', 'POST', '/api/v1/customers', {
        'name': 'Acme Retail Corp', 'phone': '1111222333',
        'email': 'acme@retail.com', 'address': 'Park Street, Delhi',
        'city': 'Delhi', 'state': 'DL', 'gstin': '07ACME1234R1Z3',
        'credit_limit': 100000, 'credit_period_days': 30,
    }, expect=201)
    cid = _extract(r, 'id')
    STATE['customer_id'] = cid

    go(client, 'CUSTOMER list', 'GET', '/api/v1/customers', expect=200)
    go(client, 'CUSTOMER search', 'GET', '/api/v1/customers',
       params={'search': 'Acme'}, expect=200)
    if cid:
        go(client, 'CUSTOMER get', 'GET', f'/api/v1/customers/{cid}', expect=200)
        go(client, 'CUSTOMER update', 'PUT', f'/api/v1/customers/{cid}',
           {'credit_limit': 150000}, expect=200)


# ===========================================================================
# 10. SALES — quotations, orders, challans, returns, receipts
# ===========================================================================
def _sales(client):
    cid = STATE.get('customer_id')
    pid = STATE.get('product_id')

    r = go(client, 'SALES create quotation', 'POST', '/api/v1/sales/quotations', {
        'customer_id': cid,
        'items': [{'product_id': pid, 'qty': 1, 'rate': 50000,
                   'tax_percent': 18, 'description': 'Laptop Pro'}],
    }, expect=201)
    qid = _extract(r, 'id')
    STATE['quotation_id'] = qid
    go(client, 'SALES list quotations', 'GET', '/api/v1/sales/quotations', expect=200)
    if qid:
        go(client, 'SALES get quotation', 'GET', f'/api/v1/sales/quotations/{qid}',
           expect=200)

    go(client, 'SALES create order', 'POST', '/api/v1/sales/orders', {
        'customer_id': cid, 'subtotal': 50000, 'total_amount': 59000,
    }, expect=201)
    go(client, 'SALES list orders', 'GET', '/api/v1/sales/orders', expect=200)

    go(client, 'SALES create challan', 'POST', '/api/v1/sales/challans', {
        'customer_id': cid, 'delivery_address': 'Park Street, Delhi',
        'vehicle_number': 'MH-01-AB-1234',
    }, expect=201)
    go(client, 'SALES list challans', 'GET', '/api/v1/sales/challans', expect=200)

    go(client, 'SALES create return', 'POST', '/api/v1/sales/returns', {
        'customer_id': cid, 'reason': 'Wrong item', 'total_amount': 1000,
    }, expect=201)
    go(client, 'SALES list returns', 'GET', '/api/v1/sales/returns', expect=200)

    r = go(client, 'SALES create receipt', 'POST', '/api/v1/sales/receipts', {
        'customer_id': cid, 'amount': 5000, 'payment_method': 'Cash',
    }, expect=201)
    STATE['receipt_id'] = _extract(r, 'id')
    go(client, 'SALES list receipts', 'GET', '/api/v1/sales/receipts', expect=200)


# ===========================================================================
# 11. INVOICES — CRUD (deducts stock)
# ===========================================================================
def _invoices(client):
    cid = STATE.get('customer_id')
    pid = STATE.get('product_id')

    r = go(client, 'INVOICE create', 'POST', '/api/v1/invoices', {
        'customer_id': cid,
        'items': [{'product_id': pid, 'qty': 1, 'rate': 45000,
                   'tax_percent': 18, 'description': 'Laptop Pro'}],
        'payment_status': 'Paid', 'payment_method': 'Cash',
    }, expect=201)
    invid = _extract(r, 'id')
    STATE['invoice_id'] = invid

    go(client, 'INVOICE list', 'GET', '/api/v1/invoices', expect=200)
    if invid:
        go(client, 'INVOICE get', 'GET', f'/api/v1/invoices/{invid}', expect=200)

# ===========================================================================
# 12. USERS / ROLES / PERMISSIONS
# ===========================================================================
def _users_roles(client):
    go(client, 'USERS list', 'GET', '/api/v1/users', expect=200)
    if STATE.get('user_id'):
        go(client, 'USERS get self', 'GET', f"/api/v1/users/{STATE['user_id']}",
           expect=200)

    r = go(client, 'USERS roles', 'GET', '/api/v1/users/roles', expect=200)
    role_id = None
    roles = []
    if r and r[1] and r[1].get('data'):
        roles = r[1]['data']
        for rl in roles:
            if rl.get('name') == 'Sales Person':
                role_id = rl.get('id')
                break
    if not role_id and roles:
        role_id = roles[0].get('id')
    STATE['role_id'] = role_id
    if role_id:
        go(client, 'USERS get role', 'GET', f'/api/v1/users/roles/{role_id}',
           expect=200)

    go(client, 'USERS permissions', 'GET', '/api/v1/users/permissions', expect=200)

    uniq = uuid.uuid4().hex[:6]
    r = go(client, 'USERS create', 'POST', '/api/v1/users', {
        'name': 'New Sales User', 'email': f'sales{uniq}@company.com',
        'password': 'Passw0rd!', 'role_id': role_id, 'is_active': True,
    }, expect=201)
    new_uid = _extract(r, 'id')
    if new_uid:
        go(client, 'USERS update', 'PUT', f'/api/v1/users/{new_uid}',
           {'phone': '7777000011', 'is_active': True}, expect=200)
        go(client, 'USERS delete', 'DELETE', f'/api/v1/users/{new_uid}', expect=200)


# ===========================================================================
# 13. BRANCHES
# ===========================================================================
def _branches(client):
    go(client, 'BRANCH list', 'GET', '/api/v1/branches', expect=200)
    r = go(client, 'BRANCH create', 'POST', '/api/v1/branches', {
        'name': 'Pune Branch', 'company_id': STATE.get('company_id'),
        'city': 'Pune', 'code': 'PNQ',
    }, expect=201)
    bid = _extract(r, 'id')
    if bid:
        STATE['branch_id'] = bid
        go(client, 'BRANCH get', 'GET', f'/api/v1/branches/{bid}', expect=200)
        go(client, 'BRANCH update', 'PUT', f'/api/v1/branches/{bid}',
           {'city': 'Hinjewadi Pune'}, expect=200)
        go(client, 'BRANCH activate', 'POST', f'/api/v1/branches/{bid}/activate',
           expect=200)
        go(client, 'BRANCH deactivate', 'POST', f'/api/v1/branches/{bid}/deactivate',
           expect=200)


# ===========================================================================
# 14. COMPANIES & SETTINGS
# ===========================================================================
def _companies_settings(client):
    cid = STATE.get('company_id')
    go(client, 'COMPANY list', 'GET', '/api/v1/companies', expect=200)
    if cid:
        go(client, 'COMPANY get', 'GET', f'/api/v1/companies/{cid}', expect=200)
        go(client, 'COMPANY update', 'PUT', f'/api/v1/companies/{cid}',
           {'phone': '9800000000', 'website': 'https://workflow.example'}, expect=200)
        r = go(client, 'COMPANY update settings', 'POST',
               f'/api/v1/companies/{cid}/settings',
               {'system': {'timezone': 'Asia/Kolkata'}}, expect=200)
        go(client, 'COMPANY get settings', 'GET',
           f'/api/v1/companies/{cid}/settings', expect=200)


# ===========================================================================
# 15. FINANCE — accounts, cash, bank, expenses, categories, payments
# ===========================================================================
def _finance(client):
    r = go(client, 'FIN create account', 'POST', '/api/v1/finance/accounts', {
        'account_name': 'Cash in Hand', 'account_type': 'Asset',
        'account_code': '1000', 'opening_balance': 10000,
    }, expect=201)
    STATE['account_id'] = _extract(r, 'id')
    go(client, 'FIN list accounts', 'GET', '/api/v1/finance/accounts', expect=200)
    go(client, 'FIN list accounts (type)', 'GET', '/api/v1/finance/accounts',
       params={'type': 'Asset'}, expect=200)

    go(client, 'FIN create cash account', 'POST', '/api/v1/finance/cash-accounts',
       {'name': 'Cash Drawer', 'opening_balance': 5000}, expect=201)
    go(client, 'FIN list cash accounts', 'GET', '/api/v1/finance/cash-accounts', expect=200)

    go(client, 'FIN create bank account', 'POST', '/api/v1/finance/bank-accounts', {
        'account_name': 'HDFC Current A/c', 'bank_name': 'HDFC',
        'account_number': '50123456789', 'ifsc_code': 'HDFC0001234',
        'opening_balance': 100000,
    }, expect=201)
    go(client, 'FIN list bank accounts', 'GET', '/api/v1/finance/bank-accounts', expect=200)

    go(client, 'FIN create journal entry', 'POST', '/api/v1/finance/journal-entries', {
        'description': 'Sample journal', 'total_debit': 1000, 'total_credit': 1000,
        'lines': [{'account_id': STATE.get('account_id'), 'debit': 1000, 'credit': 0,
                   'description': 'dr'}],
    }, expect=201)
    go(client, 'FIN list journal entries', 'GET', '/api/v1/finance/journal-entries', expect=200)

    go(client, 'FIN create contra entry', 'POST', '/api/v1/finance/contra-entries', {
        'from_account_type': 'Cash', 'from_account_id': 1,
        'to_account_type': 'Bank', 'to_account_id': 1,
        'amount': 500, 'notes': 'Cash to bank', 'contra_date': '2026-08-13',
    }, expect=201)
    go(client, 'FIN list contra entries', 'GET', '/api/v1/finance/contra-entries', expect=200)

    r = go(client, 'FIN create expense category', 'POST',
           '/api/v1/finance/expense-categories',
           {'name': 'Travel', 'description': 'Travel expenses'}, expect=201)
    cat_id = _extract(r, 'id')
    go(client, 'FIN list expense categories', 'GET',
       '/api/v1/finance/expense-categories', expect=200)

    go(client, 'FIN create expense', 'POST', '/api/v1/finance/expenses', {
        'category_id': cat_id, 'amount': 1500, 'payment_method': 'Cash',
        'paid_to': 'Cab Vendor', 'expense_date': '2026-08-13',
    }, expect=201)
    go(client, 'FIN list expenses', 'GET', '/api/v1/finance/expenses', expect=200)

    go(client, 'FIN create payment out', 'POST', '/api/v1/finance/payments', {
        'supplier_id': STATE.get('supplier_id'), 'amount': 30000,
        'payment_method': 'BankTransfer', 'payment_date': '2026-08-13',
    }, expect=201)
    go(client, 'FIN list payments', 'GET', '/api/v1/finance/payments', expect=200)

# ===========================================================================
# 16. DOCUMENTS
# ===========================================================================
def _documents(client):
    r = go(client, 'DOC create', 'POST', '/api/v1/documents/', {
        'title': 'Vendor Agreement', 'description': 'Annual vendor contract',
        'folder': 'Contracts', 'file_name': 'vendor_agreement.pdf',
    }, expect=201)
    doc_id = _extract(r, 'id')
    go(client, 'DOC list', 'GET', '/api/v1/documents/', expect=200)
    go(client, 'DOC list (folder)', 'GET', '/api/v1/documents/',
       params={'folder': 'Contracts'}, expect=200)
    if doc_id:
        go(client, 'DOC delete', 'DELETE', f'/api/v1/documents/{doc_id}', expect=200)


# ===========================================================================
# 17. REPORTS (read-only analytical endpoints)
# ===========================================================================
def _reports(client):
    for ep in ['/api/v1/reports/sales/daily',
               '/api/v1/reports/sales/by-customer',
               '/api/v1/reports/sales/by-product',
               '/api/v1/reports/sales/trend',
               '/api/v1/reports/purchases/by-supplier',
               '/api/v1/reports/profit/gross',
               '/api/v1/reports/gst/summary',
               '/api/v1/reports/stock/valuation',
               '/api/v1/reports/stock/movement',
               '/api/v1/reports/finance/trial-balance',
               '/api/v1/reports/finance/profit-loss',
               '/api/v1/reports/finance/balance-sheet',
               '/api/v1/reports/finance/expenses',
               '/api/v1/reports/customers/outstanding',
               '/api/v1/reports/rentals/revenue',
               '/api/v1/reports/amc/revenue',
               '/api/v1/reports/dashboard/summary']:
        go(client, f'REPORT GET {ep.split("/reports/")[1]}', 'GET', ep, expect=200)


# ===========================================================================
# 18. GLOBAL SEARCH
# ===========================================================================
def _search(client):
    go(client, 'SEARCH short query', 'GET', '/api/v1/search?q=a', expect=200)
    go(client, 'SEARCH customers/', 'GET', '/api/v1/search',
       params={'q': 'Acme'}, expect=200)
    go(client, 'SEARCH products/', 'GET', '/api/v1/search',
       params={'q': 'Laptop'}, expect=200)
    go(client, 'SEARCH invoices/', 'GET', '/api/v1/search',
       params={'q': 'INV-'}, expect=200)


# ===========================================================================
# 19. NOTIFICATIONS
# ===========================================================================
def _notifications(client):
    r = go(client, 'NOTIF list', 'GET', '/api/v1/notifications', expect=200)
    nid = None
    if r and r[1] and r[1].get('data'):
        for n in r[1]['data']:
            if not n.get('is_read'):
                nid = n.get('id')
                break
    go(client, 'NOTIF mark all read', 'POST', '/api/v1/notifications/read/all',
       expect=200)
    if nid:
        go(client, 'NOTIF mark read', 'POST', f'/api/v1/notifications/read/{nid}',
           expect=200)


# ===========================================================================
# 20. EVENT BUS — notifications, logs, emit, audit logs
# ===========================================================================
def _events(client):
    go(client, 'EVENT notifications', 'GET', '/api/v1/events/notifications', expect=200)
    go(client, 'EVENT read-all', 'PUT', '/api/v1/events/notifications/read-all',
       expect=200)
    go(client, 'EVENT logs', 'GET', '/api/v1/events/logs', expect=200)
    go(client, 'EVENT emit', 'POST', '/api/v1/events/emit', {
        'event_name': 'api.test', 'entity_type': 'product',
        'entity_id': STATE.get('product_id'), 'payload': {'msg': 'hello'},
    }, expect=200)
    go(client, 'EVENT audit-logs', 'GET', '/api/v1/events/audit-logs', expect=200)

# ===========================================================================
# 21. CUSTOM FIELDS / FORM BUILDER
# ===========================================================================
def _custom_fields(client):
    go(client, 'CF schema', 'GET', '/api/v1/custom-fields/schema?entity_type=product',
       expect=200)

    r = go(client, 'CF create section', 'POST', '/api/v1/custom-fields/sections', {
        'section_name': 'Extended Info', 'entity_type': 'product', 'sort_order': 1,
    }, expect=201)
    sec_id = _extract(r, 'id')
    go(client, 'CF list schema after section', 'GET',
       '/api/v1/custom-fields/schema?entity_type=product', expect=200)

    if sec_id:
        r = go(client, 'CF create field', 'POST', '/api/v1/custom-fields/fields', {
            'section_id': sec_id, 'field_name': 'Warranty Months',
            'field_type': 'number', 'is_required': False,
        }, expect=201)
        fid = _extract(r, 'id')
        go(client, 'CF update field', 'PUT', f'/api/v1/custom-fields/fields/{fid}',
           {'is_required': True}, expect=200)
        go(client, 'CF reorder', 'POST', '/api/v1/custom-fields/reorder',
           {'entity_type': 'product', 'reorder_data': []}, expect=200)
        go(client, 'CF update section', 'PUT',
           f'/api/v1/custom-fields/sections/{sec_id}', {'sort_order': 2}, expect=200)
        go(client, 'CF delete field', 'DELETE',
           f'/api/v1/custom-fields/fields/{fid}', expect=200)
        go(client, 'CF delete section', 'DELETE',
           f'/api/v1/custom-fields/sections/{sec_id}', expect=200)


# ===========================================================================
# 22. DEVICES
# ===========================================================================
def _devices(client):
    go(client, 'DEVICE list', 'GET', '/api/v1/devices', expect=200)
    r = go(client, 'DEVICE register', 'POST', '/api/v1/devices', {
        'device_uuid': uuid.uuid4().hex, 'device_name': 'POS Terminal 1',
        'os_version': 'Windows 11',
    }, expect=201)
    STATE['device_id'] = _extract(r, 'id')


# ===========================================================================
# 23. BACKUP (trigger + list + latest)
# ===========================================================================
def _backup(client):
    go(client, 'BACKUP trigger', 'POST', '/api/v1/backup/trigger', {}, expect=201)
    go(client, 'BACKUP list', 'GET', '/api/v1/backup/list', expect=200)
    go(client, 'BACKUP latest', 'GET', '/api/v1/backup/latest', expect=200)


# ===========================================================================
# 24. LICENSING / SUBSCRIPTIONS
# ===========================================================================
def _licensing(client):
    go(client, 'LIC plans', 'GET', '/api/v1/licensing/plans', expect=200)
    go(client, 'LIC my-subscription', 'GET', '/api/v1/licensing/my-subscription',
       expect=200)
    go(client, 'LIC devices', 'GET', '/api/v1/licensing/devices', expect=200)

    go(client, 'SUBSCRIBE list', 'GET', '/api/v1/subscriptions', expect=200)
    go(client, 'SUBSCRIBE plans', 'GET', '/api/v1/subscriptions/plans', expect=200)


# ===========================================================================
# 25. SETTINGS / NUMBER SERIES
# ===========================================================================
def _settings(client):
    go(client, 'SETTINGS list', 'GET', '/api/v1/settings', expect=200)
    go(client, 'SETTINGS save', 'POST', '/api/v1/settings', {
        'key': 'invoice_footer', 'value': 'Thank you for your business',
    }, expect=200)
    go(client, 'SETTINGS number-series', 'GET', '/api/v1/settings/series', expect=200)


# ===========================================================================
# 26. DELETE / CRUD safe-delete checks (throwaway records)
# ===========================================================================
def _delete_checks(client):
    r = go(client, 'DEL product create-temp', 'POST', '/api/v1/products', {
        'name': 'Temp Product', 'sku': 'TMP-001', 'selling_price': 100,
    }, expect=201)
    tmp_pid = _extract(r, 'id')
    if tmp_pid:
        go(client, 'DEL product delete', 'DELETE', f'/api/v1/products/{tmp_pid}',
           expect=200)

    r = go(client, 'DEL supplier create-temp', 'POST', '/api/v1/suppliers', {
        'name': 'Temp Supplier', 'phone': '0000000000',
    }, expect=201)
    tmp_sid = _extract(r, 'id')
    if tmp_sid:
        go(client, 'DEL supplier delete', 'DELETE', f'/api/v1/suppliers/{tmp_sid}',
           expect=200)

    r = go(client, 'DEL customer create-temp', 'POST', '/api/v1/customers', {
        'name': 'Temp Customer', 'phone': '0000000001',
    }, expect=201)
    tmp_cid = _extract(r, 'id')
    if tmp_cid:
        go(client, 'DEL customer delete', 'DELETE', f'/api/v1/customers/{tmp_cid}',
           expect=200)

