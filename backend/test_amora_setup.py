"""
Verification Script for Fresh Amora Bakery & Superadmin Setup
"""
import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app, db
from app.models.tenant import Tenant, Company, Branch, CompanySetting
from app.models.user import User
from app.models.product import Product, ProductCategory, Warehouse, Unit
from app.models.manufacturing import BomHeader, WorkOrder, TenantManufacturingConfig
from app.models.bakery import BakingPlan, HaccpControlPoint

app = create_app('dev')
client = app.test_client()

def test_everything():
    print("==================================================================")
    print("STARTING COMPLETE VERIFICATION OF AMORA BAKERY & SUPERADMIN SETUP")
    print("==================================================================")

    # 1. Superadmin Login
    print("\n[TEST 1] Testing Superadmin Login...")
    resp = client.post('/api/v1/auth/login', json={
        "email": "superadmin@smartgonext.com",
        "password": "SuperAdmin@123"
    })
    assert resp.status_code == 200, f"Superadmin login failed: {resp.data}"
    sa_data = resp.get_json()['data']
    sa_token = sa_data['tokens']['access_token']
    assert sa_data['user']['is_superadmin'] is True, "Superadmin flag should be True"
    print(f"  -> SUCCESS! Logged in as: {sa_data['user']['name']} (Superadmin={sa_data['user']['is_superadmin']})")

    # Verify superadmin can access superadmin tenants endpoint
    resp = client.get('/api/v1/superadmin/tenants', headers={"Authorization": f"Bearer {sa_token}"})
    assert resp.status_code == 200, f"Superadmin tenants access failed: {resp.data}"
    tenants = resp.get_json()['data']
    print(f"  -> SUCCESS! Superadmin queried tenants list. Total tenants: {len(tenants)}")

    # 2. Amora Bakery Admin Login
    print("\n[TEST 2] Testing Amora Bakery Admin Login...")
    resp = client.post('/api/v1/auth/login', json={
        "email": "admin@amorabakery.com",
        "password": "Amora@123"
    })
    assert resp.status_code == 200, f"Amora login failed: {resp.data}"
    amora_data = resp.get_json()['data']
    amora_token = amora_data['tokens']['access_token']
    headers = {"Authorization": f"Bearer {amora_token}"}
    print(f"  -> SUCCESS! Logged in as: {amora_data['user']['name']} ({amora_data['user']['role']})")
    print(f"  -> Company: {amora_data['company']['name']}")

    # 3. Test /api/v1/setup/ui-config (Gating & Automation)
    print("\n[TEST 3] Testing Bakery Dynamic Module & Feature Gating (/api/v1/setup/ui-config)...")
    resp = client.get('/api/v1/setup/ui-config', headers=headers)
    assert resp.status_code == 200, f"ui-config failed: {resp.data}"
    ui_cfg = resp.get_json()['data']
    print(f"  -> Business Type: {ui_cfg['business_type']}")
    assert ui_cfg['business_type'] == 'Bakery', f"Expected Bakery, got {ui_cfg['business_type']}"
    assert 'manufacturing' in ui_cfg['enabled_modules'], "manufacturing must be enabled for Bakery"
    assert 'billing' in ui_cfg['enabled_modules'], "billing must be enabled for Bakery"
    assert 'equipment' in ui_cfg['hidden_modules'], "equipment must be hidden for Bakery"
    assert 'rentals' in ui_cfg['hidden_modules'], "rentals must be hidden for Bakery"
    assert ui_cfg['features'].get('baker_pct_scaling') is True, "baker_pct_scaling must be True"
    assert ui_cfg['features'].get('recipe') is True, "recipe must be True"
    assert ui_cfg['features'].get('freshness') is True, "freshness must be True"
    print("  -> SUCCESS! UI module gating confirmed:")
    print(f"     Enabled: {ui_cfg['enabled_modules']}")
    print(f"     Hidden:  {ui_cfg['hidden_modules']}")
    print(f"     Bakery Features: {list(ui_cfg['features'].keys())}")

    # 4. Test /api/v1/manufacturing/config
    print("\n[TEST 4] Testing Manufacturing Engine Profile (/api/v1/manufacturing/config)...")
    resp = client.get('/api/v1/manufacturing/config', headers=headers)
    assert resp.status_code == 200, f"manufacturing/config failed: {resp.data}"
    mfg_cfg = resp.get_json()['data']
    assert mfg_cfg['mfg_type'] == 'process', f"Expected process, got {mfg_cfg['mfg_type']}"
    assert mfg_cfg['bom_label'] == 'Recipe / Yield'
    print(f"  -> SUCCESS! Mfg Type: {mfg_cfg['mfg_type']}, BOM Label: {mfg_cfg['bom_label']}")

    # 5. Test Products & Categories
    print("\n[TEST 5] Testing Products & Categories (/api/v1/products)...")
    resp = client.get('/api/v1/products', headers=headers)
    assert resp.status_code == 200, f"products failed: {resp.data}"
    products = resp.get_json()['data']
    raw_mats = [p for p in products if p.get('is_raw_material')]
    fin_goods = [p for p in products if not p.get('is_raw_material')]
    print(f"  -> SUCCESS! Total Products: {len(products)} (Raw Materials: {len(raw_mats)}, Finished Baked Goods: {len(fin_goods)})")
    for fg in fin_goods:
        print(f"     * {fg['name']} (Retail Price: Rs. {fg['retail_price']}, Shelf Life: {fg.get('shelf_life_days')} days, Allergens: {fg.get('allergens')})")

    # 6. Test Recipes / BOMs
    print("\n[TEST 6] Testing Master BOM Recipes (/api/v1/manufacturing/boms)...")
    resp = client.get('/api/v1/manufacturing/boms', headers=headers)
    assert resp.status_code == 200, f"bom failed: {resp.data}"
    boms = resp.get_json()['data']
    assert len(boms) >= 2, f"Expected at least 2 BOMs, got {len(boms)}"
    print(f"  -> SUCCESS! Found {len(boms)} Master Bakery Formulas:")
    for b in boms:
        print(f"     * {b['name']} (Yield: {b['base_quantity']}, Hydration: {b.get('hydration_pct')}%, Dough Yield: {b.get('dough_yield_pct')}%)")

    # 7. Test Work Orders
    print("\n[TEST 7] Testing Batch Work Orders (/api/v1/manufacturing/work-orders)...")
    resp = client.get('/api/v1/manufacturing/work-orders', headers=headers)
    assert resp.status_code == 200, f"work-orders failed: {resp.data}"
    wos = resp.get_json()['data']
    assert len(wos) >= 2, f"Expected at least 2 work orders, got {len(wos)}"
    print(f"  -> SUCCESS! Found {len(wos)} Active Batch Work Orders:")
    for w in wos:
        print(f"     * {w['wo_number']}: Planned: {w['planned_qty']}, Produced: {w['produced_qty']}, Status: {w['status']}")

    # 8. Test Daily Bake Plan
    print("\n[TEST 8] Testing Shift / Daily Bake Plan (/api/v1/bakery/bake-plans)...")
    resp = client.get('/api/v1/bakery/bake-plans', headers=headers)
    assert resp.status_code == 200, f"bakery/bake-plans failed: {resp.data}"
    plans = resp.get_json()['data']
    assert len(plans) >= 1, "Expected at least 1 shift plan"
    plan_items = plans[0].get('items', [])
    print(f"  -> SUCCESS! Today's Shift Plan ({plans[0]['shift']} Shift, Status: {plans[0]['status']}) with {len(plan_items)} baked lines:")
    for pi in plan_items:
        print(f"     * Planned Qty: {pi['planned_qty']}, Batches: {pi['num_batches']}, Oven: {pi['oven']}, Status: {pi['status']}")

    # 9. Test HACCP QC Control Points
    print("\n[TEST 9] Testing HACCP CCP Checkpoints (/api/v1/bakery/haccp)...")
    resp = client.get('/api/v1/bakery/haccp', headers=headers)
    assert resp.status_code == 200, f"bakery/haccp failed: {resp.data}"
    haccps = resp.get_json()['data']
    assert len(haccps) >= 3, f"Expected at least 3 HACCP points, got {len(haccps)}"
    print(f"  -> SUCCESS! Found {len(haccps)} Active HACCP CCP Control Checkpoints:")
    for h in haccps:
        print(f"     * {h['checkpoint_name']} => Recorded: {h['recorded_value']} {h['unit']} (Pass={h['is_pass']})")

    # 10. Test Warehouses
    print("\n[TEST 10] Testing Warehouses (/api/v1/inventory/warehouses)...")
    resp = client.get('/api/v1/inventory/warehouses', headers=headers)
    assert resp.status_code == 200, f"warehouses failed: {resp.data}"
    whs = resp.get_json()['data']
    assert len(whs) >= 4, f"Expected 4 warehouses, got {len(whs)}"
    print(f"  -> SUCCESS! Found {len(whs)} Warehouses:")
    for w in whs:
        print(f"     * {w['name']} ({w['location']})")

    print("\n" + "=" * 66)
    print("ALL 10 VERIFICATION TESTS PASSED 100%! LOCAL BACKEND IS ROCK SOLID!")
    print("==================================================================")

if __name__ == '__main__':
    test_everything()
