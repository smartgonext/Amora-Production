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
from app.models.audit import Notification
from app.models.product import Product, ProductBatch, StockLedger, StockTransfer, Warehouse
from app.models.restaurant_store import (
    StoreChannel, StoreDispatch, StoreDispatchItem, StoreCakeOrder, StoreSyncedProduct
)

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


# ===========================================================================
# Cake Orders Integration Endpoints (Restaurant MainPOS <-> Bakery ERP)
# ===========================================================================

@store_bp.route('/cake-orders', methods=['POST'])
def receive_cake_order():
    """Receive a Cake Order booked in Restaurant MainPOS with advance payment."""
    store = _store_from_request()
    if not store:
        return _error("Invalid or missing X-API-Key", 401)

    payload = request.get_json() or {}
    order_num = payload.get('order_number') or f"CK-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    
    deliv_date_raw = payload.get('delivery_date')
    if not deliv_date_raw:
        return _error("delivery_date is required", 400)
    try:
        deliv_date = datetime.strptime(str(deliv_date_raw)[:10], '%Y-%m-%d').date()
    except Exception:
        deliv_date = datetime.utcnow().date()

    total_price = float(payload.get('total_price') or 0.0)
    advance_paid = float(payload.get('advance_paid') or 0.0)
    balance_amount = float(payload.get('balance_amount') if payload.get('balance_amount') is not None else (total_price - advance_paid))

    cake_order = StoreCakeOrder.query.filter_by(order_number=order_num).first()
    if not cake_order:
        cake_order = StoreCakeOrder(
            tenant_id=store.tenant_id,
            company_id=store.company_id,
            store_id=store.id,
            order_number=order_num,
            status='NEW_ORDER'
        )
        db.session.add(cake_order)

    cake_order.restaurant_order_id = payload.get('restaurant_order_id') or payload.get('id')
    cake_order.customer_name = payload.get('customer_name') or 'Customer'
    cake_order.customer_phone = payload.get('customer_phone') or ''
    cake_order.delivery_date = deliv_date
    cake_order.delivery_time = str(payload.get('delivery_time') or '17:00')
    cake_order.flavor = payload.get('cake_flavor') or payload.get('flavor') or 'Custom Flavor'
    cake_order.weight_kg = float(payload.get('weight_kg') or payload.get('weight') or 1.0)
    cake_order.shape = payload.get('cake_shape') or payload.get('shape') or 'Round'
    cake_order.is_eggless = bool(payload.get('is_eggless', False))
    cake_order.tier_count = int(payload.get('tier_count') or 1)
    cake_order.message_on_cake = payload.get('message_on_cake') or ''
    cake_order.notes = payload.get('special_instructions') or payload.get('notes') or ''
    cake_order.photo_url = payload.get('photo_url') or ''
    cake_order.total_price = total_price
    cake_order.advance_paid = advance_paid
    cake_order.balance_amount = balance_amount
    cake_order.advance_payment_mode = payload.get('advance_payment_mode') or 'Cash'
    if not cake_order.status or cake_order.status in ['DELIVERED', 'CANCELLED']:
        cake_order.status = payload.get('status') or 'NEW_ORDER'

    # Trigger ERP notification
    try:
        notif = Notification(
            tenant_id=store.tenant_id,
            company_id=store.company_id,
            title=f"🎂 New Cake Order: {order_num}",
            message=f"{cake_order.flavor} ({cake_order.weight_kg}kg) for {cake_order.customer_name}. Due on {deliv_date} at {cake_order.delivery_time}. Advance: Rs.{advance_paid:.2f}",
            type="cake_order",
            reference_id=cake_order.id
        )
        db.session.add(notif)
    except Exception:
        pass

    db.session.commit()
    return jsonify({"data": cake_order.to_dict(), "errors": None}), 201


