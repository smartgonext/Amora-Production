from app.extensions import db
from app.models.base import BaseModel


# =====================================================================
# 2.1 Configuration & Meta
# =====================================================================

class TenantManufacturingConfig(BaseModel):
    """Per-tenant manufacturing engine configuration."""
    __tablename__ = 'tenant_manufacturing_configs'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    mfg_type = db.Column(db.String(20), nullable=False, default='discrete')  # process, discrete, textile, assembly
    enabled_features = db.Column(db.JSON, nullable=False, default=list)
    bom_label = db.Column(db.String(50), nullable=True)
    tracking_label = db.Column(db.String(50), nullable=True)
    operation_label = db.Column(db.String(50), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)


# =====================================================================
# 2.2 Bill of Materials (BOM) & Routing
# =====================================================================

class BomHeader(BaseModel):
    """Master BOM record with versioning and lifecycle status."""
    __tablename__ = 'bom_headers'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False, index=True)
    version = db.Column(db.String(20), nullable=False, default='V1.0')
    revision_no = db.Column(db.Integer, default=0)
    name = db.Column(db.String(150), nullable=False)
    status = db.Column(db.String(20), default='draft', index=True)  # active, draft, deprecated
    effective_start_date = db.Column(db.DateTime, nullable=True)
    effective_end_date = db.Column(db.DateTime, nullable=True)
    standard_cost = db.Column(db.Numeric(14, 2), default=0.00)
    overhead_cost = db.Column(db.Numeric(14, 2), default=0.00)
    total_setup_time_mins = db.Column(db.Integer, default=0)
    base_quantity = db.Column(db.Numeric(12, 4), default=1.0000, nullable=False)  # Output yield / batch size this formula produces
    # Bakery / process-manufacturing fields: baker's % scaling, dough yield and
    # bake loss are the bakery equivalents of standard yield & waste.
    hydration_pct = db.Column(db.Numeric(8, 4), default=0.0000)  # water as % of flour
    dough_yield_pct = db.Column(db.Numeric(8, 4), default=0.0000) # (dough wt / total input) * 100
    bake_loss_pct = db.Column(db.Numeric(8, 4), default=0.0000)   # (1 - finished/dough wt) * 100
    notes = db.Column(db.Text, nullable=True)

    items = db.relationship('BomItem', backref='bom', lazy='dynamic', cascade="all, delete-orphan", order_by="BomItem.id")
    byproducts = db.relationship('BomByproduct', backref='bom', lazy='dynamic', cascade="all, delete-orphan")
    routing_operations = db.relationship('BomRoutingOperation', backref='bom', lazy='dynamic', cascade="all, delete-orphan")
    work_orders = db.relationship('WorkOrder', backref='bom', lazy='dynamic')

    def to_dict(self):
        data = super().to_dict()
        data['base_quantity'] = float(self.base_quantity) if self.base_quantity is not None else 1.0
        if self.product_id:
            from app.models.product import Product
            p = Product.query.get(self.product_id)
            if p:
                data['product_name'] = p.name
                data['product'] = p.to_dict()
        data['items'] = [i.to_dict() for i in self.items if not i.is_deleted]
        data['byproducts'] = [b.to_dict() for b in self.byproducts if not b.is_deleted]
        data['routing_operations'] = [r.to_dict() for r in self.routing_operations if not r.is_deleted]
        return data


class BomItem(BaseModel):
    """Raw / semi-finished component line with multi-level hierarchy support."""
    __tablename__ = 'bom_items'

    bom_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('bom_headers.id'), nullable=False, index=True)
    item_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False, index=True)
    qty_required = db.Column(db.Numeric(14, 4), nullable=False, default=1.0000)
    uom = db.Column(db.String(20), nullable=True)
    waste_pct = db.Column(db.Numeric(8, 4), default=0.0000)
    baker_pct = db.Column(db.Numeric(8, 4), nullable=True)  # baker's % relative to flour = 100%
    is_alternate = db.Column(db.Boolean, default=False, nullable=False)
    parent_bom_item_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('bom_items.id'), nullable=True, index=True)

    material_item_id = property(lambda self: self.item_id)
    children = db.relationship('BomItem', backref=db.backref('parent', remote_side='BomItem.id'), lazy='dynamic')

    def to_dict(self):
        data = super().to_dict()
        data['material_item_id'] = self.item_id
        if self.item_id:
            from app.models.product import Product
            p = Product.query.get(self.item_id)
            if p:
                data['item_name'] = p.name
                data['product_name'] = p.name
                data['material_name'] = p.name
        return data


class BomByproduct(BaseModel):
    """Co-products, Scrap and By-products."""
    __tablename__ = 'bom_byproducts'

    bom_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('bom_headers.id'), nullable=False, index=True)
    item_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    type = db.Column(db.String(20), default='by_product')  # co_product, by_product, scrap
    qty_expected = db.Column(db.Numeric(14, 4), default=0.0000)
    uom = db.Column(db.String(20), nullable=True)


