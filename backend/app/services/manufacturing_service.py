"""Manufacturing Engine business-logic services.

Implements Phase 2 of the Universal Manufacturing Plan:
  * Step 2.1 BOM & Versioning Service (multi-level, routing, alternates)
  * Step 2.2 Raw Material / MRP & Supplier Purchase Engine
  * Step 2.3 Work Order Lifecycle Engine
  * Step 2.4 QC & Subcontracting services (helpers used by routes)
"""
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_CEILING
import uuid

from app.extensions import db
from app.models.manufacturing import (
    TenantManufacturingConfig, BomHeader, BomItem, BomByproduct,
    WorkCenter, Machine, BomRoutingOperation, SupplierItemMapping,
    MaterialRequirementPlan, WorkOrder, WorkOrderOperation,
    ProductionMaterialIssue, QualityInspection, JobWorkOrder,
MaterialUomConversion, BatchLineage,
)
from app.models.product import Product, StockLedger, ProductBatch, Warehouse
from app.models.product import PurchaseOrder, PurchaseItem
from app.models.customer import Supplier


def as_decimal(value, default="0"):
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(str(default))


def generate_number(prefix, model, number_field, padding=4):
    records = model.query.all()
    max_num = 0
    for rec in records:
        val = getattr(rec, number_field, None) or ''
        try:
            n = int(str(val).rsplit('-', 1)[-1])
        except Exception:
            n = 0
        max_num = max(max_num, n)
    return f"{prefix}-{max_num + 1:0{padding}d}"


def post_stock_ledger(tenant_id, company_id, warehouse_id, product_id, delta,
                      type_, reference_type, reference_id, notes, rate=0):
    product = Product.query.filter_by(id=product_id, tenant_id=tenant_id).first()
    if not product:
        return None
    product.current_stock = (product.current_stock or 0) + int(delta)
    db.session.add(product)
    ledger = StockLedger(
        tenant_id=tenant_id,
        company_id=company_id,
        warehouse_id=warehouse_id,
        product_id=product_id,
        quantity_delta=int(delta),
        running_balance=product.current_stock,
        type=type_,
        reference_type=reference_type,
        reference_id=reference_id,
        rate=as_decimal(rate),
        notes=notes,
        transaction_date=datetime.utcnow(),
    )
    db.session.add(ledger)
    return ledger


def raw_material_rate(tenant_id, product_id):
    """Resolve the CURRENT applicable purchase rate for a raw material.

    Historical rates are never overwritten; this returns the most recent
    received batch's cost of record so product costing follows the actual
    transaction rate rather than a single over-written Product.purchase_price.
    """
    batch = (ProductBatch.query
             .filter_by(tenant_id=tenant_id, product_id=int(product_id), is_deleted=False)
             .order_by(ProductBatch.id.desc()).first())
    if batch is not None and batch.purchase_price:
        return as_decimal(batch.purchase_price)
    ledger = (StockLedger.query
              .filter_by(tenant_id=tenant_id, product_id=int(product_id),
                         type='Purchase', is_deleted=False)
              .order_by(StockLedger.id.desc()).first())
    if ledger is not None and ledger.rate:
        return as_decimal(ledger.rate)
    prod = db.session.get(Product, int(product_id))
    return as_decimal(prod.purchase_price) if prod and prod.purchase_price is not None else as_decimal(0)


def expand_bom_items(bom, quantity, as_list=True):
    required = {}

    def _walk(items, multiplier):
        for item in items:
            if item.is_alternate:
                continue
            factor = as_decimal(item.qty_required) * (as_decimal(1) + as_decimal(item.waste_pct) / 100)
            qty = multiplier * factor
            prod = db.session.get(Product, item.item_id)
            child_bom = None
            if prod is not None:
                child_bom = BomHeader.query.filter_by(product_id=item.item_id, status='active',
                                                      tenant_id=prod.tenant_id, is_deleted=False).first()
            if child_bom is not None:
                _walk(child_bom.items, qty)
            else:
                required[item.item_id] = required.get(item.item_id, as_decimal(0)) + qty

    _walk(bom.items, as_decimal(quantity))

    if as_list:
        return [{"item_id": k, "qty": v} for k, v in required.items()]
    return required

