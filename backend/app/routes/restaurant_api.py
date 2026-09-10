"""
Manufacturer -> Restaurant integration API.

Purpose
-------
Expose a small, stable, API-key secured surface for the RESTAURANT EXE (a local
billing software):

    * GET  /api/v1/store/products              -> finished products that are READY + their stock
    * POST /api/v1/store/dispatch              -> move finished goods to the store
          (ERP reduces stock, saves the dispatch record; EXE increases its own stock)
    * GET  /api/v1/store/dispatches            -> list dispatches sent to this store
    * GET  /api/v1/store/dispatches/<id>       -> single dispatch detail
    * POST /api/v1/store/dispatches/<id>/receive  -> EXE confirms the goods arrived

ERP-side management (JWT, logged in user only):
    * GET  /api/v1/store/channels              -> list my restaurant outlets
    * POST /api/v1/store/channels              -> register an outlet (returns API key)
    * POST /api/v1/store/channels/<id>/rotate-key  -> issue a new API key
    * GET  /api/v1/store/channels/<id>/dispatches  -> full history per outlet

Authentication:
    * EXE calls use the store API key in the  X-API-Key  header.
    * Management calls use a normal logged-in user JWT (flask_jwt_extended).
"""
import uuid
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db

from app.models.user import User
from app.models.product import Product, ProductBatch, StockLedger, StockTransfer, Warehouse
from app.models.restaurant_store import StoreChannel, StoreDispatch, StoreDispatchItem

store_bp = Blueprint('store', __name__)

API_KEY_HEADER = 'X-API-Key'


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))


def _store_from_request():
    """Resolve the store/outlet from the X-API-Key header."""
    key = (request.headers.get(API_KEY_HEADER) or '').strip()
    if not key:
        return None
    return StoreChannel.query.filter_by(api_key=key, is_active=True, is_deleted=False).first()


def _error(msg, code=400):
    return jsonify({"data": None, "errors": [msg]}), code


def _default_warehouse(tenant_id, company_id):
    """The ERP's main warehouse used as the 'from' location on dispatch."""
    wh = Warehouse.query.filter_by(tenant_id=tenant_id, is_deleted=False).order_by(Warehouse.id).first()
    if wh:
        return wh
    wh = Warehouse(tenant_id=tenant_id, company_id=company_id,
                   name='Manufacturer Warehouse', location='Bakery', is_active=True)
    db.session.add(wh)
    db.session.flush()
    return wh


def _dispatch_ref():
    return 'DSP-' + uuid.uuid4().hex[:10].upper()

# ===========================================================================
# EXE endpoints (API-key secured)
# ===========================================================================
@store_bp.route('/health', methods=['GET'])
def store_health():
    return jsonify({"data": {"status": "online", "service": "restaurant-integration"}, "errors": None}), 200


@store_bp.route('/products', methods=['GET'])
def store_products():
    """How many finished products are READY right now (with details)."""
    store = _store_from_request()
    if not store:
        return _error("Invalid or missing X-API-Key", 401)

    include_zero = request.args.get('include_zero_stock', '0') in ('1', 'true', 'yes')

    products = (Product.query
                .filter_by(tenant_id=store.tenant_id, is_deleted=False,
                           is_service=False, is_raw_material=False)
                .all())

    result = []
    for p in products:
        stock = p.current_stock or 0
        if stock <= 0 and not include_zero:
            continue
        item = {
            "product_id": p.id,
            "name": p.name,
            "sku": p.sku,
            "gst_rate": float(p.gst_rate or 0),
            "selling_price": float(p.selling_price or 0),
            "is_batch_tracked": p.is_batch_tracked,
            "ready_stock": stock,
            "stock_from_manufacturing": stock,
            "batches": [],
        }
        item["batches"] = [{
            "batch_no": b.batch_no,
            "quantity": b.quantity or 0,
            "mfg_date": b.mfg_date.isoformat() if b.mfg_date else None,
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
        } for b in p.batches if not b.is_deleted and (b.quantity or 0) > 0]
        result.append(item)

    store.last_sync_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        "data": {
            "store_code": store.code,
            "synced_at": datetime.utcnow().isoformat(),
            "count": len(result),
            "products": result,
        },
        "errors": None,
    }), 200

def _pick_batch(product, qty):
    """FEFO batch selection for batch-tracked products (earliest expiry first)."""
    batches = (ProductBatch.query
               .filter_by(product_id=product.id, is_deleted=False)
               .filter(ProductBatch.quantity > 0)
               .order_by(ProductBatch.expiry_date.asc())
               .all())
    remaining = qty
    chosen = []
    for b in batches:
        if remaining <= 0:
            break
        take = min(b.quantity or 0, remaining)
        if take <= 0:
            continue
        chosen.append((b, take))
        remaining -= take
    return chosen, remaining