class WorkCenter(BaseModel):
    """Production work center carrying labour & machine burden rates."""
    __tablename__ = 'work_centers'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    hourly_labor_rate = db.Column(db.Numeric(12, 2), default=0.00)
    hourly_machine_rate = db.Column(db.Numeric(12, 2), default=0.00)
    capacity_limit = db.Column(db.Integer, default=0)
    description = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    routing_operations = db.relationship('BomRoutingOperation', backref='work_center', lazy='dynamic')


class Machine(BaseModel):
    """Machine master referenced by routing operations."""
    __tablename__ = 'machines'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    work_center_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('work_centers.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    hourly_machine_rate = db.Column(db.Numeric(12, 2), default=0.00)
    capacity_limit = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    routing_operations = db.relationship('BomRoutingOperation', backref='machine', lazy='dynamic')


class BomRoutingOperation(BaseModel):
    """Sequenced routing step mapping a BOM to a work center / machine."""
    __tablename__ = 'bom_routing_operations'

    bom_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('bom_headers.id'), nullable=False, index=True)
    operation_sequence = db.Column(db.Integer, nullable=False, index=True)  # 10, 20, 30
    operation_name = db.Column(db.String(100), nullable=False)
    work_center_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('work_centers.id'), nullable=True)
    machine_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('machines.id'), nullable=True)
    setup_time_mins = db.Column(db.Integer, default=0)
    processing_time_per_unit_mins = db.Column(db.Numeric(12, 4), default=0.0000)
    labor_hours_per_unit = db.Column(db.Numeric(12, 4), default=0.0000)


# =====================================================================
# 2.3 Raw Material Procurement & Supplier Integration (MRP)
# =====================================================================

class SupplierItemMapping(BaseModel):
    """Maps a raw material item to a supplier with pricing + lead time."""
    __tablename__ = 'supplier_item_mappings'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    supplier_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('suppliers.id'), nullable=False, index=True)
    item_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False, index=True)
    supplier_part_number = db.Column(db.String(100), nullable=True)
    unit_price = db.Column(db.Numeric(14, 4), default=0.0000)
    lead_time_days = db.Column(db.Integer, default=0)
    min_order_qty = db.Column(db.Numeric(14, 4), default=0.0000)  # MOQ
    is_preferred_supplier = db.Column(db.Boolean, default=False, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)


class MaterialRequirementPlan(BaseModel):
    """Auto-calculated raw material requirement (MRP run) against work orders."""
    __tablename__ = 'material_requirements_plans'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    work_order_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('work_orders.id'), nullable=True, index=True)
    raw_material_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False, index=True)
    required_qty = db.Column(db.Numeric(14, 4), default=0.0000)
    current_stock_qty = db.Column(db.Numeric(14, 4), default=0.0000)
    shortage_qty = db.Column(db.Numeric(14, 4), default=0.0000)
    suggested_po_qty = db.Column(db.Numeric(14, 4), default=0.0000)
    supplier_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('suppliers.id'), nullable=True)
    status = db.Column(db.String(20), default='draft', index=True)  # draft, po_generated


# =====================================================================
# 2.4 Production Control (Work Orders & WIP)
# =====================================================================

class WorkOrder(BaseModel):
    """Production work order. `sales_order_id` only for Make-to-Order."""
    __tablename__ = 'work_orders'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    sales_order_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('sales_orders.id'), nullable=True, index=True)
    bom_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('bom_headers.id'), nullable=True, index=True)
    wo_number = db.Column(db.String(50), nullable=False, index=True)
    planned_qty = db.Column(db.Numeric(14, 4), default=0.0000)
    produced_qty = db.Column(db.Numeric(14, 4), default=0.0000)
    start_date = db.Column(db.DateTime, nullable=True)
    due_date = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='planned', index=True)  # planned, released, wip, qc_pending, completed, cancelled
    notes = db.Column(db.Text, nullable=True)

    operations = db.relationship('WorkOrderOperation', backref='work_order', lazy='dynamic', cascade="all, delete-orphan", order_by="WorkOrderOperation.operation_sequence")
    material_issues = db.relationship('ProductionMaterialIssue', backref='work_order', lazy='dynamic', cascade="all, delete-orphan")
    mrp_plans = db.relationship('MaterialRequirementPlan', backref='work_order', lazy='dynamic')

    def to_dict(self):
        data = super().to_dict()
        data['planned_qty'] = float(self.planned_qty or 1.0)
        data['produced_qty'] = float(self.produced_qty or 0.0)
        if self.bom_id:
            b = BomHeader.query.get(self.bom_id)
            if b:
                data['bom_name'] = b.name
                if b.product_id:
                    from app.models.product import Product
                    p = Product.query.get(b.product_id)
                    if p:
                        data['product_name'] = p.name
                        data['product'] = p.to_dict()
        data['operations'] = [o.to_dict() for o in self.operations if not o.is_deleted]
        return data