def compute_bom_costs(bom, quantity=None):
    material_total = as_decimal(0)
    for item in bom.items:
        if item.is_alternate:
            continue
        # Use the current applicable raw-material purchase rate (batch / last
        # purchase cost of record) rather than a single over-written price.
        rate = raw_material_rate(bom.tenant_id, item.item_id)
        material_total += as_decimal(item.qty_required) * rate

    labor_cost = as_decimal(0)
    machine_cost = as_decimal(0)
    for op in bom.routing_operations:
        wc = db.session.get(WorkCenter, op.work_center_id) if op.work_center_id else None
        machine = db.session.get(Machine, op.machine_id) if op.machine_id else None
        labor_rate = as_decimal(getattr(wc, 'hourly_labor_rate', None) or 0) if wc else as_decimal(0)
        machine_rate = as_decimal(getattr(wc, 'hourly_machine_rate', None) or 0) if wc else as_decimal(0)
        if machine is not None:
            machine_rate = as_decimal(getattr(machine, 'hourly_machine_rate', None) or 0)
        labor_cost += as_decimal(op.labor_hours_per_unit) * labor_rate
        machine_cost += (as_decimal(op.setup_time_mins) / 60 +
                         as_decimal(op.processing_time_per_unit_mins)) * machine_rate

    overhead_cost = as_decimal(bom.overhead_cost or 0)
    total = material_total + labor_cost + machine_cost + overhead_cost
    return {
        "material_cost": float(material_total),
        "labor_cost": float(labor_cost),
        "machine_cost": float(machine_cost),
        "overhead_cost": float(overhead_cost),
        "total_cost": float(total),
    }


def create_bom(tenant_id, company_id, data):
    name = (data.get('name') or '').strip()
    product_id = data.get('product_id')
    if not name or not product_id:
        raise ValueError("name and product_id are required")

    version = data.get('version') or "V1.0"
    existing = BomHeader.query.filter_by(tenant_id=tenant_id, product_id=int(product_id),
                                          version=version, is_deleted=False).first()
    if existing:
        raise ValueError(f"Version {version} already exists for this product")

    bom = BomHeader(
        tenant_id=tenant_id,
        company_id=company_id,
        product_id=int(product_id),
        version=version,
        revision_no=int(data.get('revision_no') or 0),
        name=name,
        status=data.get('status', 'draft'),
        effective_start_date=data.get('effective_start_date'),
        effective_end_date=data.get('effective_end_date'),
        standard_cost=as_decimal(data.get('standard_cost', 0)),
        overhead_cost=as_decimal(data.get('overhead_cost', 0)),
        total_setup_time_mins=int(data.get('total_setup_time_mins') or 0),
        hydration_pct=as_decimal(data.get('hydration_pct', 0)),
        dough_yield_pct=as_decimal(data.get('dough_yield_pct', 0)),
        bake_loss_pct=as_decimal(data.get('bake_loss_pct', 0)),
        notes=data.get('notes'),
    )
    db.session.add(bom)
    db.session.flush()

    for op in data.get('routing_operations', []) or []:
        db.session.add(BomRoutingOperation(
            bom_id=bom.id,
            operation_sequence=int(op.get('operation_sequence') or 10),
            operation_name=op.get('operation_name'),
            work_center_id=int(op.get('work_center_id')) if op.get('work_center_id') else None,
            machine_id=int(op.get('machine_id')) if op.get('machine_id') else None,
            setup_time_mins=int(op.get('setup_time_mins') or 0),
            processing_time_per_unit_mins=as_decimal(op.get('processing_time_per_unit_mins', 0)),
            labor_hours_per_unit=as_decimal(op.get('labor_hours_per_unit', 0)),
        ))

    for item in data.get('items', []) or []:
        db.session.add(BomItem(
            bom_id=bom.id,
            item_id=int(item.get('item_id', item.get('material_item_id'))),
            qty_required=as_decimal(item.get('qty_required', 1)),
            uom=item.get('uom'),
            waste_pct=as_decimal(item.get('waste_pct', 0)),
            baker_pct=as_decimal(item.get('baker_pct')) if item.get('baker_pct') is not None else None,
            is_alternate=bool(item.get('is_alternate', False)),
            parent_bom_item_id=int(item.get('parent_bom_item_id')) if item.get('parent_bom_item_id') else None,
        ))

    for bp in data.get('byproducts', []) or []:
        db.session.add(BomByproduct(
            bom_id=bom.id,
            item_id=int(bp.get('item_id')),
            type=bp.get('type', 'by_product'),
            qty_expected=as_decimal(bp.get('qty_expected', 0)),
            uom=bp.get('uom'),
        ))

    db.session.commit()
    return db.session.get(BomHeader, bom.id)

