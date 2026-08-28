"""
Bakery daily bake-planning service (Phase 3).

`build_daily_bake_plan` produces "what do we bake today" for the baking floor
for a given date/shift. Demand is derived from:

  1. Confirmed Sales Orders due for delivery on that date (make-to-order),
  2. A forecast from historical invoice/POS volume on the SAME WEEKDAY over
     the last ~3 weeks (fresh items are baked daily to match retail demand).

For each bakeable product (a finished product with an active BOM) we create a
plan line with order_demand, forecast_qty, planned_qty (and batches given the
oven/batch capacity). The bake board frontend lets the baker tweak the plan.
"""
from datetime import date as date_cls, timedelta

from app.extensions import db
from app.models.bakery import BakingPlan, BakingPlanItem
from app.models.product import Product
from app.models.sales import SalesOrder, SalesOrderItem, Invoice, InvoiceItem
from app.services.manufacturing_service import get_active_bom_for_product


CONFIRMED_ORDER_STATUSES = ['Confirmed', 'Processing', 'Shipped', 'Delivered']


def _order_demand(tenant_id, product_id, d):
    """Confirmed sales-order quantity due for delivery on date `d`."""
    from app.models.sales import SalesOrderItem as SOI
    total = 0
    orders = SalesOrder.query.filter_by(tenant_id=tenant_id, is_deleted=False).filter(
        SalesOrder.delivery_date.isnot(None)
    ).all()
    for so in orders:
        if so.delivery_date.date() != d:
            continue
        status = (so.status or 'Pending').strip()
        if status.lower() == 'cancelled':
            continue
        total += sum(
            (it.quantity or 0) for it in so.items
            if it.product_id == product_id and not it.is_deleted
        )
    return total


def _forecast_qty(tenant_id, product_id, d):
    """Average units sold on the same weekday over the last ~3 weeks.

    Uses invoice_item volume joined to invoice dates. Returns 0 when there is
    no history.
    """
    weekday = d.weekday()
    cutoff = d - timedelta(days=21)
    sums = {}  # date -> qty
    invoices = Invoice.query.filter(
        Invoice.tenant_id == tenant_id,
        Invoice.is_deleted == False,
        Invoice.invoice_date >= cutoff,          # noqa: E712
        Invoice.invoice_date < d,
    ).all()
    for inv in invoices:
        idate = inv.invoice_date.date()
        if idate.weekday() != weekday:
            continue
        qty = sum((it.quantity or 0) for it in inv.items
                  if it.product_id == product_id and not it.is_deleted)
        sums[idate] = sums.get(idate, 0) + qty

    if not sums:
        return 0
    return round(sum(sums.values()) / len(sums))


def _bakeable_products(tenant_id):
    """Finished products that have an active BOM (can be produced today)."""
    products = Product.query.filter_by(
        tenant_id=tenant_id, is_deleted=False,
        is_raw_material=False, is_service=False,
    ).all()
    out = []
    for p in products:
        bom = get_active_bom_for_product(tenant_id, p.id)
        if bom:
            out.append((p, bom))
    return out


def build_daily_bake_plan(tenant_id, company_id, d, shift='Morning'):
    """Create the daily bake plan for date `d`/shift and return it.

    If a plan for the same date/shift already exists it is returned unchanged
    (so the baker doesn't lose manual edits). Demand drives planned qty.
    """
    if isinstance(d, str):
        d = date_cls.fromisoformat(d)

    existing = BakingPlan.query.filter_by(
        tenant_id=tenant_id, plan_date=d, shift=shift, is_deleted=False).first()
    if existing:
        return existing, False

    plan = BakingPlan(tenant_id=tenant_id, company_id=company_id,
                      plan_date=d, shift=shift, status='planned')
    db.session.add(plan)
    db.session.flush()

    import math
    for product, bom in _bakeable_products(tenant_id):
        order_demand = _order_demand(tenant_id, product.id, d)
        forecast = _forecast_qty(tenant_id, product.id, d)
        if not order_demand and not forecast:
            continue
        planned = max(order_demand, forecast)
        # Default: plan one unit per unit with a single batch; the baker can
        # adjust batch_size/oven on the board. A bigger oven batch is rounded
        # up to whole batches.
        batch_size = 1
        num_batches = max(1, math.ceil(planned / batch_size)) if planned > 0 else 0

        line = BakingPlanItem(
            tenant_id=tenant_id, plan_id=plan.id, product_id=product.id,
            order_demand=order_demand, forecast_qty=forecast,
            planned_qty=planned, batch_size=batch_size, num_batches=num_batches,
            oven='', status='planned', notes='',
        )
        db.session.add(line)

    db.session.commit()
    return plan, True


def get_bake_plan(tenant_id, d, shift=None, plan_id=None):
    """Return a single baking plan, by plan_id or by date(+shift)."""
    q = BakingPlan.query.filter_by(tenant_id=tenant_id, is_deleted=False)
    if plan_id:
        return q.filter(BakingPlan.id == int(plan_id)).first()
    if isinstance(d, str):
        d = date_cls.fromisoformat(d)
    q = q.filter(BakingPlan.plan_date == d)
    if shift:
        q = q.filter(BakingPlan.shift == shift)
    return q.first()


def list_bake_plans(tenant_id, d=None, limit=30):
    q = BakingPlan.query.filter_by(tenant_id=tenant_id, is_deleted=False)
    if d:
        if isinstance(d, str):
            d = date_cls.fromisoformat(d)
        q = q.filter(BakingPlan.plan_date == d)
    return q.order_by(BakingPlan.plan_date.desc(), BakingPlan.id.desc()).limit(limit).all()


def update_plan_line(line_id, tenant_id, data):
    """Update editable fields of a single bake-plan line (returns line or None)."""
    line = BakingPlanItem.query.filter_by(id=int(line_id), tenant_id=tenant_id, is_deleted=False).first()
    if not line:
        return None
    for field in ['planned_qty', 'batch_size', 'oven', 'status', 'notes']:
        if field in data:
            setattr(line, field, data[field])
    # Recompute batches whenever planned qty or batch size changes.
    import math
    if data.get('planned_qty') is not None or data.get('batch_size') is not None:
        bs = int(line.batch_size or 1) or 1
        line.num_batches = max(1, math.ceil(int(line.planned_qty or 0) / bs))
    db.session.commit()
    return line


def update_plan_status(plan_id, tenant_id, status):
    plan = BakingPlan.query.filter_by(id=int(plan_id), tenant_id=tenant_id, is_deleted=False).first()
    if not plan:
        return None
    plan.status = status
    db.session.commit()
    return plan