class WorkOrderOperation(BaseModel):
    """Tracks completion state and actual time/cost per routing stage."""
    __tablename__ = 'work_order_operations'

    work_order_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('work_orders.id'), nullable=False, index=True)
    operation_sequence = db.Column(db.Integer, nullable=False, index=True)
    operation_name = db.Column(db.String(100), nullable=False)
    work_center_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('work_centers.id'), nullable=True)
    status = db.Column(db.String(20), default='pending', index=True)  # pending, in_progress, completed
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    actual_setup_time = db.Column(db.Integer, default=0)  # Minutes
    actual_run_time = db.Column(db.Integer, default=0)     # Minutes
    operator_user_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)


class ProductionMaterialIssue(BaseModel):
    """Tracks issue/return of raw materials into WIP."""
    __tablename__ = 'production_material_issues'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    work_order_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('work_orders.id'), nullable=False, index=True)
    item_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    warehouse_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('warehouses.id'), nullable=True)
    qty_planned = db.Column(db.Numeric(14, 4), default=0.0000)
    qty_issued = db.Column(db.Numeric(14, 4), default=0.0000)
    qty_consumed = db.Column(db.Numeric(14, 4), default=0.0000)
    qty_returned = db.Column(db.Numeric(14, 4), default=0.0000)
    variance = db.Column(db.Numeric(14, 4), default=0.0000)
    batch_no = db.Column(db.String(50), nullable=True)
    serial_no = db.Column(db.String(100), nullable=True)


# =====================================================================
# Phase 1 Upgrade: Multi-UOM Conversion Engine
# =====================================================================

class MaterialUomConversion(BaseModel):
    """Maps alternate purchasing/consumption units to base stock units.
    e.g. 1 Drum = 200 Liters, 1 Box = 24 Pcs."""
    __tablename__ = 'material_uom_conversions'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    item_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False, index=True)
    from_uom = db.Column(db.String(20), nullable=False)      # e.g. 'Drum', 'Box'
    to_uom = db.Column(db.String(20), nullable=False)        # e.g. 'Liter', 'Pcs'
    conversion_factor = db.Column(db.Numeric(12, 6), nullable=False, default=1.000000)  # 1 Drum = 200 Liters
    is_active = db.Column(db.Boolean, default=True, nullable=False)


# =====================================================================
# Phase 1 Upgrade: Batch Traceability & Lineage Map
# =====================================================================

class BatchLineage(BaseModel):
    """Link a finished-goods batch to the raw material batches that produced it."""
    __tablename__ = 'batch_lineage'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    work_order_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('work_orders.id'), nullable=False, index=True)
    finished_item_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    finished_batch_no = db.Column(db.String(50), nullable=False)
    material_item_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    material_batch_no = db.Column(db.String(50), nullable=False)
    qty_consumed = db.Column(db.Numeric(14, 4), default=0.0000)



# =====================================================================
# 2.5 Quality Control & Job Work
# =====================================================================

class QualityInspection(BaseModel):
    """QC inspection against a work order or purchase receipt."""
    __tablename__ = 'quality_inspections'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    reference_type = db.Column(db.String(30), nullable=False)  # work_order, purchase_receipt
    reference_id = db.Column(db.BigInteger(), nullable=False, index=True)
    passed_qty = db.Column(db.Numeric(14, 4), default=0.0000)
    failed_qty = db.Column(db.Numeric(14, 4), default=0.0000)
    qc_status = db.Column(db.String(20), default='passed')  # passed, failed, conditional
    inspected_by = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    inspection_date = db.Column(db.DateTime, nullable=True)
    check_parameters = db.Column(db.JSON, nullable=True)
    remarks = db.Column(db.Text, nullable=True)


class JobWorkOrder(BaseModel):
    """Subcontracting / job-work order sent to an external vendor."""
    __tablename__ = 'job_work_orders'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    work_order_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('work_orders.id'), nullable=True, index=True)
    vendor_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('suppliers.id'), nullable=False)
    issue_challan_no = db.Column(db.String(50), nullable=False, index=True)
    materials_sent = db.Column(db.JSON, nullable=True)
    expected_return_date = db.Column(db.DateTime, nullable=True)
    actual_return_date = db.Column(db.DateTime, nullable=True)
    service_cost = db.Column(db.Numeric(14, 2), default=0.00)
    status = db.Column(db.String(30), default='sent', index=True)  # sent, partially_received, completed
    notes = db.Column(db.Text, nullable=True)