@store_bp.route('/dispatch', methods=['POST'])
def store_dispatch():
    """Send finished products from manufacturing to the store.

    Body: { "items": [ { "product_id": 12, "qty": 10 } ], "notes": "..." }

    Effects in the ERP (single, atomic commit):
      * checks stock is available,
      * reduces Product.current_stock,
      * reduces ProductBatch.quantity (FEFO) for batch-tracked products,
      * writes StockLedger 'Transfer' movements,
      * creates one StoreDispatch + items (status=dispatched).

    The restaurant EXE then increases its OWN stock for these products.
    """
    store = _store_from_request()
    if not store:
        return _error("Invalid or missing X-API-Key", 401)

    data = request.get_json(silent=True) or {}
    items = data.get('items') or []
    if not items or not isinstance(items, list):
        return _error("Body requires 'items' as a list")

    existing_dispatch_id = data.get('dispatch_id')  # idempotency guard
    if existing_dispatch_id:
        already = StoreDispatch.query.filter_by(id=existing_dispatch_id, store_id=store.id).first()
        if already:
            return jsonify({"data": already.to_dict(), "errors": None}), 200

    dispatch = StoreDispatch(
        tenant_id=store.tenant_id,
        store_id=store.id,
        dispatch_ref=_dispatch_ref(),
        status='dispatched',
        total_qty=0,
        dispatched_at=datetime.utcnow(),
        notes=data.get('notes'),
    )
    db.session.add(dispatch)
    db.session.flush()

    from_wh = _default_warehouse(store.tenant_id, store.company_id)

    total_qty = 0
    lines = []

    for raw in items:
        product_id = raw.get('product_id')
        qty = int(raw.get('qty') or 0)
        if not product_id or qty <= 0:
            db.session.rollback()
            return _error("Each item needs product_id and qty > 0")

        product = Product.query.filter_by(id=product_id, tenant_id=store.tenant_id,
                                          is_deleted=False).first()
        if not product:
            db.session.rollback()
            return _error(f"Product {product_id} not found")
        if (product.current_stock or 0) < qty:
            db.session.rollback()
            return _error(
                f"Insufficient stock for '{product.name}': have "
                f"{(product.current_stock or 0)}, requested {qty}")

        batch_no = None
        mfg_date = None
        expiry_date = None

        if product.is_batch_tracked:
            chosen, unmet = _pick_batch(product, qty)
            if unmet > 0:
                db.session.rollback()
                return _error(f"Insufficient batch stock for '{product.name}' ({unmet} short)")
            for batch, take in chosen:
                batch.quantity = (batch.quantity or 0) - take
                if batch_no is None:
                    batch_no = batch.batch_no
                    mfg_date = batch.mfg_date
                    expiry_date = batch.expiry_date
                db.session.add(batch)

        # reduce ERP stock and record the movement
        product.current_stock = (product.current_stock or 0) - qty
        db.session.add(product)

        ledger = StockLedger(
            tenant_id=store.tenant_id,
            company_id=store.company_id,
            warehouse_id=from_wh.id,
            product_id=product.id,
            batch_id=None,
            quantity_delta=-qty,
            running_balance=product.current_stock,
            type='Transfer',
            reference_type='store_dispatch',
            reference_id=dispatch.id,
            notes=f"Dispatch to store '{store.name}' ({store.code})",
            transaction_date=datetime.utcnow(),
        )
        db.session.add(ledger)

        line = StoreDispatchItem(
            tenant_id=store.tenant_id,
            dispatch_id=dispatch.id,
            product_id=product.id,
            product_name=product.name,
            sku=product.sku,
            qty=qty,
            qty_received=0,
            unit=None,
            batch_no=batch_no,
            mfg_date=mfg_date,
            expiry_date=expiry_date,
            selling_price=product.selling_price,
        )
        db.session.add(line)
        lines.append(line)
        total_qty += qty

    dispatch.total_qty = total_qty
    db.session.add(dispatch)

    # audit header in the standard inventory transfer list
    st = StockTransfer(
        tenant_id=store.tenant_id,
        from_warehouse_id=from_wh.id,
        to_warehouse_id=from_wh.id,  # external store has no warehouse in ERP
        transfer_date=datetime.utcnow(),
        reference_no=dispatch.dispatch_ref,
        status='Transferred',
        notes=f"Restaurant dispatch to '{store.name}'",
    )
    db.session.add(st)

    store.last_sync_at = datetime.utcnow()
    db.session.add(store)
    db.session.commit()

    payload = dispatch.to_dict()
    payload['receivable_lines'] = [{
        'product_id': li.product_id,
        'product_name': li.product_name,
        'sku': li.sku,
        'qty': li.qty,
        'batch_no': li.batch_no,
        'mfg_date': li.mfg_date.isoformat() if li.mfg_date else None,
        'expiry_date': li.expiry_date.isoformat() if li.expiry_date else None,
        'selling_price': float(li.selling_price or 0),
    } for li in lines]

    return jsonify({"data": payload, "errors": None}), 201
