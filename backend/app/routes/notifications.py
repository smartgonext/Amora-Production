from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.extensions import db
from app.models.user import User
from app.models.audit import Notification
from app.models.product import Product, Warehouse

notifications_bp = Blueprint('notifications', __name__)


def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))


@notifications_bp.route('', methods=['GET'])
@jwt_required()
def get_notifications():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "errors": ["User not found"]}), 404

    # Get user-specific + global (company_id is None) notifications for this tenant
    notifications = Notification.query.filter(
        Notification.tenant_id == user.tenant_id,
        Notification.is_deleted == False,
        ((Notification.user_id == user.id) | (Notification.company_id.is_(None)))
    ).order_by(Notification.created_at.desc()).limit(50).all()

    unread_count = Notification.query.filter(
        Notification.tenant_id == user.tenant_id,
        Notification.is_read == False,
        ((Notification.user_id == user.id) | (Notification.company_id.is_(None)))
    ).count()

    # Get low stock alerts count
    low_stock_products_count = Product.query.filter(
        Product.tenant_id == user.tenant_id,
        Product.is_deleted == False,
        Product.current_stock <= Product.min_stock_level,
        Product.min_stock_level > 0
    ).count()

    return jsonify({
        "data": [{
            "id": n.id,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "reference_type": n.reference_type,
            "reference_id": n.reference_id,
            "action_url": n.action_url,
            "created_at": n.created_at.isoformat() if n.created_at else None
        } for n in notifications],
        "meta": {
            "unread_count": unread_count,
            "low_stock_alerts": low_stock_products_count
        },
        "errors": None
    }), 200


@notifications_bp.route('/read/<int:notification_id>', methods=['POST'])
@jwt_required()
def mark_read(notification_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "errors": ["User not found"]}), 404

    notif = db.session.get(Notification, notification_id)
    if not notif or notif.tenant_id != user.tenant_id:
        return jsonify({"data": None, "errors": ["Notification not found"]}), 404

    notif.is_read = True
    notif.read_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"data": {"success": True}, "errors": None}), 200


@notifications_bp.route('/read/all', methods=['POST'])
@jwt_required()
def mark_all_read():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "errors": ["User not found"]}), 404

    Notification.query.filter(
        Notification.tenant_id == user.tenant_id,
        Notification.is_read == False,
        ((Notification.user_id == user.id) | (Notification.company_id == None))
    ).update({"is_read": True})
    db.session.commit()

    return jsonify({"data": {"success": True}, "errors": None}), 200