@store_bp.route('/cake-orders', methods=['GET'])
def list_cake_orders():
    """List cake orders. Accessible by both ERP users (JWT) and Store (X-API-Key)."""
    user = None
    store = None
    
    # Try store auth first
    key = (request.headers.get(API_KEY_HEADER) or '').strip()
    if key:
        store = StoreChannel.query.filter_by(api_key=key, is_active=True, is_deleted=False).first()
    
    # Try JWT if no store key
    if not store:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            from flask_jwt_extended import decode_token
            try:
                decoded = decode_token(auth_header.split(' ')[1])
                user = db.session.get(User, int(decoded['sub']))
            except Exception:
                pass

    if not store and not user:
        return _error("Authentication required (X-API-Key or Bearer Token)", 401)

    tenant_id = store.tenant_id if store else user.tenant_id
    query = StoreCakeOrder.query.filter_by(tenant_id=tenant_id, is_deleted=False)
    
    if store:
        query = query.filter_by(store_id=store.id)
    
    # Optional filters
    status = request.args.get('status')
    if status:
        if status.upper() == 'ACTIVE':
            query = query.filter(StoreCakeOrder.status.notin_(['DELIVERED', 'CANCELLED']))
        else:
            query = query.filter(StoreCakeOrder.status == status.upper())

    date_str = request.args.get('delivery_date') or request.args.get('date')
    if date_str:
        try:
            target_date = datetime.strptime(date_str[:10], '%Y-%m-%d').date()
            query = query.filter(StoreCakeOrder.delivery_date == target_date)
        except Exception:
            pass

    search = request.args.get('search')
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (StoreCakeOrder.order_number.like(search_filter)) |
            (StoreCakeOrder.customer_name.like(search_filter)) |
            (StoreCakeOrder.customer_phone.like(search_filter))
        )

    orders = query.order_by(StoreCakeOrder.delivery_date.asc(), StoreCakeOrder.created_at.desc()).all()
    return jsonify({
        "data": [o.to_dict() for o in orders],
        "meta": {"count": len(orders)},
        "errors": None
    }), 200


@store_bp.route('/cake-orders/<int:order_id>/status', methods=['PUT'])
def update_cake_order_status(order_id):
    """Update production or dispatch status of a cake order."""
    store = _store_from_request()
    user = None
    if not store:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            from flask_jwt_extended import decode_token
            try:
                decoded = decode_token(auth_header.split(' ')[1])
                user = db.session.get(User, int(decoded['sub']))
            except Exception:
                pass

    if not store and not user:
        return _error("Authentication required", 401)

    tenant_id = store.tenant_id if store else user.tenant_id
    order = StoreCakeOrder.query.filter_by(id=order_id, tenant_id=tenant_id, is_deleted=False).first()
    if not order:
        return _error("Cake order not found", 404)

    payload = request.get_json() or {}
    new_status = payload.get('status')
    if new_status:
        order.status = str(new_status).upper()

    if 'balance_payment_mode' in payload:
        order.balance_payment_mode = payload['balance_payment_mode']
    if 'bill_number' in payload:
        order.bill_number = payload['bill_number']
    if 'notes' in payload:
        order.notes = payload['notes']

    db.session.add(order)
    db.session.commit()
    return jsonify({"data": order.to_dict(), "errors": None}), 200


@store_bp.route('/cake-orders/<string:order_ref>/delivered', methods=['POST'])
def mark_cake_delivered(order_ref):
    """Mark cake as delivered and settled upon final bill generation in MainPOS."""
    store = _store_from_request()
    if not store:
        return _error("Invalid X-API-Key", 401)

    order = StoreCakeOrder.query.filter_by(
        tenant_id=store.tenant_id,
        is_deleted=False
    ).filter(
        (StoreCakeOrder.order_number == order_ref) | 
        (StoreCakeOrder.id == (int(order_ref) if order_ref.isdigit() else -1))
    ).first()

    if not order:
        return _error("Cake order not found", 404)

    payload = request.get_json() or {}
    order.status = 'DELIVERED'
    order.balance_amount = 0.0
    if payload.get('bill_number'):
        order.bill_number = payload['bill_number']
    if payload.get('balance_payment_mode'):
        order.balance_payment_mode = payload['balance_payment_mode']

    db.session.add(order)
    db.session.commit()
    return jsonify({"data": order.to_dict(), "errors": None}), 200


@store_bp.route('/cake-orders/summary', methods=['GET'])
def cake_orders_summary():
    """Summary metrics for notifications badge & audio chime."""
    store = _store_from_request()
    user = None
    if not store:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            from flask_jwt_extended import decode_token
            try:
                decoded = decode_token(auth_header.split(' ')[1])
                user = db.session.get(User, int(decoded['sub']))
            except Exception:
                pass

    if not store and not user:
        return _error("Authentication required", 401)

    tenant_id = store.tenant_id if store else user.tenant_id
    today = datetime.utcnow().date()
    
    new_count = StoreCakeOrder.query.filter_by(tenant_id=tenant_id, status='NEW_ORDER', is_deleted=False).count()
    due_today = StoreCakeOrder.query.filter(
        StoreCakeOrder.tenant_id == tenant_id,
        StoreCakeOrder.delivery_date == today,
        StoreCakeOrder.status.notin_(['DELIVERED', 'CANCELLED']),
        StoreCakeOrder.is_deleted == False
    ).count()

    return jsonify({
        "data": {
            "new_orders_count": new_count,
            "due_today_count": due_today,
            "has_new_alert": new_count > 0
        },
        "errors": None
    }), 200


