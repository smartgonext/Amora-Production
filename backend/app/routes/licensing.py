"""Phase 7 + Phase 13: Licensing, Subscription & Purchase Flow API
Phase 13 additions:
  - rate_limit on /verify (10 calls/min per IP) to block brute-force key guessing
  - Device-binding enforcement: a license can only be used from the device_id
    that first activated it; a second device_id is rejected (cloning detection)
  - IP logged on every verify call for security review
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime, timedelta
import uuid
from app.extensions import db
from app.models.user import User
from app.models.tenant import Tenant, SubscriptionPlan, Subscription, License, LicenseEvent, Payment, DeviceRegistry
from app.services.event_bus import EventBus
from app.utils.security import rate_limit, write_audit_log

licensing_bp = Blueprint('licensing', __name__)


def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))


# ============================================================
# PUBLIC ENDPOINTS (no auth required)
# ============================================================

@licensing_bp.route('/plans', methods=['GET'])
def list_plans():
    """List all available subscription plans"""
    plans = SubscriptionPlan.query.filter_by(is_deleted=False, is_active=True).order_by(SubscriptionPlan.sort_order).all()
    return jsonify({
        "data": [p.to_dict() for p in plans],
        "meta": None,
        "errors": None
    }), 200


@licensing_bp.route('/trial/register', methods=['POST'])
def trial_register():
    """Self-service trial registration - no payment required"""
    data = request.get_json() or {}
    
    name = data.get('company_name')
    subdomain = data.get('subdomain')
    email = data.get('email')
    password = data.get('password')
    admin_name = data.get('admin_name', 'Admin')
    business_type = data.get('business_type')
    
    if not all([name, subdomain, email, password]):
        return jsonify({"data": None, "meta": None, "errors": ["Company name, subdomain, email, and password are required."]}), 400
    
    if Tenant.query.filter_by(subdomain=subdomain).first():
        return jsonify({"data": None, "meta": None, "errors": ["Subdomain already taken."]}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({"data": None, "meta": None, "errors": ["Email already registered."]}), 400
    
    try:
        trial_plan = SubscriptionPlan.query.filter_by(name='Free Trial', is_deleted=False).first()
        if not trial_plan:
            trial_plan = SubscriptionPlan(
                name='Free Trial', price=0, billing_cycle='monthly',
                allowed_devices=1, max_users=3, max_storage_mb=100,
                description='15-day free trial with limited features',
                is_active=True, sort_order=0
            )
            db.session.add(trial_plan)
            db.session.flush()
        
        from app.routes.auth import create_default_roles_for_tenant
        
        tenant = Tenant(name=name, subdomain=subdomain, business_type=business_type, is_active=True)
        db.session.add(tenant)
        db.session.flush()
        
        # 15-day trial subscription
        subscription = Subscription(
            tenant_id=tenant.id, plan_id=trial_plan.id,
            status='trial', start_date=datetime.utcnow(),
            expiry_date=datetime.utcnow() + timedelta(days=15),
            trial_end_date=datetime.utcnow() + timedelta(days=15),
            auto_renew=False
        )
        db.session.add(subscription)
        db.session.flush()
        
        from app.models.tenant import Company
        company = Company(tenant_id=tenant.id, name=name, email=email, business_type=business_type, is_head_office=True)
        db.session.add(company)
        db.session.flush()
        
        roles_map = create_default_roles_for_tenant(tenant.id)
        admin_role = roles_map["Admin"]
        
        user = User(
            tenant_id=tenant.id, company_id=company.id,
            name=admin_name, email=email, role_id=admin_role.id,
            is_active=True, is_superadmin=False
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()
        
        # Generate trial license
        license_key = str(uuid.uuid4()).replace('-', '')[:32].upper()
        license = License(
            license_key=license_key, tenant_id=tenant.id, company_id=company.id,
            subscription_id=subscription.id, plan_id=trial_plan.id,
            modules_json=['products', 'customers', 'suppliers', 'sales', 'purchases', 'inventory', 'finance'],
            max_bills=500, issued_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=15),
            status='active', is_trial=True
        )
        db.session.add(license)
        db.session.flush()
        
        LicenseEvent(license_id=license.id, event_type='activated', triggered_by='system',
                     event_payload={'type': 'trial', 'days': 15}).save()
        
        db.session.commit()
        
        from flask_jwt_extended import create_access_token, create_refresh_token
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
                "user": {"id": user.id, "name": user.name, "email": user.email, "role": "Admin"},
                "tenant": {"id": tenant.id, "name": tenant.name, "subdomain": tenant.subdomain},
                "company": company.to_dict(),
                "license": license.to_dict(),
                "subscription": subscription.to_dict(),
                "tokens": {"access_token": access_token, "refresh_token": refresh_token}
            },
            "meta": None, "errors": None
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"data": None, "meta": None, "errors": [f"Registration failed: {str(e)}"]}), 500


# ============================================================
# AUTHENTICATED ENDPOINTS
# ============================================================

@licensing_bp.route('/my-subscription', methods=['GET'])
@jwt_required()
def my_subscription():
    """Get current user's subscription details"""
    user = get_current_user()
    
    subscription = Subscription.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(Subscription.created_at.desc()).first()
    if not subscription:
        return jsonify({"data": None, "meta": None, "errors": ["No subscription found"]}), 404
    
    plan = SubscriptionPlan.query.get(subscription.plan_id)
    licenses = License.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    
    days_left = (subscription.expiry_date - datetime.utcnow()).days if subscription.expiry_date else 0
    
    return jsonify({
        "data": {
            "subscription": subscription.to_dict(),
            "plan": plan.to_dict() if plan else None,
            "days_remaining": max(0, days_left),
            "is_expired": days_left <= 0,
            "licenses": [l.to_dict() for l in licenses],
            "device_count": DeviceRegistry.query.filter_by(tenant_id=user.tenant_id, is_active=True).count()
        },
        "meta": None, "errors": None
    }), 200


