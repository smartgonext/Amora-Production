"""Event Bus API - Expose events, notifications, and automations"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.extensions import db
from app.models.user import User
from app.models.audit import EventLog, Notification, AuditLog
from app.services.event_bus import EventBus

events_bp = Blueprint('events', __name__)


def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))


@events_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    """Get notifications for the current tenant"""
    user = get_current_user()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    unread_only = request.args.get('unread_only', 'false') == 'true'

    query = Notification.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    if unread_only:
        query = query.filter_by(is_read=False)
    
    query = query.order_by(Notification.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "data": [n.to_dict() for n in pagination.items],
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "pages": pagination.pages
        },
        "errors": None
    }), 200


@events_bp.route('/notifications/<int:notification_id>/read', methods=['PUT'])
@jwt_required()
def mark_notification_read(notification_id):
    """Mark a notification as read"""
    notification = Notification.query.filter_by(id=notification_id, is_deleted=False).first()
    if not notification:
        return jsonify({"data": None, "meta": None, "errors": ["Notification not found"]}), 404

    notification.is_read = True
    db.session.commit()

    return jsonify({"data": notification.to_dict(), "meta": None, "errors": None}), 200


@events_bp.route('/notifications/read-all', methods=['PUT'])
@jwt_required()
def mark_all_notifications_read():
    """Mark all notifications as read for current tenant"""
    user = get_current_user()
    Notification.query.filter_by(tenant_id=user.tenant_id, is_read=False, is_deleted=False).update({'is_read': True})
    db.session.commit()

    return jsonify({"data": {"message": "All notifications marked as read"}, "meta": None, "errors": None}), 200


@events_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_event_logs():
    """Get event bus history"""
    user = get_current_user()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    event_name = request.args.get('event_name')

    query = EventLog.query.filter_by(tenant_id=user.tenant_id)
    if event_name:
        query = query.filter_by(event_name=event_name)
    
    query = query.order_by(EventLog.fired_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "data": [e.to_dict() for e in pagination.items],
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "pages": pagination.pages
        },
        "errors": None
    }), 200


@events_bp.route('/emit', methods=['POST'])
@jwt_required()
def emit_event():
    """Manually emit an event (for testing/API triggers)"""
    user = get_current_user()
    data = request.get_json() or {}

    event_name = data.get('event_name')
    entity_type = data.get('entity_type')
    entity_id = data.get('entity_id')
    payload = data.get('payload')

    if not event_name:
        return jsonify({"data": None, "meta": None, "errors": ["event_name is required"]}), 400

    results = EventBus.emit(
        event_name=event_name,
        tenant_id=user.tenant_id,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload
    )

    return jsonify({
        "data": {"event_name": event_name, "listeners_triggered": len(results), "results": results},
        "meta": None,
        "errors": None
    }), 200


@events_bp.route('/audit-logs', methods=['GET'])
@jwt_required()
def get_audit_logs():
    """Get audit log entries"""
    user = get_current_user()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    entity_type = request.args.get('entity_type')

    query = AuditLog.query.filter_by(tenant_id=user.tenant_id)
    if entity_type:
        query = query.filter_by(entity_type=entity_type)
    
    query = query.order_by(AuditLog.timestamp.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "data": [a.to_dict() for a in pagination.items],
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "pages": pagination.pages
        },
        "errors": None
    }), 200