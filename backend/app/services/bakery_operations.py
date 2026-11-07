"""
Bakery distribution & freshness operations (Phase 4).

Provides:
  * FEFO / freshness analysis — batches ordered by expiry, with flags for
    fresh / near-expiry / expired, so the baker picks the shortest-life first.
  * Unsold fresh-stock return -> credit note (a SalesReturn / SalesReturnItem),
    optionally restocking the returned qty back into the product (inventory).
  * Daily delivery route management (route + ordered customer stops).

These stay gated to bakery/process tenants by the front-end nav.
"""
import uuid
from datetime import datetime, date as date_cls

from sqlalchemy import func

from app.extensions import db
from app.models.bakery import (DeliveryRoute, DeliveryRouteStop, HaccpControlPoint)
from app.models.product import Product, ProductBatch, StockLedger
from app.models.sales import SalesReturn, SalesReturnItem


# ---------------------------------------------------------------------------
# FEFO / freshness
# ---------------------------------------------------------------------------
def fefo_pick_list(tenant_id, product_id=None, near_expiry_days=3):
    """List product batches ordered by expiry (FEFO).

    Returns each batch with its freshness status. Only batches that still have
    stock (quantity > 0) are returned.
    """
    products = Product.query.filter_by(tenant_id=tenant_id, is_deleted=False)
    if product_id:
        products = products.filter(Product.id == int(product_id))
    product_ids = [p.id for p in products.all()]

    if not product_ids:
        return []

    today = date_cls.today()
    batches = ProductBatch.query.filter(
        ProductBatch.tenant_id == tenant_id,
        ProductBatch.quantity > 0,
        ProductBatch.product_id.in_(product_ids),
        ProductBatch.is_deleted == False,  # noqa: E712
    ).order_by(ProductBatch.expiry_date.asc(), ProductBatch.id.asc()).all()

    result = []
    prod_map = {p.id: p.name for p in products.all()}
    for b in batches:
        status = 'no_expiry'
        diff = None
        if b.expiry_date and b.expiry_date.date():
            diff = (b.expiry_date.date() - today).days
            if diff < 0:
                status = 'expired'
            elif diff <= near_expiry_days:
                status = 'near_expiry'
            else:
                status = 'fresh'
        result.append({
            'batch_id': b.id,
            'product_id': b.product_id,
            'product_name': prod_map.get(b.product_id, f'Product #{b.product_id}'),
            'batch_no': b.batch_no,
            'quantity': b.quantity,
            'mfg_date': b.mfg_date.isoformat() if b.mfg_date else None,
            'expiry_date': b.expiry_date.isoformat() if b.expiry_date else None,
            'days_to_expiry': diff,
            'status': status,
        })
    return result


# ---------------------------------------------------------------------------
# Unsold fresh-stock return -> credit note
# ---------------------------------------------------------------------------
def record_unsold_return(tenant_id, company_id, data):
    """Record an unsold-fresh-stock return as a credit note (SalesReturn).

    Payload: { customer_id, reason?, items: [{ product_id, quantity, rate, batch_id? }] }
    Creates the SalesReturn + SalesReturnItems and restocks the product's
    on-hand quantity. Returns the created SalesReturn.
    """
    customer_id = data.get('customer_id')
    if not customer_id:
        raise ValueError("customer_id is required")
    items = data.get('items') or []
    if not items:
        raise ValueError("At least one return item is required")

    r_no = data.get('return_number') or f"RET-{uuid.uuid4().hex[:8].upper()}"
    subtotal = 0.0
    s_return = SalesReturn(
        tenant_id=tenant_id,
        company_id=company_id,
        customer_id=int(customer_id),
        invoice_id=data.get('invoice_id'),
        return_number=r_no,
        return_date=datetime.utcnow(),
        reason=data.get('reason') or 'Unsold fresh stock return',
        status='Completed',
    )
    db.session.add(s_return)
    db.session.flush()

    for it in items:
        product = Product.query.filter_by(id=int(it['product_id']),
                                          tenant_id=tenant_id, is_deleted=False).first()
        if not product:
            raise ValueError(f"Product {it.get('product_id')} not found")
        qty = int(it.get('quantity', 0))
        rate = float(it.get('rate', 0))
        subtotal += qty * rate
        s_item = SalesReturnItem(
            tenant_id=tenant_id,
            sales_return_id=s_return.id,
            product_id=product.id,
            quantity=qty,
            rate=rate,
            gst_rate=float(it.get('gst_rate') or product.gst_rate or 0),
            total_amount=qty * rate,
        )
        db.session.add(s_item)

        product.current_stock = (product.current_stock or 0) + qty
        db.session.add(product)
        db.session.add(StockLedger(
            tenant_id=tenant_id,
            company_id=company_id,
            product_id=product.id,
            batch_id=it.get('batch_id'),
            quantity_delta=qty,
            running_balance=product.current_stock,
            type='Return',
            reference_type='sales_return',
            reference_id=s_return.id,
            notes='Unsold fresh stock return',
            transaction_date=datetime.utcnow(),
        ))

    s_return.subtotal = subtotal
    s_return.total_amount = subtotal
    db.session.commit()
    return s_return