@licensing_bp.route('/upgrade', methods=['POST'])
@jwt_required()
def upgrade_plan():
    """Upgrade subscription plan (payment handled externally)"""
    user = get_current_user()
    data = request.get_json() or {}
    
    plan_id = data.get('plan_id')
    payment_ref = data.get('payment_ref')
    amount = data.get('amount')
    
    if not plan_id:
        return jsonify({"data": None, "meta": None, "errors": ["Plan ID required"]}), 400
    
    plan = SubscriptionPlan.query.get(plan_id)
    if not plan or not plan.is_active or plan.is_deleted:
        return jsonify({"data": None, "meta": None, "errors": ["Invalid plan"]}), 404
    
    try:
        # Deactivate old subscription
        old_sub = Subscription.query.filter_by(tenant_id=user.tenant_id, status='active').first()
        if old_sub:
            old_sub.status = 'cancelled'
            old_sub.cancelled_at = datetime.utcnow()
            db.session.add(old_sub)
        
        # Create new subscription
        billing_cycle = data.get('billing_cycle', plan.billing_cycle)
        duration_days = 365 if billing_cycle == 'annual' else 30
        
        subscription = Subscription(
            tenant_id=user.tenant_id, plan_id=plan.id,
            status='active', start_date=datetime.utcnow(),
            expiry_date=datetime.utcnow() + timedelta(days=duration_days),
            auto_renew=True
        )
        db.session.add(subscription)
        db.session.flush()
        
        # Record payment
        if payment_ref and amount:
            payment = Payment(
                tenant_id=user.tenant_id, subscription_id=subscription.id,
                amount=amount, currency='INR', provider=data.get('provider', 'razorpay'),
                provider_ref=payment_ref, status='completed',
                payment_method=data.get('payment_method', 'Online'),
                paid_at=datetime.utcnow()
            )
            db.session.add(payment)
        
        # Generate new license
        license_key = str(uuid.uuid4()).replace('-', '')[:32].upper()
        license = License(
            license_key=license_key, tenant_id=user.tenant_id, company_id=user.company_id,
            subscription_id=subscription.id, plan_id=plan.id,
            modules_json=plan.allowed_modules,
            max_bills=0, issued_at=datetime.utcnow(),
            expires_at=subscription.expiry_date, status='active', is_trial=False
        )
        db.session.add(license)
        db.session.flush()
        
        LicenseEvent(license_id=license.id, event_type='activated', triggered_by='customer',
                     event_payload={'plan': plan.name, 'billing_cycle': billing_cycle}).save()
        
        db.session.commit()
        
        return jsonify({
            "data": {
                "subscription": subscription.to_dict(),
                "license": license.to_dict(),
                "plan": plan.to_dict()
            },
            "meta": None, "errors": None
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 500


# ============================================================
# LICENSE & DEVICE MANAGEMENT
# ============================================================

@licensing_bp.route('/verify', methods=['POST'])
@rate_limit(max_calls=10, window_seconds=60)
def verify_license():
    """
    Verify a license key — used by the desktop EXE at startup and every 30 min.

    Phase 13 security checks (server-side):
      1. License key must exist and be active
      2. License must not be expired
      3. Device binding: once a device_id is recorded on the license, any
         subsequent verify from a DIFFERENT device_id is rejected (cloning)
      4. IP address logged on every call for security review
      5. Rate-limited to 10 calls/min per IP
    """
    data = request.get_json() or {}
    license_key = data.get('license_key', '').strip()
    device_id   = data.get('device_id', '').strip()
    device_name = data.get('device_name', 'Unknown')
    caller_ip   = request.remote_addr

    if not license_key:
        return jsonify({"data": None, "meta": None, "errors": ["License key required"]}), 400

    license = License.query.filter_by(license_key=license_key, is_deleted=False).first()
    if not license:
        write_audit_log(None, None, 'license', None, 'VERIFY_FAILED',
                        new_values={'reason': 'not_found', 'ip': caller_ip, 'key_prefix': license_key[:8]})
        return jsonify({"data": {"valid": False, "reason": "invalid_license_key"}, "meta": None, "errors": None}), 200

    if license.status != 'active':
        return jsonify({"data": {"valid": False, "reason": license.status}, "meta": None, "errors": None}), 200

    if license.expires_at and license.expires_at < datetime.utcnow():
        license.status = 'expired'
        db.session.commit()
        return jsonify({"data": {"valid": False, "reason": "expired"}, "meta": None, "errors": None}), 200

    # ── Phase 13: Device-binding enforcement ──────────────────────────────────
    if device_id:
        if license.device_id and license.device_id != device_id:
            # A different device is trying to use this license — cloning attempt
            write_audit_log(
                license.tenant_id, None, 'license', license.id, 'DEVICE_MISMATCH',
                old_values={'registered_device': license.device_id},
                new_values={'attempted_device': device_id, 'ip': caller_ip},
            )
            return jsonify({
                "data": {"valid": False, "reason": "device_mismatch",
                         "message": "This license is bound to a different device."},
                "meta": None, "errors": None
            }), 200

        if not license.device_id:
            # First activation — bind the license to this device
            license.device_id = device_id

        # Register / update DeviceRegistry
        device = DeviceRegistry.query.filter_by(device_id=device_id).first()
        if not device:
            plan = SubscriptionPlan.query.get(license.plan_id)
            max_devices = plan.allowed_devices if plan else 1
            current = DeviceRegistry.query.filter_by(
                tenant_id=license.tenant_id, is_active=True, is_deleted=False
            ).count()
            if current >= max_devices:
                return jsonify({
                    "data": {"valid": False, "reason": "device_limit_reached",
                             "message": f"Max {max_devices} device(s) allowed on this plan."},
                    "meta": None, "errors": None
                }), 200
            device = DeviceRegistry(
                tenant_id=license.tenant_id, device_id=device_id,
                device_name=device_name, device_type='desktop',
                last_ip_address=caller_ip, is_active=True,
            )
            db.session.add(device)
        else:
            if device.is_locked:
                return jsonify({
                    "data": {"valid": False, "reason": "device_locked",
                             "message": "This device has been locked by an administrator."},
                    "meta": None, "errors": None
                }), 200
            device.last_sync_at    = datetime.utcnow()
            device.last_ip_address = caller_ip
            device.is_active       = True

    license.last_verified_at = datetime.utcnow()

    # Deliver any pending server commands for this tenant
    from app.models.audit import EventLog
    pending_commands = EventLog.query.filter_by(
        tenant_id=license.tenant_id, event_name='server.command', processed=False
    ).all()
    commands = []
    for ev in pending_commands:
        commands.append(ev.payload_json)
        ev.processed = True

    db.session.commit()

    return jsonify({
        "data": {
            "valid":      True,
            "tenant_id":  license.tenant_id,
            "company_id": license.company_id,
            "plan_id":    license.plan_id,
            "modules":    license.modules_json,
            "max_bills":  license.max_bills,
            "expires_at": license.expires_at.isoformat() if license.expires_at else None,
            "is_trial":   license.is_trial,
            "device_id":  device_id,
            "commands":   commands,
        },
        "meta": None, "errors": None
    }), 200


@licensing_bp.route('/devices', methods=['GET'])
@jwt_required()
def list_devices():
    """List registered devices for the tenant"""
    user = get_current_user()
    devices = DeviceRegistry.query.filter_by(tenant_id=user.tenant_id).order_by(DeviceRegistry.last_sync_at.desc()).all()
    return jsonify({
        "data": [d.to_dict() for d in devices],
        "meta": None, "errors": None
    }), 200


@licensing_bp.route('/devices/<int:device_id>/deactivate', methods=['PUT'])
@jwt_required()
def deactivate_device(device_id):
    """Deactivate a registered device (free up slot)"""
    user = get_current_user()
    device = DeviceRegistry.query.filter_by(id=device_id, tenant_id=user.tenant_id).first()
    if not device:
        return jsonify({"data": None, "meta": None, "errors": ["Device not found"]}), 404
    
    device.is_active = False
    device.is_locked = True
    device.locked_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({"data": device.to_dict(), "meta": None, "errors": None}), 200


@licensing_bp.route('/check-update', methods=['POST'])
def check_update():
    """Check for software updates - used by desktop EXE"""
    data = request.get_json() or {}
    current_version = data.get('current_version', '0.0.0')
    
    # Version manifest - update this when new releases are shipped
    latest_version = '1.0.0'
    min_version = '1.0.0'
    
    def version_tuple(v):
        return tuple(map(int, v.split('.')))
    
    needs_update = version_tuple(current_version) < version_tuple(latest_version)
    is_compatible = version_tuple(current_version) >= version_tuple(min_version)
    
    return jsonify({
        "data": {
            "latest_version": latest_version,
            "current_version": current_version,
            "needs_update": needs_update,
            "is_compatible": is_compatible,
            "download_url": f"https://downloads.smartgonext.com/erp/v{latest_version}/SmartGoNext-ERP-Setup-{latest_version}.exe",
            "release_notes": f"Version {latest_version} - Bug fixes and improvements",
            "db_schema_version": "1.0"
        },
        "meta": None, "errors": None
    }), 200


@licensing_bp.route('/sync/upload', methods=['POST'])
@jwt_required()
def sync_upload():
    """Receive sync data from desktop EXE"""
    user = get_current_user()
    data = request.get_json() or {}
    
    record_type = data.get('record_type')
    record_id = data.get('record_id')
    record_data = data.get('data', {})
    
    server_id = None
    
    try:
        if record_type == 'customer':
            from app.models.customer import Customer
            phone = record_data.get('phone')
            existing = None
            if phone:
                existing = Customer.query.filter_by(tenant_id=user.tenant_id, phone=phone, is_deleted=False).first()
            
            if existing:
                server_id = existing.id
            else:
                cust = Customer(
                    tenant_id=user.tenant_id,
                    company_id=user.company_id,
                    name=record_data.get('name', 'Offline Customer'),
                    phone=phone or '0000000000',
                    email=record_data.get('email'),
                    address=record_data.get('address'),
                    city=record_data.get('city'),
                    state=record_data.get('state'),
                    pincode=record_data.get('pincode'),
                    gstin=record_data.get('gstin'),
                    pan=record_data.get('pan'),
                    credit_limit=record_data.get('credit_limit', 0.0),
                    is_active=True
                )
                db.session.add(cust)
                db.session.flush()
                server_id = cust.id
                
        elif record_type == 'product':
            from app.models.product import Product
            sku = record_data.get('sku')
            existing = None
            if sku:
                existing = Product.query.filter_by(tenant_id=user.tenant_id, sku=sku, is_deleted=False).first()
            
            if existing:
                server_id = existing.id
            else:
                prod = Product(
                    tenant_id=user.tenant_id,
                    name=record_data.get('name', 'Offline Product'),
                    sku=sku or str(uuid.uuid4())[:8],
                    selling_price=record_data.get('selling_price', 0.0),
                    purchase_price=record_data.get('purchase_price', 0.0),
                    is_active=True
                )
                db.session.add(prod)
                db.session.flush()
                server_id = prod.id
                
        elif record_type == 'invoice':
            from app.models.sales import Invoice, InvoiceItem
            from app.models.customer import Customer
            
            cust_id = record_data.get('customer_id')
            if isinstance(cust_id, str) and (cust_id.startswith('temp') or cust_id.startswith('local')):
                cust_phone = record_data.get('customer_phone')
                if cust_phone:
                    cust = Customer.query.filter_by(tenant_id=user.tenant_id, phone=cust_phone, is_deleted=False).first()
                    if cust:
                        cust_id = cust.id
                    else:
                        cust = Customer(
                            tenant_id=user.tenant_id,
                            company_id=user.company_id,
                            name=record_data.get('customer_name', 'Offline Cash Customer'),
                            phone=cust_phone,
                            is_active=True
                        )
                        db.session.add(cust)
                        db.session.flush()
                        cust_id = cust.id
            
            if not cust_id:
                cust = Customer.query.filter_by(tenant_id=user.tenant_id, phone='0000000000', is_deleted=False).first()
                if not cust:
                    cust = Customer(
                        tenant_id=user.tenant_id,
                        company_id=user.company_id,
                        name='Offline Cash Customer',
                        phone='0000000000',
                        is_active=True
                    )
                    db.session.add(cust)
                    db.session.flush()
                cust_id = cust.id

            inv = Invoice(
                tenant_id=user.tenant_id,
                company_id=user.company_id,
                customer_id=cust_id,
                invoice_number=record_data.get('invoice_number') or f"INV-OFFLINE-{str(uuid.uuid4())[:8].upper()}",
                invoice_date=datetime.fromisoformat(record_data.get('invoice_date').replace('Z', '+00:00')) if record_data.get('invoice_date') else datetime.utcnow(),
                type=record_data.get('type', 'Sales'),
                subtotal=record_data.get('subtotal', 0.0),
                discount_amount=record_data.get('discount_amount', 0.0),
                total_amount=record_data.get('total_amount', 0.0),
                net_amount=record_data.get('net_amount', 0.0),
                payment_method=record_data.get('payment_method', 'Cash'),
                payment_status=record_data.get('payment_status', 'Paid'),
                outstanding_balance=record_data.get('outstanding_balance', 0.0),
                is_pos=record_data.get('is_pos', True)
            )
            db.session.add(inv)
            db.session.flush()
            server_id = inv.id
            
            items = record_data.get('items', [])
            for item in items:
                inv_item = InvoiceItem(
                    tenant_id=user.tenant_id,
                    invoice_id=inv.id,
                    product_id=item.get('product_id'),
                    description=item.get('description'),
                    quantity=item.get('quantity', 1),
                    rate=item.get('rate', 0.0),
                    total_amount=item.get('total_amount', 0.0)
                )
                db.session.add(inv_item)
                
            # Publish event
            EventBus.publish('invoice.created', inv.to_dict())

        # Log sync
        from app.models.audit import SyncLog
        sync = SyncLog(
            tenant_id=user.tenant_id, sync_type='upload',
            status='completed', records_synced=1,
            completed_at=datetime.utcnow()
        )
        db.session.add(sync)
        db.session.commit()
        
        return jsonify({
            "data": {
                "message": "Synced successfully",
                "server_id": server_id,
                "local_id": record_id
            },
            "meta": None, "errors": None
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 500


@licensing_bp.route('/sync/download', methods=['GET'])
@jwt_required()
def sync_download():
    """Get pending sync data for desktop EXE"""
    user = get_current_user()
    since_str = request.args.get('since')
    
    since = None
    if since_str:
        try:
            since = datetime.fromisoformat(since_str.replace('Z', '+00:00'))
        except ValueError:
            pass
            
    from app.models.customer import Customer
    from app.models.product import Product
    
    cust_query = Customer.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    prod_query = Product.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    
    if since:
        cust_query = cust_query.filter(Customer.updated_at > since)
        prod_query = prod_query.filter(Product.updated_at > since)
        
    customers = cust_query.all()
    products = prod_query.all()
    
    return jsonify({
        "data": {
            "customers": [c.to_dict() for c in customers],
            "products": [p.to_dict() for p in products],
            "server_time": datetime.utcnow().isoformat()
        },
        "meta": None,
        "errors": None
    }), 200