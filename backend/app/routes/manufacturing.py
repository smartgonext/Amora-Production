from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.manufacturing import (
    TenantManufacturingConfig, BomHeader, BomItem, BomByproduct,
    WorkCenter, Machine, BomRoutingOperation, SupplierItemMapping,
    MaterialRequirementPlan, WorkOrder, WorkOrderOperation,
    ProductionMaterialIssue, QualityInspection, JobWorkOrder,
)
from app.services.manufacturing_service import (
    compute_bom_costs, create_bom, revise_bom, get_active_bom_for_product,
    run_mrp, generate_purchase_orders, create_work_order, release_work_order,
    complete_operation, production_receipt, complete_work_order,
    compute_operation_cost, create_quality_inspection, create_job_work_order,
list_uom_conversions, create_uom_conversion, delete_uom_conversion,
    record_material_consumption, record_material_return, compute_work_order_analysis,
    record_batch_lineage, list_batch_lineage,
    receive_job_work, post_stock_ledger,
)


manufacturing_bp = Blueprint('manufacturing', __name__)


def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))


def error(msg, code=400):
    return jsonify({"data": None, "meta": None, "errors": [msg]}), code


# ---------------------------------------------------------------------------
# Manufacturing Config (tenant feature configuration)
# ---------------------------------------------------------------------------