def revise_bom(tenant_id, bom, data=None):
    data = data or {}
    product_id = bom.product_id
    next_revision = (bom.revision_no or 0) + 1
    try:
        ver = Decimal(str(bom.version)[1:])
    except Exception:
        ver = Decimal('1.0')
    next_version = f"V{ver + Decimal('0.1')}"

    active = BomHeader.query.filter_by(tenant_id=tenant_id, product_id=product_id,
                                       status='active', is_deleted=False).all()
    for a in active:
        a.status = 'deprecated'
        db.session.add(a)

    payload = {
        'name': bom.name,
        'version': next_version,
        'revision_no': next_revision,
        'product_id': product_id,
        'status': 'draft',
        'standard_cost': str(bom.standard_cost or 0),
        'overhead_cost': str(bom.overhead_cost or 0),
        'total_setup_time_mins': bom.total_setup_time_mins,
        'notes': data.get('notes', bom.notes),
        'routing_operations': [
            {
                'operation_sequence': op.operation_sequence,
                'operation_name': op.operation_name,
                'work_center_id': op.work_center_id,
                'machine_id': op.machine_id,
                'setup_time_mins': op.setup_time_mins,
                'processing_time_per_unit_mins': str(op.processing_time_per_unit_mins),
                'labor_hours_per_unit': str(op.labor_hours_per_unit),
            } for op in bom.routing_operations
        ],
        'items': [
            {
                'item_id': i.item_id,
                'qty_required': str(i.qty_required),
                'uom': i.uom,
                'waste_pct': str(i.waste_pct),
                'is_alternate': i.is_alternate,
                'parent_bom_item_id': i.parent_bom_item_id,
            } for i in bom.items
        ],
        'byproducts': [
            {'item_id': bp.item_id, 'type': bp.type,
             'qty_expected': str(bp.qty_expected), 'uom': bp.uom}
            for bp in bom.byproducts
        ],
    }
    return create_bom(tenant_id, getattr(bom, 'company_id', None), payload)


def get_active_bom_for_product(tenant_id, product_id):
    return BomHeader.query.filter_by(tenant_id=tenant_id, product_id=int(product_id),
                                     status='active', is_deleted=False)\
        .order_by(BomHeader.revision_no.desc(), BomHeader.id.desc()).first()


# --- Step 2.2: MRP / Raw Material & Supplier Purchase Engine ---

def _recommend_supplier(tenant_id, item_id):
    mapping = SupplierItemMapping.query.filter_by(
        tenant_id=tenant_id, item_id=int(item_id), is_active=True, is_deleted=False,
    ).order_by(SupplierItemMapping.is_preferred_supplier.desc(),
               SupplierItemMapping.lead_time_days.asc()).first()
    return mapping


def run_mrp(tenant_id, work_order=None):
    query = MaterialRequirementPlan.query.filter_by(tenant_id=tenant_id, is_deleted=False)
    if work_order:
        query = query.filter_by(work_order_id=work_order.id)
    stale = query.filter(MaterialRequirementPlan.status == 'draft').all()
    for s in stale:
        s.soft_delete()

    if work_order:
        wos = [work_order]
    else:
        wos = WorkOrder.query.filter_by(tenant_id=tenant_id, is_deleted=False)\
            .filter(WorkOrder.status.in_(['planned', 'released', 'wip'])).all()

    summary = []
    for wo in wos:
        if not wo.bom_id:
            continue
        bom = db.session.get(BomHeader, wo.bom_id)
        if not bom:
            continue
        requirements = expand_bom_items(bom, wo.planned_qty, as_list=False)
        for item_id, qty in requirements.items():
            product = db.session.get(Product, item_id)
            current_stock = as_decimal(getattr(product, 'current_stock', None) or 0) if product else as_decimal(0)
            shortage = as_decimal(qty) - current_stock
            mapping = _recommend_supplier(tenant_id, item_id)
            suggested_po = as_decimal(0)
            supplier_id = None
            if shortage > 0 and mapping is not None:
                supplier_id = mapping.supplier_id
                moq = as_decimal(mapping.min_order_qty or 0)
                if moq > 0:
                    suggested_po = (shortage / moq).to_integral_value(rounding=ROUND_CEILING) * moq
                else:
                    suggested_po = shortage

            plan = MaterialRequirementPlan(
                tenant_id=tenant_id,
                work_order_id=wo.id,
                raw_material_id=int(item_id),
                required_qty=qty,
                current_stock_qty=current_stock,
                shortage_qty=max(shortage, as_decimal(0)),
                suggested_po_qty=suggested_po,
                supplier_id=supplier_id,
                status='draft',
            )
            db.session.add(plan)
            summary.append({
                'work_order_id': wo.id,
                'item_id': int(item_id),
                'required_qty': float(qty),
                'current_stock_qty': float(current_stock),
                'shortage_qty': float(max(shortage, as_decimal(0))),
                'suggested_po_qty': float(suggested_po),
                'supplier_id': supplier_id,
            })

    db.session.commit()
    return summary

