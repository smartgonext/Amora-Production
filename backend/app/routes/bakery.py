"""Bakery feature routes: recipe scaling & label generation.

Gated to bakery/process tenants by the front-end nav. These endpoints are
thin wrappers around `app.services.bakery_service`.
"""
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models.user import User
from app.models.tenant import Company
from app.services.bakery_service import scale_formula, generate_label
from app.services.bakery_planner import (
    build_daily_bake_plan, get_bake_plan, list_bake_plans,
    update_plan_line, update_plan_status,
)
from app.services.bakery_operations import (
    fefo_pick_list, record_unsold_return, list_unsold_returns,
    create_delivery_route, list_delivery_routes, update_route_status,
    add_haccp_check, list_haccp_checks, compute_day_cost,
)
from flask_jwt_extended import get_jwt_identity

bakery_bp = Blueprint('bakery', __name__)


def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))


@bakery_bp.route('/recipe-scale', methods=['POST'])
@jwt_required()
def recipe_scale():
    """Scale a recipe (BOM) to a target dough weight using baker's %."""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    data = request.get_json() or {}
    bom_id = data.get('bom_id')
    target = data.get('target_dough_weight')
    if not bom_id:
        return jsonify({"data": None, "meta": None, "errors": ["bom_id is required"]}), 400
    if target is None:
        return jsonify({"data": None, "meta": None, "errors": ["target_dough_weight is required"]}), 400

    # Security: ensure the BOM belongs to this tenant.
    from app.models.manufacturing import BomHeader
    bom = BomHeader.query.filter_by(id=int(bom_id), tenant_id=user.tenant_id, is_deleted=False).first()
    if not bom:
        return jsonify({"data": None, "meta": None, "errors": ["BOM not found"]}), 404

    try:
        result = scale_formula(bom.id, target)
    except ValueError as e:
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 400

    return jsonify({"data": result, "meta": None, "errors": None}), 200


