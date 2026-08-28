from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.customer import Customer
from app.middleware.branch_filter import require_branch_filter, apply_branch_filter
from datetime import datetime, date

customers_bp = Blueprint('customers', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))

# ==========================================
# CUSTOMER ROUTES
# ==========================================

@customers_bp.route('', methods=['GET'])
@jwt_required()
@require_branch_filter
def get_customers():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    query = Customer.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    
    # Apply branch filter if branch is selected
    query = apply_branch_filter(query, Customer)
    
    # Optional search query
    search = request.args.get('search')
    if search:
        query = query.filter(
            (Customer.name.like(f"%{search}%")) |
            (Customer.phone.like(f"%{search}%")) |
            (Customer.email.like(f"%{search}%"))
        )
        
    customers = query.all()
    return jsonify({
        "data": [c.to_dict() for c in customers],
        "meta": {
            "count": len(customers),
            "branch_filter_active": g.branch_filter_active if hasattr(g, 'branch_filter_active') else False,
            "branch_id": g.branch_filter if hasattr(g, 'branch_filter') else None
        },
        "errors": None
    }), 200

@customers_bp.route('', methods=['POST'])
@jwt_required()
def create_customer():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    if not data.get('name') or not data.get('phone'):
        return jsonify({"data": None, "meta": None, "errors": ["Name and Phone are required"]}), 400
        
    from app.services.form_builder_service import extract_custom_fields
    custom_fields = extract_custom_fields('customer', data)
    if data.get('custom_fields'):
        custom_fields.update(data['custom_fields'])
        
    customer = Customer(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        name=data.get('name'),
        phone=data.get('phone'),
        email=data.get('email'),
        address=data.get('address'),
        city=data.get('city'),
        state=data.get('state'),
        pincode=data.get('pincode'),
        gstin=data.get('gstin'),
        pan=data.get('pan'),
        credit_limit=data.get('credit_limit', 0.00),
        credit_period_days=data.get('credit_period_days', 0),
        notes=data.get('notes'),
        is_active=data.get('is_active', True),
        custom_fields=custom_fields
    )
    
    db.session.add(customer)
    db.session.commit()
    
    return jsonify({"data": customer.to_dict(), "meta": None, "errors": None}), 201

@customers_bp.route('/<int:customer_id>', methods=['GET'])
@jwt_required()
def get_customer(customer_id):
    user = get_current_user()
    customer = Customer.query.filter_by(id=customer_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not customer:
        return jsonify({"data": None, "meta": None, "errors": ["Customer not found"]}), 404
        
    return jsonify({"data": customer.to_dict(), "meta": None, "errors": None}), 200

@customers_bp.route('/<int:customer_id>', methods=['PUT'])
@jwt_required()
def update_customer(customer_id):
    user = get_current_user()
    customer = Customer.query.filter_by(id=customer_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not customer:
        return jsonify({"data": None, "meta": None, "errors": ["Customer not found"]}), 404
        
    data = request.get_json() or {}
    
    from app.services.form_builder_service import extract_custom_fields
    custom_fields = extract_custom_fields('customer', data)
    if data.get('custom_fields'):
        custom_fields.update(data['custom_fields'])
        
    for field in ['name', 'phone', 'email', 'address', 'city', 'state', 'pincode', 'gstin', 'pan', 'credit_limit', 'credit_period_days', 'notes', 'is_active']:
        if field in data:
            setattr(customer, field, data[field])
            
    customer.custom_fields = custom_fields
            
    db.session.add(customer)
    db.session.commit()
    
    return jsonify({"data": customer.to_dict(), "meta": None, "errors": None}), 200

@customers_bp.route('/<int:customer_id>', methods=['DELETE'])
@jwt_required()
def delete_customer(customer_id):
    user = get_current_user()
    customer = Customer.query.filter_by(id=customer_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not customer:
        return jsonify({"data": None, "meta": None, "errors": ["Customer not found"]}), 404
        
    customer.soft_delete()
    return jsonify({"data": {"message": "Customer deleted successfully"}, "meta": None, "errors": None}), 200
