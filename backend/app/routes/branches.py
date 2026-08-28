from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.extensions import db
from app.models.tenant import Branch, Company
from app.models.user import User
from datetime import datetime

branches_bp = Blueprint('branches', __name__)


def get_current_user():
    """Helper to get current user from JWT"""
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))


@branches_bp.route('', methods=['GET'])
@jwt_required()
def list_branches():
    """List all branches for the current company"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    search = request.args.get('q', '')
    company_id = request.args.get('company_id', user.company_id, type=int)
    
    query = Branch.query.filter_by(
        tenant_id=user.tenant_id,
        company_id=company_id,
        is_deleted=False
    )
    
    if search:
        query = query.filter(
            db.or_(
                Branch.name.ilike(f'%{search}%'),
                Branch.code.ilike(f'%{search}%'),
                Branch.city.ilike(f'%{search}%')
            )
        )
    
    total = query.count()
    branches = query.order_by(Branch.created_at.desc()).paginate(
        page=page, per_page=page_size, error_out=False
    )
    
    return jsonify({
        "data": [b.to_dict() for b in branches.items],
        "meta": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size
        },
        "errors": None
    }), 200


@branches_bp.route('/<int:branch_id>', methods=['GET'])
@jwt_required()
def get_branch(branch_id):
    """Get a specific branch by ID"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    branch = Branch.query.filter_by(
        id=branch_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not branch:
        return jsonify({"data": None, "meta": None, "errors": ["Branch not found"]}), 404
    
    return jsonify({
        "data": branch.to_dict(),
        "meta": None,
        "errors": None
    }), 200


@branches_bp.route('', methods=['POST'])
@jwt_required()
def create_branch():
    """Create a new branch"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    data = request.get_json() or {}
    
    # Validate required fields
    required_fields = ['name', 'company_id']
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Missing required fields: {', '.join(missing)}"]
        }), 400
    
    # Verify company belongs to user's tenant
    company = Company.query.filter_by(
        id=data['company_id'],
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not company:
        return jsonify({"data": None, "meta": None, "errors": ["Company not found"]}), 404
    
    try:
        branch = Branch(
            tenant_id=user.tenant_id,
            company_id=data['company_id'],
            name=data['name'],
            code=data.get('code'),
            address=data.get('address'),
            city=data.get('city'),
            state=data.get('state'),
            phone=data.get('phone'),
            email=data.get('email'),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(branch)
        db.session.commit()
        
        return jsonify({
            "data": branch.to_dict(),
            "meta": None,
            "errors": None
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to create branch: {str(e)}"]
        }), 500


@branches_bp.route('/<int:branch_id>', methods=['PUT'])
@jwt_required()
def update_branch(branch_id):
    """Update an existing branch"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    branch = Branch.query.filter_by(
        id=branch_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not branch:
        return jsonify({"data": None, "meta": None, "errors": ["Branch not found"]}), 404
    
    data = request.get_json() or {}
    
    try:
        # Update fields
        if 'name' in data:
            branch.name = data['name']
        if 'code' in data:
            branch.code = data['code']
        if 'address' in data:
            branch.address = data['address']
        if 'city' in data:
            branch.city = data['city']
        if 'state' in data:
            branch.state = data['state']
        if 'phone' in data:
            branch.phone = data['phone']
        if 'email' in data:
            branch.email = data['email']
        if 'is_active' in data:
            branch.is_active = data['is_active']
        
        branch.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "data": branch.to_dict(),
            "meta": None,
            "errors": None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to update branch: {str(e)}"]
        }), 500


@branches_bp.route('/<int:branch_id>', methods=['DELETE'])
@jwt_required()
def delete_branch(branch_id):
    """Soft delete a branch"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    branch = Branch.query.filter_by(
        id=branch_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not branch:
        return jsonify({"data": None, "meta": None, "errors": ["Branch not found"]}), 404
    
    try:
        branch.is_deleted = True
        branch.deleted_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "data": {"message": "Branch deleted successfully"},
            "meta": None,
            "errors": None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to delete branch: {str(e)}"]
        }), 500


@branches_bp.route('/<int:branch_id>/activate', methods=['POST'])
@jwt_required()
def activate_branch(branch_id):
    """Activate a branch"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    branch = Branch.query.filter_by(
        id=branch_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not branch:
        return jsonify({"data": None, "meta": None, "errors": ["Branch not found"]}), 404
    
    try:
        branch.is_active = True
        branch.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "data": branch.to_dict(),
            "meta": None,
            "errors": None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to activate branch: {str(e)}"]
        }), 500


@branches_bp.route('/<int:branch_id>/deactivate', methods=['POST'])
@jwt_required()
def deactivate_branch(branch_id):
    """Deactivate a branch"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    branch = Branch.query.filter_by(
        id=branch_id,
        tenant_id=user.tenant_id,
        is_deleted=False
    ).first()
    
    if not branch:
        return jsonify({"data": None, "meta": None, "errors": ["Branch not found"]}), 404
    
    try:
        branch.is_active = False
        branch.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "data": branch.to_dict(),
            "meta": None,
            "errors": None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to deactivate branch: {str(e)}"]
        }), 500
