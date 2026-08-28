from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.customer import Supplier

suppliers_bp = Blueprint('suppliers', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))

@suppliers_bp.route('', methods=['GET'])
@jwt_required()
def get_suppliers():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    query = Supplier.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    
    # Optional filtering by vendor type
    is_job_work_vendor = request.args.get('is_job_work_vendor')
    if is_job_work_vendor is not None:
        query = query.filter_by(is_job_work_vendor=(is_job_work_vendor.lower() == 'true'))
        
    # Optional search query
    search = request.args.get('search')
    if search:
        query = query.filter(
            (Supplier.name.like(f"%{search}%")) |
            (Supplier.phone.like(f"%{search}%")) |
            (Supplier.email.like(f"%{search}%"))
        )
        
    suppliers = query.all()
    return jsonify({
        "data": [s.to_dict() for s in suppliers],
        "meta": {"count": len(suppliers)},
        "errors": None
    }), 200

@suppliers_bp.route('', methods=['POST'])
@jwt_required()
def create_supplier():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    if not data.get('name') or not data.get('phone'):
        return jsonify({"data": None, "meta": None, "errors": ["Name and Phone are required"]}), 400
        
    supplier = Supplier(
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
        contact_person=data.get('contact_person'),
        bank_name=data.get('bank_name'),
        bank_account_no=data.get('bank_account_no'),
        bank_ifsc=data.get('bank_ifsc'),
        payment_terms=data.get('payment_terms'),
        credit_limit=data.get('credit_limit', 0.00),
        is_active=data.get('is_active', True),
        is_job_work_vendor=data.get('is_job_work_vendor', False)
    )
    
    db.session.add(supplier)
    db.session.commit()
    
    return jsonify({"data": supplier.to_dict(), "meta": None, "errors": None}), 201

@suppliers_bp.route('/<int:supplier_id>', methods=['GET'])
@jwt_required()
def get_supplier(supplier_id):
    user = get_current_user()
    supplier = Supplier.query.filter_by(id=supplier_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not supplier:
        return jsonify({"data": None, "meta": None, "errors": ["Supplier not found"]}), 404
        
    return jsonify({"data": supplier.to_dict(), "meta": None, "errors": None}), 200

@suppliers_bp.route('/<int:supplier_id>', methods=['PUT'])
@jwt_required()
def update_supplier(supplier_id):
    user = get_current_user()
    supplier = Supplier.query.filter_by(id=supplier_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not supplier:
        return jsonify({"data": None, "meta": None, "errors": ["Supplier not found"]}), 404
        
    data = request.get_json() or {}
    
    for field in ['name', 'phone', 'email', 'address', 'city', 'state', 'pincode', 'gstin', 'contact_person', 'bank_name', 'bank_account_no', 'bank_ifsc', 'payment_terms', 'credit_limit', 'is_active', 'is_job_work_vendor']:
        if field in data:
            setattr(supplier, field, data[field])
            
    db.session.add(supplier)
    db.session.commit()
    
    return jsonify({"data": supplier.to_dict(), "meta": None, "errors": None}), 200

@suppliers_bp.route('/<int:supplier_id>', methods=['DELETE'])
@jwt_required()
def delete_supplier(supplier_id):
    user = get_current_user()
    supplier = Supplier.query.filter_by(id=supplier_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not supplier:
        return jsonify({"data": None, "meta": None, "errors": ["Supplier not found"]}), 404
        
    supplier.soft_delete()
    return jsonify({"data": {"message": "Supplier deleted successfully"}, "meta": None, "errors": None}), 200
