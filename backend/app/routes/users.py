from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User, Role, Permission, RolePermission
from app.models.tenant import Branch, Company
from datetime import datetime

users_bp = Blueprint('users', __name__)


def get_current_user():
    """Helper to get current user from JWT"""
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))


@users_bp.route('', methods=['GET'])
@jwt_required()
def list_users():
    """List all users for the current tenant"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    search = request.args.get('q', '')
    role_id = request.args.get('role_id', type=int)
    branch_id = request.args.get('branch_id', type=int)
    
    query = User.query.filter_by(
        tenant_id=user.tenant_id,
        is_deleted=False
    )
    
    if search:
        query = query.filter(
            db.or_(
                User.name.ilike(f'%{search}%'),
                User.email.ilike(f'%{search}%'),
                User.phone.ilike(f'%{search}%')
            )
        )
    
    if role_id:
        query = query.filter_by(role_id=role_id)
    
    if branch_id:
        query = query.filter_by(branch_id=branch_id)
    
    total = query.count()
    users = query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=page_size, error_out=False
    )
    
    # Include role names in response
    results = []
    for u in users.items:
        user_dict = u.to_dict()
        user_dict['role_name'] = u.role.name if u.role else None
        user_dict['company_name'] = u.company.name if u.company else None
        user_dict['branch_name'] = u.branch.name if u.branch else None
        results.append(user_dict)
    
    return jsonify({
        "data": results,
        "meta": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size
        },
        "errors": None
    }), 200


@users_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get a specific user by ID"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    user = User.query.filter_by(
        id=user_id,
        tenant_id=current_user.tenant_id,
        is_deleted=False
    ).first()
    
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    user_dict = user.to_dict()
    user_dict['role_name'] = user.role.name if user.role else None
    user_dict['permissions'] = []
    
    if user.role:
        user_dict['permissions'] = [
            {
                'id': p.id,
                'name': p.name,
                'module': p.module,
                'action': p.action
            }
            for p in user.role.permissions
        ]
    
    return jsonify({
        "data": user_dict,
        "meta": None,
        "errors": None
    }), 200


@users_bp.route('', methods=['POST'])
@jwt_required()
def create_user():
    """Create a new user"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    data = request.get_json() or {}
    
    # Validate required fields
    required_fields = ['name', 'email', 'password']
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Missing required fields: {', '.join(missing)}"]
        }), 400
    
    # Check if email already exists
    if User.query.filter_by(email=data['email'], is_deleted=False).first():
        return jsonify({
            "data": None,
            "meta": None,
            "errors": ["Email already exists"]
        }), 400
    
    try:
        user = User(
            tenant_id=current_user.tenant_id,
            company_id=data.get('company_id', current_user.company_id),
            branch_id=data.get('branch_id'),
            name=data['name'],
            email=data['email'],
            phone=data.get('phone'),
            role_id=data.get('role_id'),
            is_active=data.get('is_active', True),
            preferred_language=data.get('preferred_language', 'en'),
            theme_preference=data.get('theme_preference', 'light')
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        user_dict = user.to_dict()
        user_dict['role_name'] = user.role.name if user.role else None
        
        return jsonify({
            "data": user_dict,
            "meta": None,
            "errors": None
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to create user: {str(e)}"]
        }), 500


@users_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update an existing user"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    user = User.query.filter_by(
        id=user_id,
        tenant_id=current_user.tenant_id,
        is_deleted=False
    ).first()
    
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    data = request.get_json() or {}
    
    try:
        # Update fields
        if 'name' in data:
            user.name = data['name']
        if 'email' in data:
            # Check if new email already exists
            existing = User.query.filter_by(email=data['email'], is_deleted=False).first()
            if existing and existing.id != user_id:
                return jsonify({
                    "data": None,
                    "meta": None,
                    "errors": ["Email already exists"]
                }), 400
            user.email = data['email']
        if 'phone' in data:
            user.phone = data['phone']
        if 'role_id' in data:
            user.role_id = data['role_id']
        if 'branch_id' in data:
            user.branch_id = data['branch_id']
        if 'company_id' in data:
            user.company_id = data['company_id']
        if 'is_active' in data:
            user.is_active = data['is_active']
        if 'password' in data and data['password']:
            user.set_password(data['password'])
        if 'preferred_language' in data:
            user.preferred_language = data['preferred_language']
        if 'theme_preference' in data:
            user.theme_preference = data['theme_preference']
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        user_dict = user.to_dict()
        user_dict['role_name'] = user.role.name if user.role else None
        
        return jsonify({
            "data": user_dict,
            "meta": None,
            "errors": None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to update user: {str(e)}"]
        }), 500


@users_bp.route('/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """Soft delete a user"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    # Prevent self-deletion
    if user_id == current_user.id:
        return jsonify({
            "data": None,
            "meta": None,
            "errors": ["Cannot delete your own account"]
        }), 400
    
    user = User.query.filter_by(
        id=user_id,
        tenant_id=current_user.tenant_id,
        is_deleted=False
    ).first()
    
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    try:
        user.is_deleted = True
        user.deleted_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            "data": {"message": "User deleted successfully"},
            "meta": None,
            "errors": None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [f"Failed to delete user: {str(e)}"]
        }), 500


# Role Management Endpoints

@users_bp.route('/roles', methods=['GET'])
@jwt_required()
def list_roles():
    """List all roles for the current tenant"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    roles = Role.query.filter(
        db.or_(
            Role.tenant_id == user.tenant_id,
            Role.is_system_role == True
        ),
        Role.is_deleted == False
    ).order_by(Role.name).all()
    
    results = []
    for role in roles:
        role_dict = role.to_dict()
        role_dict['permissions_count'] = role.permissions.count()
        results.append(role_dict)
    
    return jsonify({
        "data": results,
        "meta": None,
        "errors": None
    }), 200


@users_bp.route('/roles/<int:role_id>', methods=['GET'])
@jwt_required()
def get_role(role_id):
    """Get a specific role with its permissions"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    
    role = Role.query.filter_by(id=role_id, is_deleted=False).first()
    
    if not role:
        return jsonify({"data": None, "meta": None, "errors": ["Role not found"]}), 404
    
    role_dict = role.to_dict()
    role_dict['permissions'] = [
        {
            'id': p.id,
            'name': p.name,
            'module': p.module,
            'action': p.action,
            'description': p.description
        }
        for p in role.permissions
    ]
    
    return jsonify({
        "data": role_dict,
        "meta": None,
        "errors": None
    }), 200


@users_bp.route('/permissions', methods=['GET'])
@jwt_required()
def list_permissions():
    """List all available permissions"""
    permissions = Permission.query.filter_by(is_deleted=False).order_by(
        Permission.module, Permission.action
    ).all()
    
    # Group by module
    grouped = {}
    for perm in permissions:
        if perm.module not in grouped:
            grouped[perm.module] = []
        grouped[perm.module].append({
            'id': perm.id,
            'name': perm.name,
            'action': perm.action,
            'description': perm.description
        })
    
    return jsonify({
        "data": grouped,
        "meta": None,
        "errors": None
    }), 200