@store_bp.route('/dispatches', methods=['GET'])
def store_dispatches():
    """List dispatches sent to this store (for EXE sync)."""
    store = _store_from_request()
    if not store:
        return _error("Invalid or missing X-API-Key", 401)

    status = request.args.get('status')
    q = StoreDispatch.query.filter_by(tenant_id=store.tenant_id,
                                      store_id=store.id, is_deleted=False)
    if status:
        q = q.filter_by(status=status)
    dispatches = q.order_by(StoreDispatch.dispatched_at.desc()).all()
    return jsonify({"data": [d.to_dict() for d in dispatches], "errors": None}), 200


@store_bp.route('/dispatches/<int:dispatch_id>', methods=['GET'])
def store_dispatch_detail(dispatch_id):
    store = _store_from_request()
    if not store:
        return _error("Invalid or missing X-API-Key", 401)
    dispatch = StoreDispatch.query.filter_by(id=dispatch_id, store_id=store.id,
                                             is_deleted=False).first()
    if not dispatch:
        return _error("Dispatch not found", 404)
    return jsonify({"data": dispatch.to_dict(), "errors": None}), 200


@store_bp.route('/dispatches/<int:dispatch_id>/receive', methods=['POST'])
def store_dispatch_receive(dispatch_id):
    """EXE confirms the goods arrived -> dispatch becomes 'received'."""
    store = _store_from_request()
    if not store:
        return _error("Invalid or missing X-API-Key", 401)
    dispatch = StoreDispatch.query.filter_by(id=dispatch_id, store_id=store.id,
                                             is_deleted=False).first()
    if not dispatch:
        return _error("Dispatch not found", 404)

    for line in dispatch.items:
        if line.is_deleted:
            continue
        line.qty_received = line.qty  # full receive; partial can be extended later

    dispatch.status = 'received'
    dispatch.received_at = datetime.utcnow()
    db.session.add(dispatch)
    store.last_sync_at = datetime.utcnow()
    db.session.add(store)
    db.session.commit()
    return jsonify({"data": dispatch.to_dict(), "errors": None}), 200


# ===========================================================================
# ERP-side management (JWT)
# ===========================================================================
@store_bp.route('/channels', methods=['GET'])
@jwt_required()
def list_channels():
    user = _get_current_user()
    if not user:
        return _error("User not found", 404)
    channels = StoreChannel.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({"data": [c.to_dict(include_secret=False) for c in channels], "errors": None}), 200


@store_bp.route('/channels', methods=['POST'])
@jwt_required()
def create_channel():
    user = _get_current_user()
    if not user:
        return _error("User not found", 404)
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return _error("'name' is required")

    code = (data.get('code') or name.upper().replace(' ', '_')[:50])
    api_key = uuid.uuid4().hex + uuid.uuid4().hex

    channel = StoreChannel(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        name=name,
        code=code,
        location=data.get('location'),
        api_key=api_key,
        is_active=True,
    )
    db.session.add(channel)
    db.session.commit()
    return jsonify({"data": channel.to_dict(include_secret=True), "errors": None}), 201


@store_bp.route('/channels/<int:channel_id>/rotate-key', methods=['POST'])
@jwt_required()
def rotate_channel_key(channel_id):
    user = _get_current_user()
    if not user:
        return _error("User not found", 404)
    channel = StoreChannel.query.filter_by(id=channel_id, tenant_id=user.tenant_id,
                                           is_deleted=False).first()
    if not channel:
        return _error("Channel not found", 404)
    channel.api_key = uuid.uuid4().hex + uuid.uuid4().hex
    db.session.add(channel)
    db.session.commit()
    return jsonify({"data": channel.to_dict(include_secret=True), "errors": None}), 200


@store_bp.route('/channels/<int:channel_id>/dispatches', methods=['GET'])
@jwt_required()
def channel_dispatches(channel_id):
    user = _get_current_user()
    if not user:
        return _error("User not found", 404)
    channel = StoreChannel.query.filter_by(id=channel_id, tenant_id=user.tenant_id,
                                           is_deleted=False).first()
    if not channel:
        return _error("Channel not found", 404)
    dispatches = (StoreDispatch.query
                  .filter_by(tenant_id=user.tenant_id, store_id=channel.id, is_deleted=False)
                  .order_by(StoreDispatch.dispatched_at.desc()).all())
    return jsonify({"data": [d.to_dict() for d in dispatches], "errors": None}), 200