def generate_purchase_orders(tenant_id, company_id, mrp_ids=None):
    query = MaterialRequirementPlan.query.filter_by(tenant_id=tenant_id, is_deleted=False, status='draft')
    if mrp_ids:
        query = query.filter(MaterialRequirementPlan.id.in_(mrp_ids))
    plans = query.all()

    by_supplier = {}
    for plan in plans:
        if plan.shortage_qty is None or plan.shortage_qty <= 0 or not plan.supplier_id:
            continue
        by_supplier.setdefault(plan.supplier_id, []).append(plan)

    created_pos = []
    for supplier_id, plist in by_supplier.items():
        po_number = generate_number('PO', PurchaseOrder, 'po_number')
        subtotal = sum(as_decimal(p.suggested_po_qty) *
                       as_decimal(_recommend_supplier(tenant_id, p.raw_material_id).unit_price or 0)
                       for p in plist)
        po = PurchaseOrder(
            tenant_id=tenant_id,
            company_id=company_id,
            supplier_id=supplier_id,
            po_number=po_number,
            order_date=datetime.utcnow(),
            subtotal=subtotal,
            total_amount=subtotal,
            status='Draft',
        )
        db.session.add(po)
        db.session.flush()

        for p in plist:
            mapping = _recommend_supplier(tenant_id, p.raw_material_id)
            rate = as_decimal(mapping.unit_price or 0) if mapping else as_decimal(0)
            db.session.add(PurchaseItem(
                tenant_id=tenant_id,
                purchase_order_id=po.id,
                product_id=p.raw_material_id,
                quantity=int(p.suggested_po_qty),
                rate=rate,
                total_amount=rate * p.suggested_po_qty,
            ))
            p.status = 'po_generated'
            db.session.add(p)

        created_pos.append(po.id)

    db.session.commit()
    return PurchaseOrder.query.filter(PurchaseOrder.id.in_(created_pos)).all() if created_pos else []


# --- Step 2.3: Work Order Lifecycle Engine ---

def create_work_order(tenant_id, company_id, data):
    bom_id = data.get('bom_id')
    planned_qty = data.get('planned_qty')
    if not bom_id or not planned_qty:
        raise ValueError("bom_id and planned_qty are required")

    bom = db.session.get(BomHeader, int(bom_id))
    if bom is None or bom.tenant_id != tenant_id or bom.is_deleted:
        raise ValueError("BOM not found")

    wo_number = data.get('wo_number') or generate_number('WO', WorkOrder, 'wo_number')
    wo = WorkOrder(
        tenant_id=tenant_id,
        company_id=company_id or data.get('company_id'),
        sales_order_id=data.get('sales_order_id'),
        bom_id=int(bom_id),
        wo_number=wo_number,
        planned_qty=planned_qty,
        produced_qty=data.get('produced_qty', 0),
        start_date=data.get('start_date'),
        due_date=data.get('due_date'),
        status=data.get('status', 'planned'),
        notes=data.get('notes'),
    )
    db.session.add(wo)
    db.session.commit()
    return db.session.get(WorkOrder, wo.id)


def release_work_order(work_order, warehouse_id=None, company_id=None):
    if work_order.status not in ('planned',):
        raise ValueError("Only 'planned' work orders can be released")

    bom = db.session.get(BomHeader, work_order.bom_id)
    tenant_id = work_order.tenant_id
    company_id = company_id or work_order.company_id

    if bom is not None:
        for op in bom.routing_operations:
            db.session.add(WorkOrderOperation(
                work_order_id=work_order.id,
                operation_sequence=op.operation_sequence,
                operation_name=op.operation_name,
                work_center_id=op.work_center_id,
                status='pending',
            ))

    if bom is not None:
        for item in bom.items:
            if item.is_alternate:
                continue
            qty = as_decimal(item.qty_required) * as_decimal(work_order.planned_qty) * \
                (as_decimal(1) + as_decimal(item.waste_pct) / 100)
            product = db.session.get(Product, item.item_id)
            if product is None:
                continue
            actual = min(int(qty), (product.current_stock or 0))
            issue_rate = raw_material_rate(tenant_id, product.id)
            # FEFO raw-batch allocation: consume earliest-expiring raw batches
            # first, cost at the consumed batch's purchase rate (the applicable
            # current transaction rate), and keep the primary batch number on the
            # issue line for full raw→finished traceability.
            primary_batch_no = None
            remaining = actual
            raw_batches = (ProductBatch.query
                           .filter_by(tenant_id=tenant_id, product_id=product.id)
                           .filter(ProductBatch.quantity > 0).all())
            raw_batches.sort(key=lambda b: (b.expiry_date is None, b.expiry_date or datetime.max, b.id))
            for rb in raw_batches:
                if remaining <= 0:
                    break
                take = min(int(rb.quantity or 0), remaining)
                if take <= 0:
                    continue
                if primary_batch_no is None:
                    primary_batch_no = rb.batch_no
                    if rb.purchase_price:
                        issue_rate = as_decimal(rb.purchase_price)
                rb.quantity = int(rb.quantity or 0) - take
                db.session.add(rb)
                remaining -= take

            post_stock_ledger(
                tenant_id, company_id, warehouse_id, product.id, -actual,
                'Production Issue', 'work_order', work_order.id,
                f"Issue for WO {work_order.wo_number}", rate=issue_rate,
            )
            db.session.add(ProductionMaterialIssue(
                tenant_id=tenant_id,
                work_order_id=work_order.id,
                item_id=product.id,
                warehouse_id=warehouse_id,
                batch_no=primary_batch_no,
                qty_planned=qty,
                qty_issued=actual,
                qty_returned=0,
                variance=as_decimal(0),
            ))

    work_order.status = 'wip'
    db.session.add(work_order)
    db.session.commit()
    return db.session.get(WorkOrder, work_order.id)