# ===========================================================================
# Restaurant Products Catalog Sync (Own Barcode + KOT Puffs/Momos)
# ===========================================================================

@store_bp.route('/sync-restaurant-catalog', methods=['POST'])
def sync_restaurant_catalog():
    """Ingest restaurant products (own-barcode retail goods + KOT production snacks) into ERP."""
    store = _store_from_request()
    if not store:
        return _error("Invalid X-API-Key", 401)

    payload = request.get_json() or {}
    items = payload.get('items') or []
    if not items:
        return _error("items array is required", 400)

    upserted_count = 0
    now = datetime.utcnow()

    for itm in items:
        rest_item_id = itm.get('id') or itm.get('restaurant_item_id')
        if not rest_item_id:
            continue

        name = itm.get('name') or f"Restaurant Item #{rest_item_id}"
        sku = itm.get('sku') or ''
        barcode = itm.get('barcode') or itm.get('productQR') or sku or ''
        category_name = itm.get('category_name') or itm.get('category') or 'General'
        is_kot = bool(itm.get('is_kot_item') or itm.get('isKOTEnabled') or False)
        cost_price = float(itm.get('cost_price') or itm.get('costPerUnit') or 0.0)
        selling_price = float(itm.get('selling_price') or itm.get('price') or 0.0)
        restaurant_stock = float(itm.get('restaurant_stock') or itm.get('currentStock') or 0.0)

        existing = StoreSyncedProduct.query.filter_by(
            store_id=store.id,
            restaurant_item_id=str(rest_item_id)
        ).first()

        if existing:
            existing.name = name
            existing.sku = sku
            existing.barcode = barcode
            existing.category_name = category_name
            existing.is_kot_item = is_kot
            existing.cost_price = cost_price
            existing.selling_price = selling_price
            existing.restaurant_stock = restaurant_stock
            existing.last_synced_at = now
            existing.is_deleted = False
        else:
            new_synced = StoreSyncedProduct(
                tenant_id=store.tenant_id,
                store_id=store.id,
                restaurant_item_id=str(rest_item_id),
                name=name,
                sku=sku,
                barcode=barcode,
                category_name=category_name,
                is_kot_item=is_kot,
                cost_price=cost_price,
                selling_price=selling_price,
                restaurant_stock=restaurant_stock,
                last_synced_at=now
            )
            db.session.add(new_synced)
        upserted_count += 1

    db.session.commit()
    return jsonify({
        "data": {
            "upserted_count": upserted_count,
            "store_id": store.id,
            "store_name": store.name
        },
        "errors": None
    }), 200


@store_bp.route('/synced-products', methods=['GET'])
def list_synced_products():
    """List synced restaurant items in ERP with side-by-side stock levels."""
    tenant_id = None
    key = (request.headers.get(API_KEY_HEADER) or '').strip()
    if key:
        store = StoreChannel.query.filter_by(api_key=key, is_active=True, is_deleted=False).first()
        if store:
            tenant_id = store.tenant_id

    if not tenant_id:
        try:
            from flask_jwt_extended import verify_jwt_in_request
            verify_jwt_in_request()
            user = _get_current_user()
            if user:
                tenant_id = user.tenant_id
        except Exception:
            pass

    if not tenant_id:
        return _error("Authentication required", 401)

    query = StoreSyncedProduct.query.filter_by(tenant_id=tenant_id, is_deleted=False)
    
    store_id = request.args.get('store_id')
    if store_id:
        query = query.filter_by(store_id=int(store_id))

    is_kot = request.args.get('is_kot')
    if is_kot in ('1', 'true', 'yes'):
        query = query.filter_by(is_kot_item=True)
    elif is_kot in ('0', 'false', 'no'):
        query = query.filter_by(is_kot_item=False)

    search = request.args.get('search')
    if search:
        s = f"%{search}%"
        query = query.filter(
            (StoreSyncedProduct.name.like(s)) |
            (StoreSyncedProduct.barcode.like(s)) |
            (StoreSyncedProduct.category_name.like(s))
        )

    products = query.order_by(StoreSyncedProduct.category_name.asc(), StoreSyncedProduct.name.asc()).all()
    return jsonify({
        "data": [p.to_dict() for p in products],
        "meta": {"count": len(products)},
        "errors": None
    }), 200
