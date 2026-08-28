from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import uuid
from app.extensions import db
from app.models.tenant import Company, CompanySetting
from app.models.user import User
from datetime import datetime

companies_bp = Blueprint('companies', __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads', 'logos')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg'}

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def get_company_logo_path(company_id):
    """Helper to get absolute path to company logo file"""
    company = db.session.get(Company, company_id)
    if company and company.logo:
        return os.path.join(UPLOAD_FOLDER, company.logo)
    return None


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_current_user():
    """Helper to get current user from JWT"""
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))


@companies_bp.route('', methods=['GET'])
@jwt_required()
def list_companies():
    """List all companies for the current tenant"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    companies = Company.query.filter_by(
        tenant_id=user.tenant_id,
        is_deleted=False
    ).order_by(Company.is_head_office.desc(), Company.created_at).all()
    
    return jsonify({
        "data": [c.to_dict() for c in companies],
        "meta": None,
        "errors": None
    }), 200


@companies_bp.route('/<int:company_id>', methods=['GET'])
@jwt_required()
def get_company(company_id):
    """Get a specific company by ID with all settings"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    company = Company.query.filter_by(
        id=company_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not company:
        return jsonify({"data": None, "meta": None, "errors": ["Company not found"]}), 404
    
    # Get company settings
    settings = CompanySetting.query.filter_by(
        company_id=company_id,
        is_deleted=False
    ).all()
    
    company_dict = company.to_dict()
    company_dict['settings'] = {}
    
    for setting in settings:
        if setting.setting_group not in company_dict['settings']:
            company_dict['settings'][setting.setting_group] = {}
        company_dict['settings'][setting.setting_group][setting.setting_key] = setting.setting_value
    
    return jsonify({
        "data": company_dict,
        "meta": None,
        "errors": None
    }), 200


@companies_bp.route('/<int:company_id>', methods=['PUT'])
@jwt_required()
def update_company(company_id):
    """Update company details"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    company = Company.query.filter_by(
        id=company_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not company:
        return jsonify({"data": None, "meta": None, "errors": ["Company not found"]}), 404
    
    data = request.get_json() or {}
    
    try:
        # Update company fields
        if 'name' in data:
            company.name = data['name']
        if 'address' in data:
            company.address = data['address']
        if 'city' in data:
            company.city = data['city']
        if 'state' in data:
            company.state = data['state']
        if 'pincode' in data:
            company.pincode = data['pincode']
        if 'country' in data:
            company.country = data['country']
        if 'gstin' in data:
            company.gstin = data['gstin']
        if 'pan' in data:
            company.pan = data['pan']
        if 'email' in data:
            company.email = data['email']
        if 'phone' in data:
            company.phone = data['phone']
        if 'website' in data:
            company.website = data['website']
        if 'currency' in data:
            company.currency = data['currency']
        if 'financial_year_start_month' in data:
            company.financial_year_start_month = data['financial_year_start_month']
        if 'timezone' in data:
            company.timezone = data['timezone']
        if 'default_language' in data:
            company.default_language = data['default_language']
        if 'business_type' in data:
            company.business_type = data['business_type']
            # Re-hydrate the company-type driven UI config so changing the
            # business type in Company Settings reshapes the tenant's modules.
            from app.services.business_type_config import seed_business_type_config
            seed_business_type_config(user.tenant_id, company.id, data['business_type'], commit=False)

        company.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "data": company.to_dict(),
            "meta": None,
            "errors": None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to update company: {str(e)}"]
        }), 500


@companies_bp.route('/<int:company_id>/logo', methods=['POST'])
@jwt_required()
def upload_logo(company_id):
    """Upload company logo"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    company = Company.query.filter_by(
        id=company_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not company:
        return jsonify({"data": None, "meta": None, "errors": ["Company not found"]}), 404
    
    if 'logo' not in request.files:
        return jsonify({"data": None, "meta": None, "errors": ["No logo file provided"]}), 400
    
    file = request.files['logo']
    
    if file.filename == '':
        return jsonify({"data": None, "meta": None, "errors": ["No file selected"]}), 400
    
    if not allowed_file(file.filename):
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"]
        }), 400
    
    try:
        # Delete old logo if exists
        if company.logo:
            old_logo_path = os.path.join(UPLOAD_FOLDER, company.logo)
            if os.path.exists(old_logo_path):
                os.remove(old_logo_path)
        
        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Save file
        file.save(filepath)
        
        # Update company record
        company.logo = filename
        company.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "data": {
                "logo": filename,
                "logo_url": f"/api/v1/companies/{company_id}/logo/{filename}"
            },
            "meta": None,
            "errors": None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to upload logo: {str(e)}"]
        }), 500