def compute_operation_cost(operation):
    setup_hours = as_decimal(operation.actual_setup_time or 0) / 60
    run_hours = as_decimal(operation.actual_run_time or 0) / 60
    total_hours = setup_hours + run_hours

    labor_cost = as_decimal(0)
    machine_cost = as_decimal(0)
    if operation.work_center_id:
        wc = db.session.get(WorkCenter, operation.work_center_id)
        if wc:
            labor_cost = total_hours * as_decimal(wc.hourly_labor_rate or 0)
            machine_cost = total_hours * as_decimal(wc.hourly_machine_rate or 0)
    return {
        'labor_cost': float(labor_cost),
        'machine_cost': float(machine_cost),
        'total_cost': float(labor_cost + machine_cost),
        'total_hours': float(total_hours),
    }


def complete_operation(operation, data):
    if operation.status == 'completed':
        raise ValueError("Operation already completed")
    operation.status = 'completed'
    operation.completed_at = data.get('completed_at') or datetime.utcnow()
    operation.actual_setup_time = data.get('actual_setup_time', operation.actual_setup_time or 0)
    operation.actual_run_time = data.get('actual_run_time', operation.actual_run_time or 0)
    operation.operator_user_id = data.get('operator_user_id', operation.operator_user_id)
    db.session.add(operation)
    db.session.commit()
    op = db.session.get(WorkOrderOperation, operation.id)
    cost = compute_operation_cost(op)
    return op, cost


def production_receipt(work_order, warehouse_id=None, company_id=None,
                       batch_no=None, produced_qty=None, serial_numbers=None):
    if work_order.status in ('completed', 'cancelled'):
        raise ValueError(f"Cannot receipt a '{work_order.status}' work order")

    product = db.session.get(Product, work_order.bom.product_id) if work_order.bom else None
    if product is None:
        raise ValueError("Finished product not found for the work order BOM")

    tenant_id = work_order.tenant_id
    company_id = company_id or work_order.company_id
    qty = int(produced_qty or work_order.planned_qty)
    generated_batch = None
    serials = serial_numbers or []
    unit_cost = as_decimal(getattr(work_order.bom, 'standard_cost', None) or 0)

    mfg_datetime = datetime.utcnow()
    # Ice-cream finished batches carry a best-before / shelf-life based expiry
    # so cold-storage / FEFO handling can always rely on an expiry date.
    expiry_datetime = None
    life_days = getattr(product, 'best_before_days', None) or getattr(product, 'shelf_life_days', None)
    if life_days:
        try:
            expiry_datetime = mfg_datetime + timedelta(days=int(life_days))
        except Exception:
            expiry_datetime = None

    if getattr(product, 'is_batch_tracked', False):
        generated_batch = ProductBatch(
            tenant_id=tenant_id,
            product_id=product.id,
            batch_no=batch_no or f"BATCH-{uuid.uuid4().hex[:8].upper()}",
            expiry_date=expiry_datetime,
            mfg_date=mfg_datetime,
            quantity=qty,
            purchase_price=unit_cost,
        )
        db.session.add(generated_batch)

    post_stock_ledger(tenant_id, company_id, warehouse_id, product.id, qty,
                      'Production Receipt', 'work_order', work_order.id,
                      f"Finished goods from WO {work_order.wo_number}", rate=unit_cost)

    work_order.produced_qty = as_decimal(work_order.produced_qty or 0) + as_decimal(qty)
    work_order.status = 'qc_pending' if work_order.status == 'wip' else work_order.status
    db.session.add(work_order)

    for sn in serials:
        db.session.add(ProductionMaterialIssue(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            item_id=product.id,
            warehouse_id=warehouse_id,
            qty_issued=0,
            qty_returned=0,
            serial_no=sn,
        ))

    # Auto-record batch lineage for traceability
    if generated_batch:
        db.session.flush()
        issues = ProductionMaterialIssue.query.filter_by(
            work_order_id=work_order.id, tenant_id=tenant_id, is_deleted=False
        ).all()
        for issue in issues:
            if issue.batch_no and (issue.qty_consumed or issue.qty_issued):
                existing = BatchLineage.query.filter_by(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    finished_item_id=product.id,
                    finished_batch_no=generated_batch.batch_no,
                    material_item_id=issue.item_id,
                    material_batch_no=issue.batch_no
                ).first()
                if not existing:
                    lineage = BatchLineage(
                        tenant_id=tenant_id,
                        work_order_id=work_order.id,
                        finished_item_id=product.id,
                        finished_batch_no=generated_batch.batch_no,
                        material_item_id=issue.item_id,
                        material_batch_no=issue.batch_no,
                        qty_consumed=as_decimal(issue.qty_consumed or issue.qty_issued)
                    )
                    db.session.add(lineage)

    db.session.commit()
    if generated_batch is not None:
        generated_batch = db.session.get(ProductBatch, generated_batch.id)
    return db.session.get(WorkOrder, work_order.id), generated_batch, len(serials)


