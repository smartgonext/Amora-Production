"""Tests for Phase 2 bakery: baker's % recipe scaling + label generation.

Also verifies the new Product/BOM bakery columns persist through the API.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.tenant import Tenant, Company
from app.models.user import User
from app.models.product import Product
from app.models.manufacturing import BomHeader


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


def _seed_data(client, app):
    with app.app_context():
        tenant = Tenant(name='Bakery T', subdomain='bakeryphase2', business_type='Bakery')
        db.session.add(tenant)
        db.session.flush()
        company = Company(tenant_id=tenant.id, name='Bakery Co', email='b@b.com',
                          business_type='Bakery')
        db.session.add(company)
        db.session.flush()
        user = User(tenant_id=tenant.id, company_id=company.id, name='Admin',
                    email='bakadmin@test.com')
        user.set_password('password123')
        db.session.add(user)
        db.session.flush()

        flour = Product(tenant_id=tenant.id, name='Flour', sku='FLOUR',
                        is_raw_material=True, purchase_price=40)
        water = Product(tenant_id=tenant.id, name='Water', sku='WATER',
                        is_raw_material=True, purchase_price=0)
        salt = Product(tenant_id=tenant.id, name='Salt', sku='SALT',
                       is_raw_material=True, purchase_price=20)
        loaves = Product(tenant_id=tenant.id, name='White Loaf', sku='LOAF',
                         is_raw_material=False, is_batch_tracked=True,
                         shelf_life_days=4, best_before_days=4, is_fresh=True,
                         allergens=['Gluten'], nutrition={'energy_kcal': 265, 'protein_g': 9})
        db.session.add_all([flour, water, salt, loaves])
        db.session.flush()
        tenant_id = tenant.id
        company_id = company.id
        flour_id = flour.id
        water_id = water.id
        salt_id = salt.id
        product_id = loaves.id
        db.session.commit()

    from app.services.manufacturing_service import create_bom
    with app.app_context():
        bom = create_bom(tenant_id, company_id, {
            'name': 'White Loaf Recipe',
            'product_id': product_id,
            'version': 'V1.0',
            'hydration_pct': 65,
            'dough_yield_pct': 98,
            'bake_loss_pct': 10,
            'items': [
                {'item_id': flour_id, 'qty_required': 50, 'uom': 'kg', 'baker_pct': 100},
                {'item_id': water_id, 'qty_required': 32.5, 'uom': 'kg', 'baker_pct': 65},
                {'item_id': salt_id, 'qty_required': 1, 'uom': 'kg', 'baker_pct': 2},
            ],
        })
        bom_id = bom.id

    return {'bom_id': bom_id, 'product_id': product_id, 'tenant_id': tenant_id}


def test_recipe_scale_baker_pct(app):
    data = _seed_data(None, app)
    with app.app_context():
        from app.services.bakery_service import scale_formula
        result = scale_formula(data['bom_id'], 200)
    assert abs(result['total_baker_pct'] - 167) < 0.01
    assert result['target_dough_weight'] == 200.0
    assert abs(result['flour_weight'] - 119.7605) < 0.1
    salt_line = [i for i in result['items'] if i['baker_pct'] == 2][0]
    assert abs(salt_line['qty'] - 2.3952) < 0.01
    assert abs(result['expected_baked_weight'] - 180.0) < 0.01


def test_recipe_scale_missing_bom(app):
    with app.app_context():
        from app.services.bakery_service import scale_formula
        with pytest.raises(ValueError):
            scale_formula(999999, 100)


def test_generate_label(app):
    data = _seed_data(None, app)
    with app.app_context():
        from app.services.bakery_service import generate_label
        label = generate_label(data['product_id'])
    assert label['product_name'] == 'White Loaf'
    assert label['shelf_life_days'] == 4
    assert 'Gluten' in label['allergens']
    assert '265' in label['text']
    assert 'Fresh / Baked today' in label['text']


def test_bom_columns_persist(app):
    data = _seed_data(None, app)
    with app.app_context():
        bom = db.session.get(BomHeader, data['bom_id'])
        assert float(bom.hydration_pct) == 65.0
        assert float(bom.bake_loss_pct) == 10.0
        item = bom.items.first()
        assert item.baker_pct is not None


def test_bakery_profile_features():
    from app.services.manufacturing_config import get_default_manufacturing_profile
    profile = get_default_manufacturing_profile('Bakery')
    assert 'baker_pct_scaling' in profile['enabled_features']
    assert 'allergen_label' in profile['enabled_features']
