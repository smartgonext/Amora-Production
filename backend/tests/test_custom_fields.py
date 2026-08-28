import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.tenant import Tenant, Company, Branch, CustomFormSection, CustomFormField
from app.models.user import User


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
    """Create authenticated test user and headers"""
    with client.application.app_context():
        tenant = Tenant(
            name='Test Form Tenant',
            subdomain='formtenant',
            db_status='active',
            is_active=True
        )
        db.session.add(tenant)
        db.session.flush()

        company = Company(
            tenant_id=tenant.id,
            name='Form Company',
            email='form@company.com'
        )
        db.session.add(company)
        db.session.flush()

        branch = Branch(
            tenant_id=tenant.id,
            company_id=company.id,
            name='Main Branch',
            code='MAIN',
            is_main=True
        )
        db.session.add(branch)
        db.session.flush()

        user = User(
            tenant_id=tenant.id,
            company_id=company.id,
            branch_id=branch.id,
            name='Form Admin',
            email='formadmin@test.com'
        )
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()

    response = client.post('/api/v1/auth/login', json={
        'email': 'formadmin@test.com',
        'password': 'password123'
    })
    token = response.json['data']['tokens']['access_token']
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


def test_get_custom_form_schema(client, auth_headers):
    """Test loading form schema and auto-seeding default sections"""
    res = client.get('/api/v1/custom-fields/schema?entity_type=product', headers=auth_headers)
    assert res.status_code == 200
    data = res.json['data']
    assert len(data) >= 4  # Default product sections
    assert data[0]['section_name'] == 'Basic Product Info'


def test_create_section_and_field(client, auth_headers):
    """Test creating custom sections and custom fields"""
    # Create section
    sec_res = client.post('/api/v1/custom-fields/sections', json={
        'section_name': 'Warranty & Specs',
        'entity_type': 'product',
        'sort_order': 5
    }, headers=auth_headers)
    assert sec_res.status_code == 201
    sec = sec_res.json['data']

    # Create custom field inside section
    field_res = client.post('/api/v1/custom-fields/fields', json={
        'section_id': sec['id'],
        'field_name': 'Warranty Period (Months)',
        'field_type': 'select',
        'options_json': ['6 Months', '12 Months', '24 Months'],
        'is_required': True
    }, headers=auth_headers)
    assert field_res.status_code == 201
    f_data = field_res.json['data']
    assert f_data['field_name'] == 'Warranty Period (Months)'
    assert f_data['field_key'] == 'warranty_period_months'
    assert len(f_data['options_json']) == 3


def test_append_inline_option(client, auth_headers):
    """Test inline '+' option creator API endpoint"""
    # Create section and dropdown field
    sec_res = client.post('/api/v1/custom-fields/sections', json={
        'section_name': 'Machine Specs',
        'entity_type': 'rental'
    }, headers=auth_headers)
    sec_id = sec_res.json['data']['id']

    field_res = client.post('/api/v1/custom-fields/fields', json={
        'section_id': sec_id,
        'field_name': 'Engine Model',
        'field_type': 'select',
        'options_json': ['CAT C4.4', 'Cummins QSB']
    }, headers=auth_headers)
    field_id = field_res.json['data']['id']

    # Simulate clicking inline '+' option adder in the UI
    opt_res = client.post(f'/api/v1/custom-fields/fields/{field_id}/options', json={
        'option': 'Perkins 1104D'
    }, headers=auth_headers)
    assert opt_res.status_code == 200
    updated_field = opt_res.json['data']
    assert 'Perkins 1104D' in updated_field['options_json']
    assert len(updated_field['options_json']) == 3


def test_reorder_sections_and_fields(client, auth_headers):
    """Test reordering sections and fields"""
    reorder_payload = {
        'entity_type': 'product',
        'reorder_data': [
            {'id': 1, 'sort_order': 2},
            {'id': 2, 'sort_order': 1}
        ]
    }
    res = client.post('/api/v1/custom-fields/reorder', json=reorder_payload, headers=auth_headers)
    assert res.status_code == 200