def list_unsold_returns(tenant_id):
    return SalesReturn.query.filter_by(tenant_id=tenant_id, is_deleted=False) \
        .order_by(SalesReturn.return_date.desc()).all()


# ---------------------------------------------------------------------------
# Delivery routes
# ---------------------------------------------------------------------------
def create_delivery_route(tenant_id, company_id, data):
    route = DeliveryRoute(
        tenant_id=tenant_id,
        company_id=company_id,
        route_date=data.get('route_date') or date_cls.today(),
        vehicle_no=data.get('vehicle_no'),
        driver=data.get('driver'),
        status=data.get('status', 'planned'),
        notes=data.get('notes'),
    )
    db.session.add(route)
    db.session.flush()

    seq = 10
    for cid in data.get('customer_ids', []) or []:
        db.session.add(DeliveryRouteStop(
            tenant_id=tenant_id,
            route_id=route.id,
            customer_id=int(cid),
            sequence=seq,
            status='pending',
        ))
        seq += 10

    db.session.commit()
    return route


def list_delivery_routes(tenant_id, d=None):
    q = DeliveryRoute.query.filter_by(tenant_id=tenant_id, is_deleted=False)
    if d:
        if isinstance(d, str):
            d = date_cls.fromisoformat(d)
        q = q.filter(DeliveryRoute.route_date == d)
    return q.order_by(DeliveryRoute.route_date.desc(), DeliveryRoute.id.desc()).all()


def update_route_status(route_id, tenant_id, status):
    route = DeliveryRoute.query.filter_by(id=int(route_id), tenant_id=tenant_id,
                                          is_deleted=False).first()
    if not route:
        return None
    route.status = status
    db.session.commit()
    return route

# ---------------------------------------------------------------------------
# HACCP control points (food-safety QC)
# ---------------------------------------------------------------------------
def add_haccp_check(tenant_id, company_id, data, user_id=None):
    """Record a HACCP control-point check (pass/fail) against a bake item/order."""
    if not data.get('checkpoint_name'):
        raise ValueError("checkpoint_name is required")
    check = HaccpControlPoint(
        tenant_id=tenant_id,
        company_id=company_id,
        bake_plan_item_id=data.get('bake_plan_item_id'),
        work_order_id=data.get('work_order_id'),
        checkpoint_name=data['checkpoint_name'],
        recorded_value=data.get('recorded_value'),
        spec_min=data.get('spec_min'),
        spec_max=data.get('spec_max'),
        unit=data.get('unit'),
        is_pass=bool(data.get('is_pass', True)),
        corrective_action=data.get('corrective_action'),
        checked_by=user_id,
        checked_at=datetime.utcnow(),
        notes=data.get('notes'),
    )
    db.session.add(check)
    db.session.commit()
    return check


def list_haccp_checks(tenant_id, work_order_id=None, bake_plan_item_id=None):
    q = HaccpControlPoint.query.filter_by(tenant_id=tenant_id, is_deleted=False)
    if work_order_id:
        q = q.filter(HaccpControlPoint.work_order_id == int(work_order_id))
    if bake_plan_item_id:
        q = q.filter(HaccpControlPoint.bake_plan_item_id == int(bake_plan_item_id))
    return q.order_by(HaccpControlPoint.id.desc()).all()


# ---------------------------------------------------------------------------
# Bake-day cost & variance report (Phase 7)
# ---------------------------------------------------------------------------
def compute_day_cost(tenant_id, company_id, d):
    """Per-production-day cost & variance for the bakery floor.

    Sums the day's unsold returns (credit-note value, burns/excess product) and
    planned bake demand vs batch math. Because this ERP tracks materials at the
    work-order/BOM level, we present a practical day-level summary from the
    plant-production data already captured (bake plans + returns), plus labour
    placeholders the baker can refine. Returns a dict report.
    """
    from app.models.bakery import BakingPlan
    from app.models.sales import SalesReturn
    from app.models.manufacturing import WorkOrder

    if isinstance(d, str):
        d = date_cls.fromisoformat(d)

    # 1. Sales returns (unsold) on that date = cost of waste/returned goods.
    returns = SalesReturn.query.filter_by(tenant_id=tenant_id, is_deleted=False) \
        .filter(func.date(SalesReturn.return_date) == d).all()
    return_cost = float(sum(r.total_amount or 0 for r in returns))

    # 2. Bake plans that day -> planned units.
    plans = BakingPlan.query.filter_by(tenant_id=tenant_id, plan_date=d,
                                       is_deleted=False).all()
    planned_units = sum(int(line.planned_qty or 0) for p in plans for line in p.items)

    # 3. Production work orders that day (for variance vs standard material cost).
    orders = WorkOrder.query.filter_by(tenant_id=tenant_id, is_deleted=False) \
        .filter(func.date(WorkOrder.start_date) == d).all()

    # 4. Labour / overhead placeholder (no timecards yet) — surfaced for clarity.
    labour_est = round(planned_units * 0.0, 2)

    return {
        'date': d.isoformat(),
        'unsold_return_cost': round(return_cost, 2),
        'planned_units': planned_units,
        'work_order_count': len(orders),
        'labour_est': labour_est,
        'notes': 'Unsold returns = wasted baked value; augment labour/overhead as tracked.',
    }


