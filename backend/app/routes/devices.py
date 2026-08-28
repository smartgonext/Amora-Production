from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.tenant import DeviceRegistry

devices_bp = Blueprint('devices', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))

@devices_bp.route('', methods=['GET'])
@jwt_required()
def get_devices():
    user = get_current_user()
    devices = DeviceRegistry.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({"data": [d.to_dict() for d in devices], "errors": None}), 200

@devices_bp.route('', methods=['POST'])
@jwt_required()
def register_device():
    user = get_current_user()
    data = request.get_json() or {}
    
    device = DeviceRegistry(
        tenant_id=user.tenant_id,
        device_id=data.get('device_uuid') or data.get('device_id'),
        device_name=data.get('device_name'),
        os_info=data.get('os_version') or data.get('os_info'),
        is_active=True
    )
    db.session.add(device)
    db.session.commit()
    return jsonify({"data": device.to_dict(), "errors": None}), 201