@bakery_bp.route('/label/<int:product_id>', methods=['GET'])
@jwt_required()
def label(product_id):
    """Generate a nutrition + allergen label for a product."""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    from app.models.product import Product
    product = Product.query.filter_by(id=product_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not product:
        return jsonify({"data": None, "meta": None, "errors": ["Product not found"]}), 404

    try:
        result = generate_label(product.id)
    except ValueError as e:
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 400

    return jsonify({"data": result, "meta": None, "errors": None}), 200


@bakery_bp.route('/bake-plans', methods=['POST'])
@jwt_required()
def create_bake_plan():
    """Generate (or fetch) the daily bake plan for a date/shift."""
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    data = request.get_json() or {}
    d = data.get('plan_date')
    shift = data.get('shift', 'Morning')
    if not d:
        return jsonify({"data": None, "meta": None, "errors": ["plan_date is required"]}), 400
    try:
        plan, created = build_daily_bake_plan(user.tenant_id, user.company_id, d, shift)
    except ValueError as e:
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 400
    return jsonify({"data": plan.to_dict(), "meta": {"created": created}, "errors": None}), 201


@bakery_bp.route('/bake-plans', methods=['GET'])
@jwt_required()
def list_bake_plan_endpoint():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    d = request.args.get('plan_date')
    plans = list_bake_plans(user.tenant_id, d=d)
    return jsonify({"data": [p.to_dict() for p in plans],
                    "meta": {"count": len(plans)}, "errors": None}), 200


@bakery_bp.route('/bake-plans/<int:plan_id>', methods=['GET'])
@jwt_required()
def get_bake_plan_endpoint(plan_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    plan = get_bake_plan(user.tenant_id, None, plan_id=plan_id)
    if not plan:
        return jsonify({"data": None, "meta": None, "errors": ["Bake plan not found"]}), 404
    return jsonify({"data": plan.to_dict(), "meta": None, "errors": None}), 200


@bakery_bp.route('/bake-plans/<int:plan_id>/status', methods=['PUT'])
@jwt_required()
def update_bake_plan_status(plan_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    status = (request.get_json() or {}).get('status')
    if not status:
        return jsonify({"data": None, "meta": None, "errors": ["status is required"]}), 400
    plan = update_plan_status(plan_id, user.tenant_id, status)
    if not plan:
        return jsonify({"data": None, "meta": None, "errors": ["Bake plan not found"]}), 404
    return jsonify({"data": plan.to_dict(), "meta": None, "errors": None}), 200


@bakery_bp.route('/bake-plans/items/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_bake_plan_item(item_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    data = request.get_json() or {}
    line = update_plan_line(item_id, user.tenant_id, data)
    if not line:
        return jsonify({"data": None, "meta": None, "errors": ["Bake plan item not found"]}), 404
    return jsonify({"data": line.to_dict(), "meta": None, "errors": None}), 200

    return jsonify({"data": line.to_dict(), "meta": None, "errors": None}), 200


# --- FEFO / freshness ---
@bakery_bp.route('/fefo', methods=['GET'])
@jwt_required()
def fefo():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    product_id = request.args.get('product_id')
    data = fefo_pick_list(user.tenant_id, product_id=product_id)
    return jsonify({"data": data, "meta": {"count": len(data)}, "errors": None}), 200


# --- Unsold fresh-stock return -> credit note ---
@bakery_bp.route('/unsold-returns', methods=['GET'])
@jwt_required()
def get_unsold_returns():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    returns = list_unsold_returns(user.tenant_id)
    return jsonify({"data": [r.to_dict() for r in returns], "errors": None}), 200


@bakery_bp.route('/unsold-returns', methods=['POST'])
@jwt_required()
def create_unsold_return():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    try:
        s_return = record_unsold_return(user.tenant_id, user.company_id,
                                        request.get_json() or {})
    except ValueError as e:
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 400
    return jsonify({"data": s_return.to_dict(), "meta": None, "errors": None}), 201


# --- Delivery routes ---
@bakery_bp.route('/delivery-routes', methods=['GET'])
@jwt_required()
def get_delivery_routes():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    d = request.args.get('route_date')
    routes = list_delivery_routes(user.tenant_id, d=d)
    return jsonify({"data": [r.to_dict() for r in routes], "errors": None}), 200


@bakery_bp.route('/delivery-routes', methods=['POST'])
@jwt_required()
def create_route():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    try:
        route = create_delivery_route(user.tenant_id, user.company_id,
                                      request.get_json() or {})
    except ValueError as e:
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 400
    return jsonify({"data": route.to_dict(), "meta": None, "errors": None}), 201


@bakery_bp.route('/delivery-routes/<int:route_id>/status', methods=['PUT'])
@jwt_required()
def set_route_status(route_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    status = (request.get_json() or {}).get('status')
    route = update_route_status(route_id, user.tenant_id, status)
    if not route:
        return jsonify({"data": None, "meta": None, "errors": ["Route not found"]}), 404
    return jsonify({"data": route.to_dict(), "meta": None, "errors": None}), 200

    return jsonify({"data": route.to_dict(), "meta": None, "errors": None}), 200


# --- HACCP control points (food-safety QC) ---
@bakery_bp.route('/haccp', methods=['GET'])
@jwt_required()
def get_haccp():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    checks = list_haccp_checks(user.tenant_id,
                               work_order_id=request.args.get('work_order_id'),
                               bake_plan_item_id=request.args.get('bake_plan_item_id'))
    return jsonify({"data": [c.to_dict() for c in checks], "errors": None}), 200


@bakery_bp.route('/haccp', methods=['POST'])
@jwt_required()
def create_haccp():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    try:
        check = add_haccp_check(user.tenant_id, user.company_id,
                                request.get_json() or {}, user_id=user.id)
    except ValueError as e:
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 400
    return jsonify({"data": check.to_dict(), "meta": None, "errors": None}), 201


# --- Bake-day cost & variance report ---
@bakery_bp.route('/day-cost', methods=['GET'])
@jwt_required()
def day_cost():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
    d = request.args.get('date') or datetime.date.today().isoformat()
    report = compute_day_cost(user.tenant_id, user.company_id, d)
    return jsonify({"data": report, "meta": None, "errors": None}), 200

