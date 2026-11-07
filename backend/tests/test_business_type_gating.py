"""Tests for Company-Type driven module/field gating (Phase 1).

Verifies:
  1. Registry resolves correct modules/features per business type.
  2. Legacy / unknown business types fall back to ALL modules (never hide).
  3. seed_business_type_config persists into CompanySetting rows.
  4. The /api/v1/setup/ui-config endpoint returns the effective config.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.tenant import Tenant, Company
from app.models.user import User
from app.services.business_type_config import (
    get_default_business_modules,
    seed_business_type_config,
    get_company_ui_config,
    MODULE_CODES,
)


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


def test_registry_bakery_includes_manufacturing_and_features():
    cfg = get_default_business_modules('Bakery')
    assert 'manufacturing' in cfg['enabled_modules']
    assert cfg['features']['mfg_type'] == 'process'
    assert cfg['features'].get('recipe') is True
    # Bakery is not a rentals/equipment business
    assert 'equipment' not in cfg['enabled_modules']
    assert 'rentals' not in cfg['enabled_modules']


def test_registry_retail_excludes_manufacturing():
    cfg = get_default_business_modules('Retail Shop')
    assert 'manufacturing' not in cfg['enabled_modules']
    assert 'billing' in cfg['enabled_modules']


def test_registry_unknown_type_falls_back_to_all_modules():
    # Unknown / blank types must never hide anything for legacy tenants.
    cfg = get_default_business_modules('Some Future Type')
    assert set(cfg['enabled_modules']) == set(MODULE_CODES)
    cfg2 = get_default_business_modules(None)
    assert set(cfg2['enabled_modules']) == set(MODULE_CODES)


def test_seed_persists_company_settings(app):
    with app.app_context():
        tenant = Tenant(name='Gate Tenant', subdomain='gatetest', business_type='Bakery')
        db.session.add(tenant)
        db.session.flush()
        company = Company(tenant_id=tenant.id, name='Gate Co', business_type='Bakery')
        db.session.add(company)
        db.session.flush()

        res = seed_business_type_config(tenant.id, company.id, 'Bakery', commit=True)
        assert 'manufacturing' in res['enabled_modules']

        ui = get_company_ui_config(company)
        assert ui['business_type'] == 'Bakery'
        assert 'manufacturing' in ui['enabled_modules']
        assert ui['features'].get('mfg_type') == 'process'


def test_ui_config_endpoint(client, app):
    with app.app_context():
        tenant = Tenant(name='UI Tenant', subdomain='uiconfig', business_type='Pharmacy')
        db.session.add(tenant)
        db.session.flush()
        company = Company(tenant_id=tenant.id, name='UI Co', email='ui@test.com',
                          business_type='Pharmacy')
        db.session.add(company)
        db.session.flush()
        seed_business_type_config(tenant.id, company.id, 'Pharmacy', commit=False)
        user = User(tenant_id=tenant.id, company_id=company.id,
                    name='UI Admin', email='uiadmin@test.com')
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()

    login = client.post('/api/v1/auth/login', json={
        'email': 'uiadmin@test.com', 'password': 'password123'})
    token = login.json['data']['tokens']['access_token']
    headers = {'Authorization': f'Bearer {token}'}

    r = client.get('/api/v1/setup/ui-config', headers=headers)
    assert r.status_code == 200
    data = r.json['data']
    assert data['business_type'] == 'Pharmacy'
    assert 'manufacturing' not in data['enabled_modules']
    assert 'inventory' in data['enabled_modules']
    assert data['features'].get('expiry') is True

    # Test PUT /api/v1/setup/ui-config allows toggling modules
    r_put = client.put('/api/v1/setup/ui-config', headers=headers, json={
        'enabled_modules': ['dashboard', 'products', 'inventory', 'sales']
    })
    assert r_put.status_code == 200
    updated_data = r_put.json['data']
    assert 'sales' in updated_data['enabled_modules']
    assert 'purchases' not in updated_data['enabled_modules']


def test_ice_cream_vs_rental_modules():
    """Verify Ice Cream excludes rentals/equipment, and Equipment Rental excludes manufacturing."""
    ice_cream = get_default_business_modules('Ice Cream Manufacturing')
    assert 'manufacturing' in ice_cream['enabled_modules']
    assert 'equipment' not in ice_cream['enabled_modules']
    assert 'rentals' not in ice_cream['enabled_modules']
    assert 'amc' not in ice_cream['enabled_modules']
    assert 'equipment' in ice_cream['hidden']
    assert 'rentals' in ice_cream['hidden']

    rental = get_default_business_modules('Equipment Rental')
    assert 'equipment' in rental['enabled_modules']
    assert 'rentals' in rental['enabled_modules']
    assert 'amc' in rental['enabled_modules']
    assert 'manufacturing' not in rental['enabled_modules']
    assert 'manufacturing' in rental['hidden']

