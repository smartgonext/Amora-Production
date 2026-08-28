"""Bakery production planning models: Daily Bake Plan (header + lines)."""
from app.extensions import db
from app.models.base import BaseModel


class BakingPlan(BaseModel):
    """A daily production plan for the baking floor (see BAKERY feature plan).

    Groups many product lines on a given date/shift so the baker knows what to
    make today. Demand comes from confirmed sales orders plus a forecast of the
    same-weekday historical POS/invoice volume (fresh items are baked daily).
    """
    __tablename__ = 'baking_plans'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                          db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                           db.ForeignKey('companies.id'), nullable=True)
    plan_date = db.Column(db.Date, nullable=False, index=True)
    shift = db.Column(db.String(20), default='Morning', nullable=False)  # Morning, Evening, Night
    status = db.Column(db.String(20), default='planned', index=True)  # planned, in_progress, completed, cancelled

    items = db.relationship('BakingPlanItem', backref='plan', lazy='dynamic',
                            cascade="all, delete-orphan", order_by="BakingPlanItem.id")

    def to_dict(self):
        data = super().to_dict()
        data['items'] = [i.to_dict() for i in self.items if not i.is_deleted]
        return data


class BakingPlanItem(BaseModel):
    """One product line within a baking plan."""
    __tablename__ = 'baking_plan_items'

    plan_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                        db.ForeignKey('baking_plans.id'), nullable=False, index=True)
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                          db.ForeignKey('tenants.id'), nullable=False, index=True)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                           db.ForeignKey('products.id'), nullable=False, index=True)
    # Demand drivers
    order_demand = db.Column(db.Integer, default=0, nullable=False)   # confirmed sales-order qty
    forecast_qty = db.Column(db.Integer, default=0, nullable=False)   # same-weekday historical avg
    # Planned output
    planned_qty = db.Column(db.Integer, default=0, nullable=False)
    batch_size = db.Column(db.Integer, default=0, nullable=False)     # units per batch (oven capacity)
    num_batches = db.Column(db.Integer, default=0, nullable=False)
    oven = db.Column(db.String(50), nullable=True)                    # line / oven / work-center label
    status = db.Column(db.String(20), default='planned', nullable=False)  # planned, baking, done, cancelled
    notes = db.Column(db.Text, nullable=True)


class DeliveryRoute(BaseModel):
    """A daily distribution route/run for the bakery vans.

    Bakes route to a delivery route on a date; each route carries ordered
    customer stops. After dispatch the baker records fresh unsold returns via
    the route or directly as credit notes.
    """
    __tablename__ = 'delivery_routes'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                          db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                           db.ForeignKey('companies.id'), nullable=True)
    route_date = db.Column(db.Date, nullable=False, index=True)
    vehicle_no = db.Column(db.String(20), nullable=True)
    driver = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), default='planned', index=True)  # planned, in_transit, completed, cancelled
    notes = db.Column(db.Text, nullable=True)

    stops = db.relationship('DeliveryRouteStop', backref='route', lazy='dynamic',
                            cascade="all, delete-orphan", order_by="DeliveryRouteStop.sequence")

    def to_dict(self):
        data = super().to_dict()
        data['stops'] = [s.to_dict() for s in self.stops if not s.is_deleted]
        return data


class DeliveryRouteStop(BaseModel):
    """A customer stop on a delivery route (in visit order)."""
    __tablename__ = 'delivery_route_stops'

    route_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                         db.ForeignKey('delivery_routes.id'), nullable=False, index=True)
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                          db.ForeignKey('tenants.id'), nullable=False, index=True)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                            db.ForeignKey('customers.id'), nullable=False)
    sequence = db.Column(db.Integer, default=10, nullable=False)
    status = db.Column(db.String(20), default='pending', nullable=False)  # pending, delivered, returned, missed
    delivery_challan_id = db.Column(db.BigInteger(), nullable=True)
    notes = db.Column(db.Text, nullable=True)


class HaccpControlPoint(BaseModel):
    """A HACCP food-safety check recorded against a bake plan / batch.

    Stores a control-checkpoint (e.g. oven temp, dough pH, cooling temp) with
    a target/spec range and the recorded (actual) value, plus pass/fail and
    whether a corrective action is needed. Links to the bakery planning for
    traceability.
    """
    __tablename__ = 'haccp_control_points'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                          db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                           db.ForeignKey('companies.id'), nullable=True)
    bake_plan_item_id = db.Column(db.BigInteger(), nullable=True, index=True)
    work_order_id = db.Column(db.BigInteger(), nullable=True, index=True)
    checkpoint_name = db.Column(db.String(100), nullable=False)   # e.g. Oven Temp, Dough pH
    recorded_value = db.Column(db.String(50), nullable=True)
    spec_min = db.Column(db.Numeric(12, 4), nullable=True)
    spec_max = db.Column(db.Numeric(12, 4), nullable=True)
    unit = db.Column(db.String(20), nullable=True)                # C, pH, %, min
    is_pass = db.Column(db.Boolean, default=True, nullable=False)
    corrective_action = db.Column(db.String(255), nullable=True)
    checked_by = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    checked_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)