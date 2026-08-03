from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import uuid
from app.extensions import db
from app.models.tenant import Tenant, Subscription, SubscriptionPlan, Company, License
from app.models.user import User, Role, Permission, LoginHistory, UserSession
from app.utils.security import rate_limit, write_audit_log, validate_password_strength

auth_bp = Blueprint('auth', __name__)


def create_default_roles_for_tenant(tenant_id):
    """Seed default roles and permissions for a new tenant"""
    roles_data = [
        {"name": "Admin", "description": "Full access to all operations and configuration"},
        {"name": "Manager", "description": "Manage operations, inventory, and billing"},
        {"name": "Accountant", "description": "Finance, invoicing, and reports access"},
        {"name": "Sales Person", "description": "Sales, quotations, and customer management"},
        {"name": "Cashier", "description": "POS billing and payment collection"}
    ]
    
    roles = []
    for r_data in roles_data:
        role = Role(tenant_id=tenant_id, name=r_data['name'], description=r_data['description'])
        db.session.add(role)
        roles.append(role)
        
    db.session.commit()
    return {r.name: r for r in roles}


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    
    name = data.get('company_name')
    subdomain = data.get('subdomain')
    email = data.get('email')
    password = data.get('password')
    admin_name = data.get('admin_name', 'Admin')
    business_type = data.get('business_type')
    
    if not name or not subdomain or not email or not password:
        return jsonify({"data": None, "meta": None, "errors": ["Company name, subdomain, email, and password are required."]}), 400
        
    # Check if subdomain already exists
    if Tenant.query.filter_by(subdomain=subdomain).first():
        return jsonify({"data": None, "meta": None, "errors": ["Subdomain already taken."]}), 400
        
    # Check if user email already exists
    if User.query.filter_by(email=email).first():
        return jsonify({"data": None, "meta": None, "errors": ["Email already registered."]}), 400
        
    try:
        # 1. Create Tenant
        tenant = Tenant(name=name, subdomain=subdomain, business_type=business_type)
        db.session.add(tenant)
        db.session.flush()
        
        # 2. Assign default subscription plan (Free Trial)
        plan = SubscriptionPlan.query.filter_by(name='Free Trial').first()
        if not plan:
            plan = SubscriptionPlan(name='Free Trial', price=0.00, billing_cycle='monthly', allowed_devices=1, max_users=3)
            db.session.add(plan)
            db.session.flush()
            
        subscription = Subscription(
            tenant_id=tenant.id,
            plan_id=plan.id,
            status='active',
            start_date=datetime.utcnow(),
            expiry_date=datetime.utcnow() + timedelta(days=15)
        )
        db.session.add(subscription)
        db.session.flush()
        
        # 3. Create Default Company profile
        company = Company(
            tenant_id=tenant.id,
            name=name,
            email=email,
            business_type=business_type,
            is_head_office=True
        )
        db.session.add(company)
        db.session.flush()
        
        # 4. Create default roles for this tenant
        roles_map = create_default_roles_for_tenant(tenant.id)
        admin_role = roles_map["Admin"]
        
        # 5. Create Admin User
        user = User(
            tenant_id=tenant.id,
            company_id=company.id,
            name=admin_name,
            email=email,
            role_id=admin_role.id,
            is_active=True,
            is_superadmin=False
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()
        
        # 6. Generate license for trial period
        license_key = str(uuid.uuid4()).replace('-', '')[:32].upper()
        license = License(
            license_key=license_key,
            tenant_id=tenant.id,
            company_id=company.id,
            subscription_id=subscription.id,
            plan_id=plan.id,
            modules_json=["products", "customers", "suppliers", "sales", "purchases", "inventory", "finance"],
            max_bills=500,
            issued_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=15),
            status='active',
            is_trial=True
        )
        db.session.add(license)
        
        db.session.commit()
        
        # 7. Generate tokens
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={"tenant_id": tenant.id, "company_id": company.id, "role": "Admin"}
        )
        refresh_token = create_refresh_token(
            identity=str(user.id),
            additional_claims={"tenant_id": tenant.id}
        )
        
        return jsonify({
            "data": {
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "role": "Admin"
                },
                "tenant": {
                    "id": tenant.id,
                    "name": tenant.name,
                    "subdomain": tenant.subdomain
                },
                "company": company.to_dict(),
                "license": license.to_dict(),
                "tokens": {
                    "access_token": access_token,
                    "refresh_token": refresh_token
                }
            },
            "meta": None,
            "errors": None
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"data": None, "meta": None, "errors": [f"Registration failed: {str(e)}"]}), 500


