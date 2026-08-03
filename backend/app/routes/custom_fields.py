from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User
from app.services import form_builder_service

custom_fields_bp = Blueprint('custom_fields', __name__)


def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))


@custom_fields_bp.route('/schema', methods=['GET'])
@jwt_required()
def get_schema():
    """Retrieve full dynamic form schema for an entity type"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    entity_type = request.args.get('entity_type', 'product')
    schema = form_builder_service.get_form_schema(
        tenant_id=user.tenant_id,
        entity_type=entity_type,
        company_id=user.company_id
    )

    return jsonify({"data": schema, "meta": {"entity_type": entity_type}, "errors": None}), 200


@custom_fields_bp.route('/sections', methods=['POST'])
@jwt_required()
def create_section_route():
    """Create a new section"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    data = request.get_json() or {}
    section_name = data.get('section_name')
    entity_type = data.get('entity_type', 'product')

    if not section_name:
        return jsonify({"data": None, "meta": None, "errors": ["Section name is required"]}), 400

    sec = form_builder_service.create_section(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        entity_type=entity_type,
        section_name=section_name,
        sort_order=data.get('sort_order', 0)
    )

    return jsonify({"data": sec.to_dict(), "meta": None, "errors": None}), 201


@custom_fields_bp.route('/sections/<int:section_id>', methods=['PUT'])
@jwt_required()
def update_section_route(section_id):
    """Update section details"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    data = request.get_json() or {}
    sec = form_builder_service.update_section(section_id, user.tenant_id, data)

    if not sec:
        return jsonify({"data": None, "meta": None, "errors": ["Section not found"]}), 404

    return jsonify({"data": sec.to_dict(), "meta": None, "errors": None}), 200


@custom_fields_bp.route('/sections/<int:section_id>', methods=['DELETE'])
@jwt_required()
def delete_section_route(section_id):
    """Delete section"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    success = form_builder_service.delete_section(section_id, user.tenant_id)
    if not success:
        return jsonify({"data": None, "meta": None, "errors": ["Section not found"]}), 404

    return jsonify({"data": {"message": "Section deleted successfully"}, "meta": None, "errors": None}), 200


@custom_fields_bp.route('/fields', methods=['POST'])
@jwt_required()
def create_field_route():
    """Create a new custom field"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    data = request.get_json() or {}
    section_id = data.get('section_id')

    if not section_id:
        return jsonify({"data": None, "meta": None, "errors": ["Section ID is required"]}), 400

    field = form_builder_service.create_field(user.tenant_id, section_id, data)
    if not field:
        return jsonify({"data": None, "meta": None, "errors": ["Section not found"]}), 404

    return jsonify({"data": field.to_dict(), "meta": None, "errors": None}), 201


@custom_fields_bp.route('/fields/<int:field_id>', methods=['PUT'])
@jwt_required()
def update_field_route(field_id):
    """Update field properties"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    data = request.get_json() or {}
    field = form_builder_service.update_field(field_id, user.tenant_id, data)

    if not field:
        return jsonify({"data": None, "meta": None, "errors": ["Field not found"]}), 404

    return jsonify({"data": field.to_dict(), "meta": None, "errors": None}), 200


@custom_fields_bp.route('/fields/<int:field_id>', methods=['DELETE'])
@jwt_required()
def delete_field_route(field_id):
    """Delete field"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    try:
        success = form_builder_service.delete_field(field_id, user.tenant_id)
        if not success:
            return jsonify({"data": None, "meta": None, "errors": ["Field not found"]}), 404
        return jsonify({"data": {"message": "Field deleted successfully"}, "meta": None, "errors": None}), 200
    except ValueError as err:
        return jsonify({"data": None, "meta": None, "errors": [str(err)]}), 400


@custom_fields_bp.route('/fields/<int:field_id>/options', methods=['POST'])
@jwt_required()
def add_field_option_route(field_id):
    """
    Append a new option to a select field dynamically.
    Powers the inline '+' option creator button.
    """
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    data = request.get_json() or {}
    option_value = data.get('option')

    if not option_value:
        return jsonify({"data": None, "meta": None, "errors": ["Option text is required"]}), 400

    field = form_builder_service.append_field_option(field_id, user.tenant_id, option_value)
    if not field:
        return jsonify({"data": None, "meta": None, "errors": ["Field not found"]}), 404

    return jsonify({"data": field.to_dict(), "meta": None, "errors": None}), 200


@custom_fields_bp.route('/reorder', methods=['POST'])
@jwt_required()
def reorder_schema_route():
    """Reorder sections and fields"""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    data = request.get_json() or {}
    entity_type = data.get('entity_type', 'product')
    reorder_data = data.get('reorder_data', [])

    form_builder_service.reorder_sections_and_fields(user.tenant_id, entity_type, reorder_data)
    return jsonify({"data": {"message": "Reordered successfully"}, "meta": None, "errors": None}), 200