def complete_work_order(work_order, data):
    if work_order.status in ('completed', 'cancelled'):
        raise ValueError(f"Cannot complete a '{work_order.status}' work order")
    work_order.status = 'completed'
    db.session.add(work_order)
    db.session.commit()
    return db.session.get(WorkOrder, work_order.id)



# --- Step 2.4: QC & Subcontracting Services ---

def create_quality_inspection(tenant_id, inspected_by, data):
    reference_type = data.get('reference_type')
    reference_id = data.get('reference_id')
    qc_status = data.get('qc_status', 'passed')
    if reference_type not in ('work_order', 'purchase_receipt') or not reference_id:
        raise ValueError("reference_type (work_order/purchase_receipt) and reference_id are required")

    qc = QualityInspection(
        tenant_id=tenant_id,
        reference_type=reference_type,
        reference_id=int(reference_id),
        passed_qty=data.get('passed_qty', 0),
        failed_qty=data.get('failed_qty', 0),
        qc_status=qc_status,
        inspected_by=inspected_by,
        inspection_date=data.get('inspection_date') or datetime.utcnow(),
        check_parameters=data.get('check_parameters'),
        remarks=data.get('remarks'),
    )
    db.session.add(qc)

    # If the finished goods inspection passed, move the work order to completed
    if reference_type == 'work_order' and qc_status == 'passed':
        wo = db.session.get(WorkOrder, int(reference_id))
        if wo is not None and wo.status in ('qc_pending', 'wip'):
            wo.status = 'completed'
            db.session.add(wo)

    db.session.commit()
    return db.session.get(QualityInspection, qc.id)


def create_job_work_order(tenant_id, data):
    vendor_id = data.get('vendor_id')
    issue_challan_no = data.get('issue_challan_no')
    if not vendor_id or not issue_challan_no:
        raise ValueError("vendor_id and issue_challan_no are required")
    jw = JobWorkOrder(
        tenant_id=tenant_id,
        work_order_id=data.get('work_order_id'),
        vendor_id=int(vendor_id),
        issue_challan_no=issue_challan_no,
        materials_sent=data.get('materials_sent', []),
        expected_return_date=data.get('expected_return_date'),
        actual_return_date=data.get('actual_return_date'),
        service_cost=data.get('service_cost', 0),
        status=data.get('status', 'sent'),
        notes=data.get('notes'),
    )
    db.session.add(jw)
    db.session.commit()
    return db.session.get(JobWorkOrder, jw.id)


def receive_job_work(job_work, data):
    """Record an inward (partial/full) receipt of materials from a job worker."""
    if job_work.status == 'completed':
        raise ValueError("Job work order already completed")
    expected_units = len(job_work.materials_sent or [])
    received_units = data.get('received_units', expected_units)
    job_work.actual_return_date = data.get('actual_return_date') or datetime.utcnow()
    job_work.notes = data.get('notes', job_work.notes)
    if received_units >= expected_units and expected_units > 0:
        job_work.status = 'completed'
    else:
        job_work.status = 'partially_received'
    db.session.add(job_work)
    db.session.commit()
    return db.session.get(JobWorkOrder, job_work.id)