@auth_bp.route('/login', methods=['POST'])
@rate_limit(max_calls=10, window_seconds=60)
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"data": None, "meta": None, "errors": ["Email and password are required."]}), 400
        
    user = User.query.filter_by(email=email, is_deleted=False).first()
    
    if not user or not user.check_password(password):
        if user:
            log = LoginHistory(tenant_id=user.tenant_id, user_id=user.id, ip_address=request.remote_addr, status='failed')
            db.session.add(log)
            db.session.commit()
        return jsonify({"data": None, "meta": None, "errors": ["Invalid email or password."]}), 401
        
    if not user.is_active:
        return jsonify({"data": None, "meta": None, "errors": ["Account is deactivated. Contact admin."]}), 403
        
    role_name = user.role.name if user.role else 'User'
    
    log = LoginHistory(tenant_id=user.tenant_id, user_id=user.id, ip_address=request.remote_addr, status='success')
    db.session.add(log)
    db.session.commit()
    
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"tenant_id": user.tenant_id, "company_id": user.company_id, "role": role_name}
    )
    refresh_token = create_refresh_token(
        identity=str(user.id),
        additional_claims={"tenant_id": user.tenant_id}
    )
    
    # Update last login
    user.last_login_at = datetime.utcnow()
    db.session.add(user)
    db.session.commit()
    
    # Get company details with logo
    from app.models.tenant import Company
    company_data = None
    company = Company.query.get(user.company_id) if user.company_id else None
    if company:
        company_data = {
            "id": company.id,
            "name": company.name,
            "logo": company.logo,
            "logo_url": f"/api/v1/companies/{company.id}/logo/{company.logo}" if company.logo else None,
            "email": company.email,
            "phone": company.phone,
            "gstin": company.gstin,
            "address": company.address,
            "city": company.city,
            "state": company.state,
            "country": company.country
        }
    
    return jsonify({
        "data": {
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": role_name,
                "theme_preference": user.theme_preference,
                "branch_id": user.branch_id
            },
            "tenant_id": user.tenant_id,
            "company_id": user.company_id,
            "company": company_data,
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token
            }
        },
        "meta": None,
        "errors": None
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    user = User.query.get(int(identity))
    if not user or not user.is_active or user.is_deleted:
        return jsonify({"data": None, "meta": None, "errors": ["Invalid session or deactivated account."]}), 401
        
    role_name = user.role.name if user.role else 'User'
    
    new_access_token = create_access_token(
        identity=identity,
        additional_claims={"tenant_id": user.tenant_id, "company_id": user.company_id, "role": role_name}
    )
    
    return jsonify({
        "data": {"access_token": new_access_token},
        "meta": None,
        "errors": None
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user or user.is_deleted:
        return jsonify({"data": None, "meta": None, "errors": ["User not found."]}), 404
    
    user_dict = user.to_dict()
    
    # Add company details with logo
    from app.models.tenant import Company
    company = Company.query.get(user.company_id) if user.company_id else None
    if company:
        user_dict['company'] = {
            "id": company.id,
            "name": company.name,
            "logo": company.logo,
            "logo_url": f"/api/v1/companies/{company.id}/logo/{company.logo}" if company.logo else None,
            "email": company.email,
            "phone": company.phone,
            "gstin": company.gstin,
            "address": company.address,
            "city": company.city,
            "state": company.state,
            "country": company.country
        }
    
    # Add role name
    user_dict['role_name'] = user.role.name if user.role else None
    
    return jsonify({
        "data": user_dict,
        "meta": None,
        "errors": None
    }), 200


@auth_bp.route('/select-branch', methods=['POST'])
@jwt_required()
def select_branch():
    """
    Update JWT token with selected branch_id.
    This allows filtering data by branch in subsequent requests.
    
    Request body: {"branch_id": 1} or {"branch_id": null} to clear selection
    """
    data = request.get_json() or {}
    branch_id = data.get('branch_id')
    
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    
    if not user or user.is_deleted:
        return jsonify({"data": None, "meta": None, "errors": ["User not found."]}), 404
    
    # Validate branch belongs to user's tenant if branch_id is provided
    if branch_id is not None:
        from app.models.tenant import Branch
        branch = Branch.query.filter_by(
            id=branch_id, 
            tenant_id=user.tenant_id, 
            is_deleted=False
        ).first()
        
        if not branch:
            return jsonify({"data": None, "meta": None, "errors": ["Branch not found or not accessible."]}), 404
    
    # Create new access token with branch_id in claims
    role_name = user.role.name if user.role else 'User'
    additional_claims = {
        "tenant_id": user.tenant_id,
        "company_id": user.company_id,
        "role": role_name
    }
    
    # Add branch_id to claims if provided
    if branch_id is not None:
        additional_claims["branch_id"] = branch_id
    
    new_access_token = create_access_token(
        identity=str(user.id),
        additional_claims=additional_claims
    )
    
    return jsonify({
        "data": {
            "access_token": new_access_token,
            "branch_id": branch_id,
            "message": "Branch selection updated successfully"
        },
        "meta": None,
        "errors": None
    }), 200