@companies_bp.route('/<int:company_id>/logo/<filename>', methods=['GET'])
def get_logo(company_id, filename):
    """Serve company logo file"""
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except:
        return jsonify({"data": None, "meta": None, "errors": ["Logo not found"]}), 404


@companies_bp.route('/<int:company_id>/logo', methods=['DELETE'])
@jwt_required()
def delete_logo(company_id):
    """Delete company logo"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    company = Company.query.filter_by(
        id=company_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not company:
        return jsonify({"data": None, "meta": None, "errors": ["Company not found"]}), 404
    
    if not company.logo:
        return jsonify({"data": None, "meta": None, "errors": ["No logo to delete"]}), 404
    
    try:
        # Delete file
        logo_path = os.path.join(UPLOAD_FOLDER, company.logo)
        if os.path.exists(logo_path):
            os.remove(logo_path)
        
        # Update company record
        company.logo = None
        company.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "data": {"message": "Logo deleted successfully"},
            "meta": None,
            "errors": None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to delete logo: {str(e)}"]
        }), 500


# Company Settings Management

@companies_bp.route('/<int:company_id>/settings', methods=['GET'])
@jwt_required()
def get_settings(company_id):
    """Get all settings for a company grouped by setting_group"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    company = Company.query.filter_by(
        id=company_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not company:
        return jsonify({"data": None, "meta": None, "errors": ["Company not found"]}), 404
    
    settings = CompanySetting.query.filter_by(
        company_id=company_id,
        is_deleted=False
    ).all()
    
    grouped = {}
    for setting in settings:
        group = setting.setting_group or 'general'
        if group not in grouped:
            grouped[group] = {}
        grouped[group][setting.setting_key] = {
            'id': setting.id,
            'value': setting.setting_value
        }
    
    return jsonify({
        "data": grouped,
        "meta": None,
        "errors": None
    }), 200


@companies_bp.route('/<int:company_id>/settings', methods=['POST'])
@jwt_required()
def update_settings(company_id):
    """Update company settings (bulk update)"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    company = Company.query.filter_by(
        id=company_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not company:
        return jsonify({"data": None, "meta": None, "errors": ["Company not found"]}), 404
    
    data = request.get_json() or {}
    
    try:
        # data format: { "group_name": { "key": "value", ... }, ... }
        for group, settings in data.items():
            for key, value in settings.items():
                # Check if setting exists
                setting = CompanySetting.query.filter_by(
                    company_id=company_id,
                    setting_key=key,
                    setting_group=group,
                    is_deleted=False
                ).first()
                
                if setting:
                    setting.setting_value = str(value)
                    setting.updated_at = datetime.utcnow()
                else:
                    setting = CompanySetting(
                        tenant_id=user.tenant_id,
                        company_id=company_id,
                        setting_key=key,
                        setting_value=str(value),
                        setting_group=group
                    )
                    db.session.add(setting)
        
        db.session.commit()
        
        return jsonify({
            "data": {"message": "Settings updated successfully"},
            "meta": None,
            "errors": None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to update settings: {str(e)}"]
        }), 500


@companies_bp.route('/<int:company_id>/settings/<int:setting_id>', methods=['DELETE'])
@jwt_required()
def delete_setting(company_id, setting_id):
    """Delete a specific setting"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    setting = CompanySetting.query.filter_by(
        id=setting_id,
        company_id=company_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not setting:
        return jsonify({"data": None, "meta": None, "errors": ["Setting not found"]}), 404
    
    try:
        setting.is_deleted = True
        setting.deleted_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "data": {"message": "Setting deleted successfully"},
            "meta": None,
            "errors": None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to delete setting: {str(e)}"]
        }), 500