# --- Phase 1 Upgrade: Multi-UOM Conversion Engine Services ---

def list_uom_conversions(tenant_id, item_id=None):
    """Return all active UOM conversions for a tenant (optionally per item)."""
    query = MaterialUomConversion.query.filter_by(
        tenant_id=tenant_id, is_deleted=False
    )
    if item_id:
        query = query.filter_by(item_id=int(item_id))
    return query.order_by(MaterialUomConversion.id.desc()).all()


def create_uom_conversion(tenant_id, data):
    """Create a UOM conversion mapping, e.g. 1 Drum = 200 Liters."""
    data = data or {}
    item_id = data.get('item_id')
    from_uom = (data.get('from_uom') or '').strip()
    to_uom = (data.get('to_uom') or '').strip()
    if not item_id or not from_uom or not to_uom:
        raise ValueError("item_id, from_uom and to_uom are required")
    factor = as_decimal(data.get('conversion_factor', 1))
    if factor <= 0:
        raise ValueError("conversion_factor must be > 0")
    conv = MaterialUomConversion(
        tenant_id=tenant_id,
        item_id=int(item_id),
        from_uom=from_uom,
        to_uom=to_uom,
        conversion_factor=factor,
        is_active=data.get('is_active', True),
    )
    db.session.add(conv)
    db.session.commit()
    return db.session.get(MaterialUomConversion, conv.id)


def delete_uom_conversion(tenant_id, conversion_id):
    """Soft-delete a UOM conversion."""
    conv = MaterialUomConversion.query.filter_by(
        id=int(conversion_id), tenant_id=tenant_id, is_deleted=False
    ).first()
    if conv is None:
        raise ValueError("UOM conversion not found")
    conv.soft_delete()
    return conv

# --- Phase 2 Upgrade: Actual Material Consumption, Returns & WIP Variance ---

def _recompute_issue_variance(issue):
    """variance = actual consumed - planned (positive => over-consumption)."""
    planned = as_decimal(issue.qty_planned or 0)
    consumed = as_decimal(issue.qty_consumed or 0)
    issue.variance = consumed - planned
    db.session.add(issue)
    return issue


def record_material_consumption(issue, qty_consumed):
    """Record the ACTUAL quantity of raw material consumed for an issue line.

    Excess issued-but-unconsumed material flows back to the warehouse as a
    production return.
    """
    consumed = as_decimal(qty_consumed or 0)
    if consumed < 0:
        raise ValueError("qty_consumed cannot be negative")

    issued = as_decimal(issue.qty_issued or 0)
    excess = issued - consumed
    if excess > 0:
        product = db.session.get(Product, issue.item_id)
        if product is not None:
            post_stock_ledger(
                issue.tenant_id, None, issue.warehouse_id, issue.item_id, int(excess),
                'Production Return', 'work_order', issue.work_order_id,
                f"Unconsumed material returned for WO #{issue.work_order_id}",
            )
            if issue.batch_no:
                rb = ProductBatch.query.filter_by(
                    tenant_id=issue.tenant_id,
                    product_id=issue.item_id,
                    batch_no=issue.batch_no,
                    is_deleted=False
                ).first()
                if rb:
                    rb.quantity = (rb.quantity or 0) + int(excess)
                    db.session.add(rb)
        issue.qty_returned = as_decimal(issue.qty_returned or 0) + excess
    elif excess < 0:
        extra_consumed = abs(int(excess))
        product = db.session.get(Product, issue.item_id)
        if product is not None:
            post_stock_ledger(
                issue.tenant_id, None, issue.warehouse_id, issue.item_id, -extra_consumed,
                'Production Issue Extra', 'work_order', issue.work_order_id,
                f"Over-consumption extra issue for WO #{issue.work_order_id}",
            )
            if issue.batch_no:
                rb = ProductBatch.query.filter_by(
                    tenant_id=issue.tenant_id,
                    product_id=issue.item_id,
                    batch_no=issue.batch_no,
                    is_deleted=False
                ).first()
                if rb:
                    rb.quantity = max(0, (rb.quantity or 0) - extra_consumed)
                    db.session.add(rb)
        issue.qty_issued = as_decimal(issue.qty_issued or 0) + extra_consumed

    issue.qty_consumed = consumed
    _recompute_issue_variance(issue)
    db.session.commit()
    return db.session.get(ProductionMaterialIssue, issue.id)


