"""Setup Wizard API - Phase 3: Company onboarding and template configuration"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.tenant import Company, CompanySetting, NumberSeries
from app.models.template import (TaxSetting, InvoiceTemplate, AgreementTemplate,
                                  ReceiptTemplate, QuotationTemplate,
                                  PurchaseOrderTemplate, DeliveryChallanTemplate)
from app.utils.default_templates import DEFAULT_BLUEPRINTS
from app.services.business_type_config import seed_business_type_config, get_company_ui_config

setup_bp = Blueprint('setup', __name__)


def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))


@setup_bp.route('/company', methods=['PUT'])
@jwt_required()
def update_company():
    """Step 1: Company Profile"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    data = request.get_json() or {}
    company = Company.query.filter_by(id=user.company_id).first()
    if not company:
        return jsonify({"data": None, "meta": None, "errors": ["Company not found"]}), 404
    
    allowed_fields = ['name', 'logo', 'address', 'city', 'state', 'pincode', 'country',
                      'gstin', 'pan', 'email', 'phone', 'website', 'currency',
                      'financial_year_start_month', 'timezone', 'default_language',
                      'business_type']
    
    for field in allowed_fields:
        if field in data:
            setattr(company, field, data[field])
    
    db.session.add(company)
    db.session.commit()
    
    return jsonify({"data": company.to_dict(), "meta": None, "errors": None}), 200


@setup_bp.route('/business-type', methods=['PUT'])
@jwt_required()
def set_business_type():
    """Step 2: Business Type Selection"""
    user = get_current_user()
    data = request.get_json() or {}
    business_type = data.get('business_type')
    
    if not business_type:
        return jsonify({"data": None, "meta": None, "errors": ["Business type is required"]}), 400
    
    company = Company.query.filter_by(id=user.company_id).first()
    company.business_type = business_type
    company.tenant.business_type = business_type
    db.session.add(company)
    # Re-hydrate the company-type driven module/feature config so changing the
    # business type instantly reshapes which modules the tenant sees.
    seed_business_type_config(user.tenant_id, company.id, business_type, commit=False)
    db.session.commit()
    
    return jsonify({"data": {"business_type": business_type}, "meta": None, "errors": None}), 200


@setup_bp.route('/tax-settings', methods=['PUT'])
@jwt_required()
def save_tax_settings():
    """Step 3: Tax Setup"""
    user = get_current_user()
    data = request.get_json() or {}
    
    tax = TaxSetting.query.filter_by(company_id=user.company_id).first()
    if not tax:
        tax = TaxSetting(tenant_id=user.tenant_id, company_id=user.company_id)
    
    allowed_fields = ['gst_enabled', 'cgst_rate', 'sgst_rate', 'igst_rate', 'cess_rate',
                      'default_discount_type', 'round_off_rule', 'default_gst_rate']
    
    for field in allowed_fields:
        if field in data:
            setattr(tax, field, data[field])
    
    db.session.add(tax)
    db.session.commit()
    
    return jsonify({"data": tax.to_dict(), "meta": None, "errors": None}), 200


@setup_bp.route('/templates/<doc_type>', methods=['GET', 'PUT'])
@jwt_required()
def manage_template(doc_type):
    """Steps 4-9: Template Designer for all document types"""
    user = get_current_user()
    
    template_map = {
        'invoice': InvoiceTemplate,
        'agreement': AgreementTemplate,
        'receipt': ReceiptTemplate,
        'quotation': QuotationTemplate,
        'purchase_order': PurchaseOrderTemplate,
        'delivery_challan': DeliveryChallanTemplate
    }
    
    model_class = template_map.get(doc_type)
    if not model_class:
        return jsonify({"data": None, "meta": None, "errors": [f"Unknown template type: {doc_type}"]}), 400
    
    if request.method == 'GET':
        template = model_class.query.filter_by(company_id=user.company_id, is_deleted=False).first()
        if not template:
            # Return default template structure (always non-empty so the
            # designer canvas is never blank). Companies can still change it.
            builder = DEFAULT_BLUEPRINTS.get(doc_type)
            layout_json = builder() if builder else {"canvas_width": 595, "canvas_height": 842, "elements": []}
            return jsonify({
                "data": {
                    "doc_type": doc_type,
                    "name": "Default",
                    "template_html": None,
                    "layout_json": layout_json,
                    "is_default": True,
                    "settings": {}
                },
                "meta": None,
                "errors": None
            }), 200
        return jsonify({"data": template.to_dict(), "meta": None, "errors": None}), 200
    
    # PUT - save template
    data = request.get_json() or {}
    template = model_class.query.filter_by(company_id=user.company_id, is_deleted=False).first()
    if not template:
        template = model_class(tenant_id=user.tenant_id, company_id=user.company_id)
    
    for field in ['name', 'template_html', 'is_default']:
        if field in data:
            setattr(template, field, data[field])
    
    # Visual designer blueprint with percentage coordinate elements
    if 'layout_json' in data:
        template.layout_json = data['layout_json']
    
    # Invoice-specific settings
    if doc_type == 'invoice' and 'layout' in data:
        template.layout = data['layout']
    for opt in ['show_logo', 'show_gst_breakdown', 'show_terms', 'show_signature', 'show_qr_code']:
        if opt in data:
            setattr(template, opt, data[opt])
    if 'header_text' in data:
        template.header_text = data['header_text']
    if 'footer_text' in data:
        template.footer_text = data['footer_text']
    
    db.session.add(template)
    db.session.commit()
    
    return jsonify({"data": template.to_dict(), "meta": None, "errors": None}), 200


