from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.tenant import Subscription, SubscriptionPlan

subscriptions_bp = Blueprint('subscriptions', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))

@subscriptions_bp.route('', methods=['GET'])
@jwt_required()
def get_subscription():
    user = get_current_user()
    sub = Subscription.query.filter_by(tenant_id=user.tenant_id).first()
    if not sub:
        return jsonify({"data": None, "errors": ["No active subscription found"]}), 404
    return jsonify({"data": sub.to_dict(), "errors": None}), 200

@subscriptions_bp.route('/plans', methods=['GET'])
def get_plans():
    plans = SubscriptionPlan.query.filter_by(is_active=True).all()
    return jsonify({"data": [p.to_dict() for p in plans], "errors": None}), 200
