"""
Superadmin Routes — Phase 12: Remote Admin Control
All endpoints require is_superadmin=True on the JWT identity.

Actions covered per spec Part 19.14:
  suspend license, reactivate license, extend expiry, change plan,
  reset device activation, force logout, force update check,
  send in-app announcement, trigger remote backup,
  per-tenant dashboard detail view.
"""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.tenant import (
    Tenant, SubscriptionPlan, Subscription, License, LicenseEvent, DeviceRegistry
)
from app.models.user import User, UserSession
from app.models.audit import BackupLog, SyncLog, EventLog

superadmin_bp = Blueprint('superadmin', __name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_superadmin():
    uid = get_jwt_identity()
    user = User.query.get(int(uid)) if uid else None
    if not user or not user.is_superadmin:
        return None, (jsonify({"data": None, "meta": None,
                               "errors": ["Superadmin access required."]}), 403)
    return user, None


def _emit_license_event(license_id, event_type, payload=None):
    db.session.add(LicenseEvent(
        license_id=license_id,
        event_type=event_type,
        event_payload=payload or {},
        created_at=datetime.utcnow(),
    ))


def _queue_server_command(tenant_id, command_type, payload):
    """Store a pending command in EventLog; sync/download delivers it to the client."""
    db.session.add(EventLog(
        tenant_id=tenant_id,
        event_name='server.command',
        entity_type='command',
        entity_id=None,
        payload_json={'type': command_type, **payload},
        fired_at=datetime.utcnow(),
        processed=False,
    ))


def _tenant_summary(tenant):
    active_sub = Subscription.query.filter_by(tenant_id=tenant.id, status='active').first()
    trial_sub = Subscription.query.filter_by(tenant_id=tenant.id, status='trial').first()
    sub = active_sub or trial_sub

    plan_name = days_remaining = expiry_date = None
    if sub:
        plan = SubscriptionPlan.query.get(sub.plan_id)
        plan_name = plan.name if plan else None
        if sub.expiry_date:
            expiry_date = sub.expiry_date.isoformat()
            days_remaining = (sub.expiry_date - datetime.utcnow()).days

    devices = DeviceRegistry.query.filter_by(tenant_id=tenant.id, is_deleted=False).all()
    last_backup = (BackupLog.query
                   .filter_by(tenant_id=tenant.id, status='completed', is_deleted=False)
                   .order_by(BackupLog.completed_at.desc()).first())
    last_sync = (SyncLog.query
                 .filter_by(tenant_id=tenant.id, status='completed', is_deleted=False)
                 .order_by(SyncLog.completed_at.desc()).first())

    return {
        "id": tenant.id,
        "name": tenant.name,
        "subdomain": tenant.subdomain,
        "is_active": tenant.is_active,
        "db_status": tenant.db_status,
        "contact_email": tenant.contact_email,
        "contact_phone": tenant.contact_phone,
        "business_type": tenant.business_type,
        "plan_name": plan_name,
        "subscription_status": sub.status if sub else None,
        "expiry_date": expiry_date,
        "days_remaining": days_remaining,
        "device_count": len(devices),
        "active_device_count": sum(1 for d in devices if d.is_active and not d.is_locked),
        "last_backup_at": last_backup.completed_at.isoformat() if last_backup else None,
        "last_backup_status": last_backup.status if last_backup else None,
        "last_sync_at": last_sync.completed_at.isoformat() if last_sync else None,
        "created_at": tenant.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Plans
# ---------------------------------------------------------------------------

@superadmin_bp.route('/plans', methods=['GET'])
@jwt_required()
def get_plans():
    _, err = _require_superadmin()
    if err:
        return err
    plans = SubscriptionPlan.query.filter_by(is_deleted=False).order_by(SubscriptionPlan.sort_order).all()
    return jsonify({"data": [p.to_dict() for p in plans], "meta": None, "errors": None}), 200


@superadmin_bp.route('/plans', methods=['POST'])
@jwt_required()
def create_plan():
    _, err = _require_superadmin()
    if err:
        return err
    data = request.get_json() or {}
    if not data.get('name') or data.get('price') is None:
        return jsonify({"data": None, "meta": None, "errors": ["name and price required."]}), 400
    plan = SubscriptionPlan(
        name=data['name'],
        price=data['price'],
        billing_cycle=data.get('billing_cycle', 'monthly'),
        allowed_devices=data.get('allowed_devices', 1),
        max_users=data.get('max_users', 5),
        description=data.get('description', ''),
    )
    db.session.add(plan)
    db.session.commit()
    return jsonify({"data": plan.to_dict(), "meta": None, "errors": None}), 201


# ---------------------------------------------------------------------------
# Tenant list + detail
# ---------------------------------------------------------------------------

@superadmin_bp.route('/tenants', methods=['GET'])
@jwt_required()
def get_tenants():
    _, err = _require_superadmin()
    if err:
        return err

    page = int(request.args.get('page', 1))
    page_size = min(int(request.args.get('page_size', 25)), 100)
    q = request.args.get('q', '').strip()
    status_filter = request.args.get('status', '')

    query = Tenant.query.filter_by(is_deleted=False)
    if q:
        query = query.filter(db.or_(
            Tenant.name.ilike(f'%{q}%'),
            Tenant.subdomain.ilike(f'%{q}%'),
            Tenant.contact_email.ilike(f'%{q}%'),
        ))
    if status_filter:
        query = query.filter_by(db_status=status_filter)

    total = query.count()
    tenants = query.order_by(Tenant.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return jsonify({
        "data": [_tenant_summary(t) for t in tenants],
        "meta": {"page": page, "page_size": page_size, "total": total},
        "errors": None,
    }), 200


@superadmin_bp.route('/tenants/<int:tenant_id>', methods=['GET'])
@jwt_required()
def get_tenant_detail(tenant_id):
    _, err = _require_superadmin()
    if err:
        return err

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        return jsonify({"data": None, "meta": None, "errors": ["Tenant not found."]}), 404

    summary = _tenant_summary(tenant)

    devices = DeviceRegistry.query.filter_by(tenant_id=tenant_id, is_deleted=False).all()
    summary['devices'] = [{
        "id": d.id, "device_id": d.device_id, "device_name": d.device_name,
        "device_type": d.device_type, "os_info": d.os_info, "app_version": d.app_version,
        "db_schema_version": d.db_schema_version,
        "last_sync_at": d.last_sync_at.isoformat() if d.last_sync_at else None,
        "last_ip_address": d.last_ip_address, "is_active": d.is_active,
        "is_locked": d.is_locked,
        "locked_at": d.locked_at.isoformat() if d.locked_at else None,
    } for d in devices]

    recent_backups = (BackupLog.query.filter_by(tenant_id=tenant_id, is_deleted=False)
                      .order_by(BackupLog.started_at.desc()).limit(5).all())
    summary['recent_backups'] = [{
        "id": b.id, "backup_type": b.backup_type, "file_name": b.file_name,
        "file_size": b.file_size, "status": b.status,
        "started_at": b.started_at.isoformat() if b.started_at else None,
        "completed_at": b.completed_at.isoformat() if b.completed_at else None,
    } for b in recent_backups]

    lic = (License.query.filter_by(tenant_id=tenant_id, is_deleted=False)
           .order_by(License.issued_at.desc()).first())
    summary['license'] = {
        "id": lic.id, "license_key": lic.license_key, "status": lic.status,
        "is_trial": lic.is_trial,
        "expires_at": lic.expires_at.isoformat() if lic.expires_at else None,
        "last_verified_at": lic.last_verified_at.isoformat() if lic.last_verified_at else None,
    } if lic else None

    return jsonify({"data": summary, "meta": None, "errors": None}), 200


# ---------------------------------------------------------------------------
# Global stats
# ---------------------------------------------------------------------------

@superadmin_bp.route('/stats', methods=['GET'])
@jwt_required()
def admin_stats():
    _, err = _require_superadmin()
    if err:
        return err

    return jsonify({
        "data": {
            "total_tenants":  Tenant.query.filter_by(is_deleted=False).count(),
            "active_tenants": Tenant.query.filter_by(is_deleted=False, is_active=True).count(),
            "suspended":      Tenant.query.filter_by(is_deleted=False, db_status='suspended').count(),
            "trial":          Subscription.query.filter_by(status='trial').count(),
            "expiring_soon":  Subscription.query.filter(
                Subscription.status == 'active',
                Subscription.expiry_date <= datetime.utcnow() + timedelta(days=7),
                Subscription.expiry_date >= datetime.utcnow(),
                Subscription.is_deleted == False,
            ).count(),
            "total_devices":  DeviceRegistry.query.filter_by(is_deleted=False).count(),
            "active_devices": DeviceRegistry.query.filter_by(is_deleted=False, is_active=True, is_locked=False).count(),
        },
        "meta": None, "errors": None,
    }), 200


# ---------------------------------------------------------------------------
# Remote admin actions
# ---------------------------------------------------------------------------

@superadmin_bp.route('/tenants/<int:tenant_id>/suspend', methods=['POST'])
@jwt_required()
def suspend_tenant(tenant_id):
    admin, err = _require_superadmin()
    if err:
        return err
    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        return jsonify({"data": None, "meta": None, "errors": ["Tenant not found."]}), 404
    reason = (request.get_json() or {}).get('reason', 'Suspended by admin.')
    tenant.is_active = False
    tenant.db_status = 'suspended'
    lic = (License.query.filter_by(tenant_id=tenant_id, is_deleted=False)
           .order_by(License.issued_at.desc()).first())
    if lic:
        lic.status = 'suspended'
        _emit_license_event(lic.id, 'suspended', {'reason': reason, 'admin_id': admin.id})
    _queue_server_command(tenant_id, 'license_suspended', {'reason': reason})
    db.session.commit()
    return jsonify({"data": {"tenant_id": tenant_id, "status": "suspended"}, "meta": None, "errors": None}), 200


@superadmin_bp.route('/tenants/<int:tenant_id>/reactivate', methods=['POST'])
@jwt_required()
def reactivate_tenant(tenant_id):
    admin, err = _require_superadmin()
    if err:
        return err
    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        return jsonify({"data": None, "meta": None, "errors": ["Tenant not found."]}), 404
    tenant.is_active = True
    tenant.db_status = 'active'
    lic = (License.query.filter_by(tenant_id=tenant_id, is_deleted=False)
           .order_by(License.issued_at.desc()).first())
    if lic:
        lic.status = 'active'
        _emit_license_event(lic.id, 'reactivated', {'admin_id': admin.id})
    db.session.commit()
    return jsonify({"data": {"tenant_id": tenant_id, "status": "active"}, "meta": None, "errors": None}), 200


@superadmin_bp.route('/tenants/<int:tenant_id>/extend-expiry', methods=['POST'])
@jwt_required()
def extend_expiry(tenant_id):
    admin, err = _require_superadmin()
    if err:
        return err
    days = int((request.get_json() or {}).get('days', 30))
    if days < 1:
        return jsonify({"data": None, "meta": None, "errors": ["days must be >= 1."]}), 400
    sub = (Subscription.query.filter_by(tenant_id=tenant_id)
           .order_by(Subscription.created_at.desc()).first())
    if not sub:
        return jsonify({"data": None, "meta": None, "errors": ["No subscription found."]}), 404
    new_expiry = (sub.expiry_date or datetime.utcnow()) + timedelta(days=days)
    sub.expiry_date = new_expiry
    if sub.status in ('expired', 'suspended'):
        sub.status = 'active'
    lic = (License.query.filter_by(tenant_id=tenant_id, is_deleted=False)
           .order_by(License.issued_at.desc()).first())
    if lic:
        lic.expires_at = new_expiry
        if lic.status in ('expired', 'suspended'):
            lic.status = 'active'
        _emit_license_event(lic.id, 'expiry_extended',
                            {'days': days, 'new_expiry': new_expiry.isoformat(), 'admin_id': admin.id})
    tenant = Tenant.query.get(tenant_id)
    if tenant and not tenant.is_active:
        tenant.is_active = True
        tenant.db_status = 'active'
    db.session.commit()
    return jsonify({"data": {"tenant_id": tenant_id, "new_expiry": new_expiry.isoformat()}, "meta": None, "errors": None}), 200


@superadmin_bp.route('/tenants/<int:tenant_id>/change-plan', methods=['POST'])
@jwt_required()
def change_plan(tenant_id):
    admin, err = _require_superadmin()
    if err:
        return err
    plan_id = (request.get_json() or {}).get('plan_id')
    if not plan_id:
        return jsonify({"data": None, "meta": None, "errors": ["plan_id required."]}), 400
    plan = SubscriptionPlan.query.filter_by(id=plan_id, is_deleted=False).first()
    if not plan:
        return jsonify({"data": None, "meta": None, "errors": ["Plan not found."]}), 404
    sub = (Subscription.query.filter_by(tenant_id=tenant_id)
           .order_by(Subscription.created_at.desc()).first())
    if sub:
        old_plan_id = sub.plan_id
        sub.plan_id = plan_id
        lic = (License.query.filter_by(tenant_id=tenant_id, is_deleted=False)
               .order_by(License.issued_at.desc()).first())
        if lic:
            lic.plan_id = plan_id
            lic.modules_json = plan.allowed_modules
            _emit_license_event(lic.id, 'plan_changed',
                                {'old_plan_id': old_plan_id, 'new_plan_id': plan_id, 'admin_id': admin.id})
    db.session.commit()
    return jsonify({"data": {"tenant_id": tenant_id, "plan_id": plan_id, "plan_name": plan.name}, "meta": None, "errors": None}), 200


@superadmin_bp.route('/tenants/<int:tenant_id>/devices/<int:device_reg_id>/reset', methods=['POST'])
@jwt_required()
def reset_device(tenant_id, device_reg_id):
    admin, err = _require_superadmin()
    if err:
        return err
    device = DeviceRegistry.query.filter_by(id=device_reg_id, tenant_id=tenant_id, is_deleted=False).first()
    if not device:
        return jsonify({"data": None, "meta": None, "errors": ["Device not found."]}), 404
    device.is_active = False
    device.is_locked = True
    device.locked_at = datetime.utcnow()
    device.notes = f"Reset by admin id={admin.id} at {datetime.utcnow().isoformat()}"
    db.session.commit()
    return jsonify({"data": {"device_id": device.device_id, "status": "reset"}, "meta": None, "errors": None}), 200


@superadmin_bp.route('/tenants/<int:tenant_id>/devices/<int:device_reg_id>/unlock', methods=['POST'])
@jwt_required()
def unlock_device(tenant_id, device_reg_id):
    _, err = _require_superadmin()
    if err:
        return err
    device = DeviceRegistry.query.filter_by(id=device_reg_id, tenant_id=tenant_id, is_deleted=False).first()
    if not device:
        return jsonify({"data": None, "meta": None, "errors": ["Device not found."]}), 404
    device.is_active = True
    device.is_locked = False
    device.locked_at = None
    db.session.commit()
    return jsonify({"data": {"device_id": device.device_id, "status": "unlocked"}, "meta": None, "errors": None}), 200


@superadmin_bp.route('/tenants/<int:tenant_id>/force-logout', methods=['POST'])
@jwt_required()
def force_logout(tenant_id):
    admin, err = _require_superadmin()
    if err:
        return err
    reason = (request.get_json() or {}).get('reason', 'Logged out remotely by admin.')
    sessions = UserSession.query.filter_by(tenant_id=tenant_id, is_active=True).all()
    for s in sessions:
        s.is_active = False
    _queue_server_command(tenant_id, 'force_logout', {'reason': reason, 'admin_id': admin.id})
    db.session.commit()
    return jsonify({"data": {"tenant_id": tenant_id, "sessions_revoked": len(sessions)}, "meta": None, "errors": None}), 200


@superadmin_bp.route('/tenants/<int:tenant_id>/force-update', methods=['POST'])
@jwt_required()
def force_update_check(tenant_id):
    _, err = _require_superadmin()
    if err:
        return err
    _queue_server_command(tenant_id, 'force_update_check', {})
    db.session.commit()
    return jsonify({"data": {"tenant_id": tenant_id, "command": "force_update_check"}, "meta": None, "errors": None}), 200


@superadmin_bp.route('/tenants/<int:tenant_id>/announcement', methods=['POST'])
@jwt_required()
def send_announcement(tenant_id):
    admin, err = _require_superadmin()
    if err:
        return err
    data = request.get_json() or {}
    message = data.get('message', '')
    if not message:
        return jsonify({"data": None, "meta": None, "errors": ["message is required."]}), 400
    _queue_server_command(tenant_id, 'send_announcement', {
        'title': data.get('title', 'System Notice'),
        'message': message,
        'level': data.get('level', 'info'),
        'admin_id': admin.id,
    })
    db.session.commit()
    return jsonify({"data": {"tenant_id": tenant_id, "command": "announcement_sent"}, "meta": None, "errors": None}), 200


@superadmin_bp.route('/tenants/<int:tenant_id>/remote-backup', methods=['POST'])
@jwt_required()
def remote_backup_trigger(tenant_id):
    _, err = _require_superadmin()
    if err:
        return err
    from app.services.backup_service import create_backup
    try:
        log = create_backup(tenant_id=tenant_id, backup_type='remote')
        return jsonify({
            "data": {
                "id": log.id, "tenant_id": tenant_id, "file_name": log.file_name,
                "status": log.status,
                "completed_at": log.completed_at.isoformat() if log.completed_at else None,
            },
            "meta": None, "errors": None,
        }), 201
    except Exception as e:
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 500