def record_material_return(issue, qty_returned):
    """Return excess material from WIP back to the warehouse and adjust variance."""
    returned = as_decimal(qty_returned or 0)
    if returned < 0:
        raise ValueError("qty_returned cannot be negative")
    issued = as_decimal(issue.qty_issued or 0)
    current_returned = as_decimal(issue.qty_returned or 0)
    if current_returned + returned > issued:
        raise ValueError("Total returned cannot exceed the issued quantity")

    product = db.session.get(Product, issue.item_id)
    if product is not None:
        post_stock_ledger(
            issue.tenant_id, None, issue.warehouse_id, issue.item_id, int(returned),
            'Production Return', 'work_order', issue.work_order_id,
            f"Material return for WO #{issue.work_order_id}",
        )
        if issue.batch_no:
            rb = ProductBatch.query.filter_by(
                tenant_id=issue.tenant_id,
                product_id=issue.item_id,
                batch_no=issue.batch_no,
                is_deleted=False
            ).first()
            if rb:
                rb.quantity = (rb.quantity or 0) + int(returned)
                db.session.add(rb)
    issue.qty_returned = current_returned + returned
    issue.qty_consumed = issued - (current_returned + returned)
    _recompute_issue_variance(issue)
    db.session.commit()
    return db.session.get(ProductionMaterialIssue, issue.id)

def compute_work_order_analysis(work_order):
    """Yield & material WIP variance analysis for a work order.

    Returns per-material planned vs consumed/returned variance plus an overall
    output yield % (actual production against planned BOM consumption).
    """
    rows = []
    total_planned = as_decimal(0)
    total_consumed = as_decimal(0)

    issues = ProductionMaterialIssue.query.filter_by(
        work_order_id=work_order.id, tenant_id=work_order.tenant_id, is_deleted=False
    ).all()
    for issue in issues:
        product = db.session.get(Product, issue.item_id)
        planned = as_decimal(issue.qty_planned or 0)
        consumed = as_decimal(issue.qty_consumed or 0)
        issued = as_decimal(issue.qty_issued or 0)
        returned = as_decimal(issue.qty_returned or 0)
        total_planned += planned
        total_consumed += consumed
        rows.append({
            'item_id': issue.item_id,
            'item_name': product.name if product else None,
            'batch_no': issue.batch_no,
            'qty_planned': float(planned),
            'qty_issued': float(issued),
            'qty_consumed': float(consumed),
            'qty_returned': float(returned),
            'variance': float(as_decimal(issue.variance or 0)),
        })

    planned_qty = as_decimal(work_order.planned_qty or 0)
    produced_qty = as_decimal(work_order.produced_qty or 0)
    output_ratio = float((produced_qty / planned_qty) * 100) if planned_qty else 0.0
    material_yield = float((total_planned / total_consumed) * 100) if total_consumed else 0.0

    return {
        'work_order_id': work_order.id,
        'wo_number': work_order.wo_number,
        'produced_qty': float(produced_qty),
        'planned_qty': float(planned_qty),
        'output_ratio_pct': round(output_ratio, 2),
        'material_yield_pct': round(material_yield, 2),
        'total_planned': float(total_planned),
        'total_consumed': float(total_consumed),
        'rows': rows,
    }


# --- Phase 1 Upgrade: Batch Traceability & Lineage Services ---

def record_batch_lineage(tenant_id, data):
    """Record which raw material batches produced a finished-goods batch."""
    data = data or {}
    work_order_id = data.get('work_order_id')
    finished_item_id = data.get('finished_item_id')
    finished_batch_no = (data.get('finished_batch_no') or '').strip()
    if not work_order_id or not finished_item_id or not finished_batch_no:
        raise ValueError("work_order_id, finished_item_id, finished_batch_no are required")
    materials = data.get('materials') or []
    if not materials:
        raise ValueError("At least one material batch (lineage) is required")

    created = []
    for m in materials:
        if not m.get('material_item_id') or not m.get('material_batch_no'):
            continue
        lineage = BatchLineage(
            tenant_id=tenant_id,
            work_order_id=int(work_order_id),
            finished_item_id=int(finished_item_id),
            finished_batch_no=finished_batch_no,
            material_item_id=int(m['material_item_id']),
            material_batch_no=str(m['material_batch_no']),
            qty_consumed=as_decimal(m.get('qty_consumed') or 0),
        )
        db.session.add(lineage)
        created.append(lineage)
    if not created:
        raise ValueError("No valid material batches provided")
    db.session.commit()
    return [db.session.get(BatchLineage, c.id) for c in created]


def list_batch_lineage(tenant_id, finished_batch_no=None):
    """Return raw-batch lineage records for a tenant, optionally filtered."""
    query = BatchLineage.query.filter_by(tenant_id=tenant_id, is_deleted=False)
    if finished_batch_no:
        query = query.filter_by(finished_batch_no=finished_batch_no)
    return query.order_by(BatchLineage.id.desc()).all()