@manufacturing_bp.route('/config', methods=['GET'])
@jwt_required()
def get_manufacturing_config():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    cfg = TenantManufacturingConfig.query.filter_by(
        tenant_id=user.tenant_id, is_deleted=False).first()
    if not cfg:
        return error("No manufacturing config for this tenant", 404)
    return jsonify({"data": cfg.to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/config', methods=['POST', 'PUT'])
@jwt_required()
def upsert_manufacturing_config():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    data = request.get_json() or {}
    cfg = TenantManufacturingConfig.query.filter_by(
        tenant_id=user.tenant_id, is_deleted=False).first()
    if not cfg:
        cfg = TenantManufacturingConfig(tenant_id=user.tenant_id,
                                        mfg_type=data.get('mfg_type', 'discrete'),
                                        enabled_features=data.get('enabled_features', []))
        db.session.add(cfg)
    for field in ['mfg_type', 'enabled_features', 'bom_label', 'tracking_label', 'operation_label', 'is_active']:
        if field in data:
            setattr(cfg, field, data[field])
    db.session.commit()
    return jsonify({"data": cfg.to_dict(), "meta": None, "errors": None}), 200


# ---------------------------------------------------------------------------
# Step 2.1: BOM & Versioning Service
# ---------------------------------------------------------------------------

@manufacturing_bp.route('/boms', methods=['GET'])
@jwt_required()
def list_boms():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    query = BomHeader.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    product_id = request.args.get('product_id')
    status = request.args.get('status')
    if product_id:
        query = query.filter_by(product_id=int(product_id))
    if status:
        query = query.filter_by(status=status)
    boms = query.order_by(BomHeader.id.desc()).all()
    return jsonify({"data": [b.to_dict() for b in boms], "meta": {"count": len(boms)}, "errors": None}), 200


@manufacturing_bp.route('/boms', methods=['POST'])
@jwt_required()
def create_bom_endpoint():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    try:
        bom = create_bom(user.tenant_id, user.company_id, request.get_json() or {})
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": bom.to_dict(), "meta": None, "errors": None}), 201


@manufacturing_bp.route('/boms/<int:bom_id>', methods=['GET'])
@jwt_required()
def get_bom(bom_id):
    user = get_current_user()
    bom = BomHeader.query.filter_by(id=bom_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not bom:
        return error("BOM not found", 404)
    data = bom.to_dict()
    data['cost_breakup'] = compute_bom_costs(bom)
    return jsonify({"data": data, "meta": None, "errors": None}), 200


@manufacturing_bp.route('/boms/<int:bom_id>', methods=['PUT'])
@jwt_required()
def update_bom(bom_id):
    user = get_current_user()
    bom = BomHeader.query.filter_by(id=bom_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not bom:
        return error("BOM not found", 404)
    data = request.get_json() or {}
    for field in ['name', 'version', 'status', 'standard_cost', 'overhead_cost',
                  'total_setup_time_mins', 'effective_start_date', 'effective_end_date', 'notes',
                  'hydration_pct', 'dough_yield_pct', 'bake_loss_pct']:
        if field in data:
            setattr(bom, field, data[field])
    db.session.commit()
    return jsonify({"data": db.session.get(BomHeader, bom.id).to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/boms/<int:bom_id>/revise', methods=['POST'])
@jwt_required()
def revise_bom_endpoint(bom_id):
    user = get_current_user()
    bom = BomHeader.query.filter_by(id=bom_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not bom:
        return error("BOM not found", 404)
    try:
        new_bom = revise_bom(user.tenant_id, bom, request.get_json() or {})
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": new_bom.to_dict(), "meta": None, "errors": None}), 201


@manufacturing_bp.route('/boms/<int:bom_id>/activate', methods=['POST'])
@jwt_required()
def activate_bom(bom_id):
    user = get_current_user()
    bom = BomHeader.query.filter_by(id=bom_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not bom:
        return error("BOM not found", 404)
    # Only one active BOM per product: deprecate others
    others = BomHeader.query.filter_by(tenant_id=user.tenant_id, product_id=bom.product_id,
                                       status='active', is_deleted=False).all()
    for o in others:
        if o.id != bom.id:
            o.status = 'deprecated'
            db.session.add(o)
    bom.status = 'active'
    db.session.commit()
    return jsonify({"data": db.session.get(BomHeader, bom.id).to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/boms/product/<int:product_id>/active', methods=['GET'])
@jwt_required()
def get_active_bom(product_id):
    user = get_current_user()
    bom = get_active_bom_for_product(user.tenant_id, product_id)
    if not bom:
        return error("No active BOM for this product", 404)
    return jsonify({"data": bom.to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/boms/<int:bom_id>', methods=['DELETE'])
@jwt_required()
def delete_bom(bom_id):
    user = get_current_user()
    bom = BomHeader.query.filter_by(id=bom_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not bom:
        return error("BOM not found", 404)
    bom.soft_delete()
    return jsonify({"data": {"message": "BOM deleted"}, "meta": None, "errors": None}), 200


# ---------------------------------------------------------------------------
# Work Centers / Machines master data
# ---------------------------------------------------------------------------

@manufacturing_bp.route('/work-centers', methods=['GET'])
@jwt_required()
def list_work_centers():
    user = get_current_user()
    wcs = WorkCenter.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({"data": [w.to_dict() for w in wcs], "meta": {"count": len(wcs)}, "errors": None}), 200


@manufacturing_bp.route('/work-centers', methods=['POST'])
@jwt_required()
def create_work_center():
    user = get_current_user()
    data = request.get_json() or {}
    if not data.get('name'):
        return error("name is required")
    wc = WorkCenter(tenant_id=user.tenant_id, name=data['name'],
                    hourly_labor_rate=data.get('hourly_labor_rate', 0),
                    hourly_machine_rate=data.get('hourly_machine_rate', 0),
                    capacity_limit=data.get('capacity_limit', 0),
                    description=data.get('description'), is_active=True)
    db.session.add(wc); db.session.commit()
    return jsonify({"data": wc.to_dict(), "meta": None, "errors": None}), 201


@manufacturing_bp.route('/machines', methods=['GET'])
@jwt_required()
def list_machines():
    user = get_current_user()
    ms = Machine.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({"data": [m.to_dict() for m in ms], "meta": {"count": len(ms)}, "errors": None}), 200


@manufacturing_bp.route('/machines', methods=['POST'])
@jwt_required()
def create_machine():
    user = get_current_user()
    data = request.get_json() or {}
    if not data.get('name'):
        return error("name is required")
    m = Machine(tenant_id=user.tenant_id, work_center_id=data.get('work_center_id'),
                name=data['name'], hourly_machine_rate=data.get('hourly_machine_rate', 0),
                capacity_limit=data.get('capacity_limit', 0), is_active=True)
    db.session.add(m); db.session.commit()
    return jsonify({"data": m.to_dict(), "meta": None, "errors": None}), 201


# ---------------------------------------------------------------------------
# Step 2.2: Supplier-Item Mappings (MRP supplier data)
# ---------------------------------------------------------------------------

@manufacturing_bp.route('/supplier-item-mappings', methods=['GET'])
@jwt_required()
def list_supplier_mappings():
    user = get_current_user()
    ms = SupplierItemMapping.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({"data": [m.to_dict() for m in ms], "meta": {"count": len(ms)}, "errors": None}), 200


@manufacturing_bp.route('/supplier-item-mappings', methods=['POST'])
@jwt_required()
def create_supplier_mapping():
    user = get_current_user()
    data = request.get_json() or {}
    if not data.get('supplier_id') or not data.get('item_id'):
        return error("supplier_id and item_id are required")
    m = SupplierItemMapping(tenant_id=user.tenant_id, supplier_id=int(data['supplier_id']),
                            item_id=int(data['item_id']),
                            supplier_part_number=data.get('supplier_part_number'),
                            unit_price=data.get('unit_price', 0),
                            lead_time_days=data.get('lead_time_days', 0),
                            min_order_qty=data.get('min_order_qty', 0),
                            is_preferred_supplier=bool(data.get('is_preferred_supplier', False)),
                            is_active=True)
    db.session.add(m); db.session.commit()
    return jsonify({"data": m.to_dict(), "meta": None, "errors": None}), 201


@manufacturing_bp.route('/supplier-item-mappings/<int:mapping_id>', methods=['DELETE'])
@jwt_required()
def delete_supplier_mapping(mapping_id):
    user = get_current_user()
    m = SupplierItemMapping.query.filter_by(id=mapping_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not m:
        return error("Mapping not found", 404)
    m.soft_delete()
    return jsonify({"data": {"message": "Mapping deleted"}, "meta": None, "errors": None}), 200


# ---------------------------------------------------------------------------
# Step 2.2: MRP & Raw Material Purchase Engine
# ---------------------------------------------------------------------------

@manufacturing_bp.route('/mrp/run', methods=['POST'])
@jwt_required()
def mrp_run():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    data = request.get_json() or {}
    work_order = None
    if data.get('work_order_id'):
        work_order = WorkOrder.query.filter_by(id=int(data['work_order_id']),
                                               tenant_id=user.tenant_id, is_deleted=False).first()
        if not work_order:
            return error("Work order not found", 404)
    summary = run_mrp(user.tenant_id, work_order=work_order)
    return jsonify({"data": summary, "meta": {"count": len(summary)}, "errors": None}), 200


@manufacturing_bp.route('/mrp', methods=['GET'])
@jwt_required()
def list_mrp():
    user = get_current_user()
    query = MaterialRequirementPlan.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    status = request.args.get('status')
    if status:
        query = query.filter_by(status=status)
    plans = query.order_by(MaterialRequirementPlan.id.desc()).all()
    return jsonify({"data": [p.to_dict() for p in plans], "meta": {"count": len(plans)}, "errors": None}), 200


@manufacturing_bp.route('/mrp/shortages', methods=['GET'])
@jwt_required()
def list_shortages():
    user = get_current_user()
    plans = MaterialRequirementPlan.query.filter(
        MaterialRequirementPlan.tenant_id == user.tenant_id,
        MaterialRequirementPlan.is_deleted == False,
        MaterialRequirementPlan.shortage_qty > 0,
    ).order_by(MaterialRequirementPlan.shortage_qty.desc()).all()
    return jsonify({"data": [p.to_dict() for p in plans], "meta": {"count": len(plans)}, "errors": None}), 200


@manufacturing_bp.route('/mrp/generate-po', methods=['POST'])
@jwt_required()
def mrp_generate_po():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    data = request.get_json() or {}
    mrp_ids = data.get('mrp_ids') or None
    try:
        pos = generate_purchase_orders(user.tenant_id, user.company_id, mrp_ids=mrp_ids)
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": [po.to_dict() for po in pos], "meta": {"count": len(pos)}, "errors": None}), 200


# ---------------------------------------------------------------------------
# Step 2.3: Work Order Lifecycle Engine
# ---------------------------------------------------------------------------

@manufacturing_bp.route('/work-orders', methods=['GET'])
@jwt_required()
def list_work_orders():
    user = get_current_user()
    query = WorkOrder.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    status = request.args.get('status')
    if status:
        query = query.filter_by(status=status)
    wos = query.order_by(WorkOrder.id.desc()).all()
    return jsonify({"data": [w.to_dict() for w in wos], "meta": {"count": len(wos)}, "errors": None}), 200


@manufacturing_bp.route('/work-orders', methods=['POST'])
@jwt_required()
def create_work_order_endpoint():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    try:
        wo = create_work_order(user.tenant_id, user.company_id, request.get_json() or {})
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": wo.to_dict(), "meta": None, "errors": None}), 201


@manufacturing_bp.route('/work-orders/<int:work_order_id>', methods=['GET'])
@jwt_required()
def get_work_order(work_order_id):
    user = get_current_user()
    wo = WorkOrder.query.filter_by(id=work_order_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not wo:
        return error("Work order not found", 404)
    return jsonify({"data": wo.to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/work-orders/<int:work_order_id>/release', methods=['POST'])
@jwt_required()
def release_work_order_endpoint(work_order_id):
    user = get_current_user()
    wo = WorkOrder.query.filter_by(id=work_order_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not wo:
        return error("Work order not found", 404)
    data = request.get_json() or {}
    try:
        wo = release_work_order(wo, warehouse_id=data.get('warehouse_id'),
                                company_id=data.get('company_id', user.company_id))
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": wo.to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/work-orders/<int:work_order_id>/start-operation', methods=['POST'])
@jwt_required()
def start_operation(work_order_id):
    user = get_current_user()
    wo = WorkOrder.query.filter_by(id=work_order_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not wo:
        return error("Work order not found", 404)
    data = request.get_json() or {}
    op = WorkOrderOperation.query.filter_by(
        work_order_id=wo.id, id=int(data.get('operation_id', 0)), is_deleted=False).first()
    if not op:
        return error("Operation not found")
    op.status = 'in_progress'
    op.started_at = data.get('started_at')
    db.session.add(op); db.session.commit()
    return jsonify({"data": db.session.get(WorkOrderOperation, op.id).to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/work-orders/<int:work_order_id>/complete-operation', methods=['POST'])
@jwt_required()
def complete_operation_endpoint(work_order_id):
    user = get_current_user()
    wo = WorkOrder.query.filter_by(id=work_order_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not wo:
        return error("Work order not found", 404)
    data = request.get_json() or {}
    op = WorkOrderOperation.query.filter_by(
        work_order_id=wo.id, id=int(data.get('operation_id', 0)), is_deleted=False).first()
    if not op:
        return error("Operation not found")
    try:
        op, cost = complete_operation(op, data)
    except ValueError as e:
        return error(str(e))
    resp = op.to_dict()
    resp['cost_breakup'] = cost
    return jsonify({"data": resp, "meta": None, "errors": None}), 200


@manufacturing_bp.route('/work-orders/<int:work_order_id>/receipt', methods=['POST'])
@jwt_required()
def production_receipt_endpoint(work_order_id):
    user = get_current_user()
    wo = WorkOrder.query.filter_by(id=work_order_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not wo:
        return error("Work order not found", 404)
    data = request.get_json() or {}
    try:
        wo2, batch, serials = production_receipt(
            wo, warehouse_id=data.get('warehouse_id'),
            company_id=data.get('company_id', user.company_id),
            batch_no=data.get('batch_no'), produced_qty=data.get('produced_qty'),
            serial_numbers=data.get('serial_numbers'))
    except ValueError as e:
        return error(str(e))
    resp = wo2.to_dict()
    resp['generated_batch'] = batch.to_dict() if batch else None
    resp['serial_count'] = serials
    return jsonify({"data": resp, "meta": None, "errors": None}), 200


@manufacturing_bp.route('/work-orders/<int:work_order_id>/complete', methods=['POST'])
@jwt_required()
def complete_work_order_endpoint(work_order_id):
    user = get_current_user()
    wo = WorkOrder.query.filter_by(id=work_order_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not wo:
        return error("Work order not found", 404)
    try:
        wo = complete_work_order(wo, request.get_json() or {})
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": wo.to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/work-orders/<int:work_order_id>/material-issue', methods=['POST'])
@jwt_required()
def manual_material_issue(work_order_id):
    user = get_current_user()
    wo = WorkOrder.query.filter_by(id=work_order_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not wo:
        return error("Work order not found", 404)
    data = request.get_json() or {}
    item_id = data.get('item_id')
    qty = int(data.get('qty_issued', 0))
    if not item_id or qty <= 0:
        return error("item_id and qty_issued (>0) are required")
    post_stock_ledger(user.tenant_id, wo.company_id or user.company_id,
                      data.get('warehouse_id'), int(item_id), -qty,
                      'Production Issue', 'work_order', wo.id,
                      f"Manual issue for WO {wo.wo_number}")
    mb = ProductionMaterialIssue(tenant_id=user.tenant_id, work_order_id=wo.id,
                                 item_id=int(item_id), warehouse_id=data.get('warehouse_id'),
                                 qty_issued=qty, qty_returned=0,
                                 batch_no=data.get('batch_no'), serial_no=data.get('serial_no'))
    db.session.add(mb); db.session.commit()
    return jsonify({"data": db.session.get(ProductionMaterialIssue, mb.id).to_dict(), "meta": None, "errors": None}), 201


@manufacturing_bp.route('/work-orders/<int:work_order_id>', methods=['DELETE'])
@jwt_required()
def delete_work_order(work_order_id):
    user = get_current_user()
    wo = WorkOrder.query.filter_by(id=work_order_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not wo:
        return error("Work order not found", 404)
    wo.soft_delete()
    return jsonify({"data": {"message": "Work order deleted"}, "meta": None, "errors": None}), 200


# ---------------------------------------------------------------------------
# Step 2.4: QC & Subcontracting Services
# ---------------------------------------------------------------------------

@manufacturing_bp.route('/qc/inspections', methods=['GET'])
@jwt_required()
def list_qc_inspections():
    user = get_current_user()
    queries = QualityInspection.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    ref_type = request.args.get('reference_type')
    if ref_type:
        queries = queries.filter_by(reference_type=ref_type)
    items = queries.order_by(QualityInspection.id.desc()).all()
    return jsonify({"data": [i.to_dict() for i in items], "meta": {"count": len(items)}, "errors": None}), 200


@manufacturing_bp.route('/qc/inspections', methods=['POST'])
@jwt_required()
def create_qc_inspection():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    try:
        qc = create_quality_inspection(user.tenant_id, user.id, request.get_json() or {})
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": qc.to_dict(), "meta": None, "errors": None}), 201


@manufacturing_bp.route('/qc/inspections/<int:inspection_id>', methods=['GET'])
@jwt_required()
def get_qc_inspection(inspection_id):
    user = get_current_user()
    qc = QualityInspection.query.filter_by(id=inspection_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not qc:
        return error("Inspection not found", 404)
    return jsonify({"data": qc.to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/qc/inspections/<int:inspection_id>', methods=['PUT'])
@jwt_required()
def update_qc_inspection(inspection_id):
    user = get_current_user()
    qc = QualityInspection.query.filter_by(id=inspection_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not qc:
        return error("Inspection not found", 404)
    data = request.get_json() or {}
    for field in ['passed_qty', 'failed_qty', 'qc_status', 'check_parameters', 'remarks', 'inspection_date']:
        if field in data:
            setattr(qc, field, data[field])
    db.session.commit()
    return jsonify({"data": db.session.get(QualityInspection, qc.id).to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/job-orders', methods=['GET'])
@jwt_required()
def list_job_orders():
    user = get_current_user()
    jws = JobWorkOrder.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)\
        .order_by(JobWorkOrder.id.desc()).all()
    return jsonify({"data": [j.to_dict() for j in jws], "meta": {"count": len(jws)}, "errors": None}), 200


@manufacturing_bp.route('/job-orders', methods=['POST'])
@jwt_required()
def create_job_order():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    try:
        jw = create_job_work_order(user.tenant_id, request.get_json() or {})
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": jw.to_dict(), "meta": None, "errors": None}), 201


@manufacturing_bp.route('/job-orders/<int:job_order_id>', methods=['GET'])
@jwt_required()
def get_job_order(job_order_id):
    user = get_current_user()
    jw = JobWorkOrder.query.filter_by(id=job_order_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not jw:
        return error("Job work order not found", 404)
    return jsonify({"data": jw.to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/job-orders/<int:job_order_id>/receive', methods=['POST'])
@jwt_required()
def receive_job_order(job_order_id):
    user = get_current_user()
    jw = JobWorkOrder.query.filter_by(id=job_order_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not jw:
        return error("Job work order not found", 404)
    try:
        jw = receive_job_work(jw, request.get_json() or {})
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": jw.to_dict(), "meta": None, "errors": None}), 200
# ---------------------------------------------------------------------------
# Phase 1 Upgrade: Multi-UOM Conversion Engine endpoints
# ---------------------------------------------------------------------------

@manufacturing_bp.route('/uoms', methods=['GET'])
@jwt_required()
def list_uom_conversions_endpoint():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    item_id = request.args.get('item_id')
    convs = list_uom_conversions(user.tenant_id, item_id=item_id)
    return jsonify({"data": [c.to_dict() for c in convs], "meta": {"count": len(convs)}, "errors": None}), 200


@manufacturing_bp.route('/uoms', methods=['POST'])
@jwt_required()
def create_uom_conversion_endpoint():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    try:
        conv = create_uom_conversion(user.tenant_id, request.get_json() or {})
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": conv.to_dict(), "meta": None, "errors": None}), 201


@manufacturing_bp.route('/uoms/<int:conversion_id>', methods=['DELETE'])
@jwt_required()
def delete_uom_conversion_endpoint(conversion_id):
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    try:
        conv = delete_uom_conversion(user.tenant_id, conversion_id)
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": conv.to_dict(), "meta": None, "errors": None}), 200


# ---------------------------------------------------------------------------
# Phase 2 Upgrade: Actual Material Consumption, Returns & WIP Variance
# ---------------------------------------------------------------------------

def _get_issue_or_error(tenant_id, issue_id, work_order_id):
    issue = ProductionMaterialIssue.query.filter_by(
        id=int(issue_id), tenant_id=tenant_id,
        work_order_id=int(work_order_id), is_deleted=False,
    ).first()
    return issue


@manufacturing_bp.route('/work-orders/<int:work_order_id>/consumption', methods=['POST'])
@jwt_required()
def record_consumption_endpoint(work_order_id):
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    data = request.get_json() or {}
    lines = data.get('lines') or data.get('issues') or []
    if not lines:
        return error("Provide 'lines' with issue_id and qty_consumed", 400)
    updated = []
    for ln in lines:
        issue = _get_issue_or_error(user.tenant_id, ln.get('issue_id'), work_order_id)
        if issue is None:
            continue
        issue = record_material_consumption(issue, ln.get('qty_consumed'))
        updated.append(issue.to_dict())
    return jsonify({"data": updated, "meta": {"updated": len(updated)}, "errors": None}), 200


@manufacturing_bp.route('/work-orders/<int:work_order_id>/material-return', methods=['POST'])
@jwt_required()
def record_material_return_endpoint(work_order_id):
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    data = request.get_json() or {}
    issue = _get_issue_or_error(user.tenant_id, data.get('issue_id'), work_order_id)
    if issue is None:
        return error("Material issue not found", 404)
    try:
        issue = record_material_return(issue, data.get('qty_returned'))
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": issue.to_dict(), "meta": None, "errors": None}), 200


@manufacturing_bp.route('/work-orders/<int:work_order_id>/analysis', methods=['GET'])
@jwt_required()
def work_order_analysis_endpoint(work_order_id):
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    wo = WorkOrder.query.filter_by(id=work_order_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not wo:
        return error("Work order not found", 404)
    analysis = compute_work_order_analysis(wo)
    return jsonify({"data": analysis, "meta": None, "errors": None}), 200


# ---------------------------------------------------------------------------
# Phase 1 Upgrade: Batch Traceability & Lineage endpoints
# ---------------------------------------------------------------------------

@manufacturing_bp.route('/batch-lineage', methods=['GET'])
@jwt_required()
def list_batch_lineage_endpoint():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    finished_batch_no = request.args.get('finished_batch_no')
    records = list_batch_lineage(user.tenant_id, finished_batch_no=finished_batch_no)
    return jsonify({"data": [r.to_dict() for r in records], "meta": {"count": len(records)}, "errors": None}), 200


@manufacturing_bp.route('/batch-lineage', methods=['POST'])
@jwt_required()
def record_batch_lineage_endpoint():
    user = get_current_user()
    if not user:
        return error("User not found", 404)
    try:
        records = record_batch_lineage(user.tenant_id, request.get_json() or {})
    except ValueError as e:
        return error(str(e))
    return jsonify({"data": [r.to_dict() for r in records], "meta": {"count": len(records)}, "errors": None}), 201
