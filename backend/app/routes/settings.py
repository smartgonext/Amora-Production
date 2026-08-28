from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.tenant import CompanySetting, NumberSeries, CustomFieldDefinition

settings_bp = Blueprint('settings', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))

@settings_bp.route('', methods=['GET'])
@jwt_required()
def get_settings():
    user = get_current_user()
    settings = CompanySetting.query.filter_by(tenant_id=user.tenant_id).all()
    return jsonify({"data": [s.to_dict() for s in settings], "errors": None}), 200

@settings_bp.route('', methods=['POST', 'PUT'])
@jwt_required()
def save_setting():
    user = get_current_user()
    data = request.get_json() or {}
    key = data.get('key')
    value = data.get('value')
    group = data.get('group', 'general')

    setting = CompanySetting.query.filter_by(tenant_id=user.tenant_id, setting_key=key).first()
    if not setting:
        setting = CompanySetting(tenant_id=user.tenant_id, company_id=user.company_id,
                                 setting_key=key, setting_value=value, setting_group=group)
        db.session.add(setting)
    else:
        setting.setting_value = value
        setting.setting_group = group

    db.session.commit()
    return jsonify({"data": setting.to_dict(), "errors": None}), 200

@settings_bp.route('/series', methods=['GET'])
@jwt_required()
def get_number_series():
    user = get_current_user()
    series = NumberSeries.query.filter_by(tenant_id=user.tenant_id).all()
    return jsonify({"data": [s.to_dict() for s in series], "errors": None}), 200