@setup_bp.route('/number-series', methods=['GET', 'PUT'])
@jwt_required()
def manage_number_series():
    """Configure number series for document types"""
    user = get_current_user()
    
    if request.method == 'GET':
        series = NumberSeries.query.filter_by(company_id=user.company_id, is_deleted=False).all()
        return jsonify({"data": [s.to_dict() for s in series], "meta": None, "errors": None}), 200
    
    data = request.get_json() or []
    if not isinstance(data, list):
        data = [data]
    
    results = []
    for item in data:
        doc_type = item.get('document_type')
        if not doc_type:
            continue
        
        series = NumberSeries.query.filter_by(company_id=user.company_id, document_type=doc_type, is_deleted=False).first()
        if not series:
            series = NumberSeries(tenant_id=user.tenant_id, company_id=user.company_id, document_type=doc_type)
        
        for field in ['prefix', 'suffix', 'starting_number', 'current_number', 'padding', 'reset_frequency']:
            if field in item:
                setattr(series, field, item[field])
        
        db.session.add(series)
        results.append(series)
    
    db.session.commit()
    
    return jsonify({"data": [s.to_dict() for s in results], "meta": None, "errors": None}), 200


@setup_bp.route('/finish', methods=['POST'])
@jwt_required()
def finish_setup():
    """Step 10: Mark setup as complete and activate ERP"""
    user = get_current_user()
    
    setting = CompanySetting.query.filter_by(
        company_id=user.company_id,
        setting_key='setup_completed'
    ).first()
    
    if not setting:
        setting = CompanySetting(
            tenant_id=user.tenant_id,
            company_id=user.company_id,
            setting_key='setup_completed',
            setting_value='true',
            setting_group='system'
        )
    
    db.session.add(setting)
    
    # Create default number series if none exist
    doc_types = ['invoice', 'quotation', 'purchase_order', 'receipt', 'delivery_challan']
    for dt in doc_types:
        existing = NumberSeries.query.filter_by(company_id=user.company_id, document_type=dt).first()
        if not existing:
            prefix_map = {
                'invoice': 'INV-',
                'quotation': 'QTN-',
                'purchase_order': 'PO-',
                'receipt': 'RCT-',
                'delivery_challan': 'DC-'
            }
            ns = NumberSeries(
                tenant_id=user.tenant_id,
                company_id=user.company_id,
                document_type=dt,
                prefix=prefix_map.get(dt, ''),
                starting_number=1,
                current_number=1,
                padding=5,
                reset_frequency='yearly'
            )
            db.session.add(ns)
    
    db.session.commit()
    
    return jsonify({
        "data": {"message": "ERP setup completed successfully. System is now active."},
        "meta": None,
        "errors": None
    }), 200


@setup_bp.route('/status', methods=['GET'])
@jwt_required()
def setup_status():
    """Check if setup has been completed"""
    user = get_current_user()
    
    setting = CompanySetting.query.filter_by(
        company_id=user.company_id,
        setting_key='setup_completed',
        setting_value='true'
    ).first()
    
    company = Company.query.filter_by(id=user.company_id).first()
    tax = TaxSetting.query.filter_by(company_id=user.company_id).first()
    
    return jsonify({
        "data": {
            "setup_completed": setting is not None,
            "company_configured": bool(company and company.name),
            "business_type_set": bool(company and company.business_type),
            "tax_configured": tax is not None
        },
        "meta": None,
        "errors": None
    }), 200


@setup_bp.route('/ui-config', methods=['GET'])
@jwt_required()
def get_ui_config():
    """Return the company's effective UI configuration.

    Driven by the selected business type: which top-level modules are shown,
    which are hidden, and which feature flags are enabled so the front-end can
    adapt nav/menus and field visibility.
    """
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    company = Company.query.filter_by(id=user.company_id, is_deleted=False).first()
    if not company:
        return jsonify({
            # No company -> nothing restricted; front-end falls back gracefully.
            "data": {
                "business_type": None,
                "enabled_modules": [],
                "hidden_modules": [],
                "features": {},
            },
            "meta": None,
            "errors": ["Company not found"],
        }), 404

    cfg = get_company_ui_config(company)
    return jsonify({"data": cfg, "meta": None, "errors": None}), 200