from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.product import (
    PurchaseOrder, PurchaseItem, Product, 
    GoodsReceiptNote, GRNItem, PurchaseReturn, PurchaseReturnItem
)
from app.services.grn_service import create_grn as create_grn_record, get_grn as get_grn_record
from datetime import datetime
from decimal import Decimal
import uuid

purchases_bp = Blueprint('purchases', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))

@purchases_bp.route('', methods=['GET'])
@jwt_required()
def get_purchases():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    query = PurchaseOrder.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    search = request.args.get('search')
    if search:
        query = query.filter(PurchaseOrder.po_number.like(f"%{search}%"))
        
    is_mfg = request.args.get('is_mfg')
    if is_mfg:
        if is_mfg.lower() == 'true':
            query = query.filter(PurchaseOrder.items.any(PurchaseItem.product_id.in_(
                db.session.query(Product.id).filter_by(tenant_id=user.tenant_id, is_raw_material=True)
            )))
        elif is_mfg.lower() == 'false':
            query = query.filter(~PurchaseOrder.items.any(PurchaseItem.product_id.in_(
                db.session.query(Product.id).filter_by(tenant_id=user.tenant_id, is_raw_material=True)
            )))
            
    purchases = query.all()
    return jsonify({
        "data": [po.to_dict() for po in purchases],
        "meta": {"count": len(purchases)},
        "errors": None
    }), 200

@purchases_bp.route('', methods=['POST'])
@jwt_required()
def create_purchase():
    """Create a Purchase Order and persist every raw-material line item.

    Each PurchaseOrder / PurchaseItem preserves the rate, GST and quantity as of
    that transaction so historical purchase prices are never overwritten. The
    applying cost for production is resolved later from the GRN / raw-material
    batch (see manufacturing_service.raw_material_rate).
    """
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "errors": ["User not found"]}), 404
    data = request.get_json() or {}
    if not data.get('supplier_id'):
        return jsonify({"data": None, "errors": ["Supplier is required"]}), 400

    po_num = data.get('po_number') or f"PO-{uuid.uuid4().hex[:8].upper()}"
    order_date = datetime.utcnow()
    expected_date = None
    if data.get('expected_date'):
        try:
            expected_date = datetime.fromisoformat(str(data['expected_date']))
        except Exception:
            expected_date = None

    items_data = data.get('items') or []
    subtotal = Decimal(data.get('subtotal') or 0)
    discount_amount = Decimal(data.get('discount_amount') or 0)
    gst_amount = Decimal(data.get('gst_amount') or 0)

    for item in items_data:
        qty = Decimal(str(item.get('quantity') or item.get('qty') or 1))
        rate = Decimal(str(item.get('unit_price') if item.get('unit_price') is not None
                           else item.get('rate') or 0))
        disc_pct = Decimal(str(item.get('discount_percent') or 0))
        gst_pct = Decimal(str(item.get('gst_rate') if item.get('gst_rate') is not None
                              else item.get('tax_percent') or 0))
        subtotal += qty * rate
        discount_amount += qty * rate * disc_pct / 100
        gst_amount += (qty * rate - qty * rate * disc_pct / 100) * gst_pct / 100

    total_amount = subtotal - discount_amount + gst_amount

    po = PurchaseOrder(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        branch_id=data.get('branch_id'),
        supplier_id=data.get('supplier_id'),
        po_number=po_num,
        order_date=order_date,
        expected_date=expected_date,
        subtotal=subtotal,
        discount_amount=discount_amount,
        gst_amount=gst_amount,
        total_amount=float(total_amount),
        status=data.get('status', 'Draft'),
        notes=data.get('notes'),
        is_active=True
    )
    db.session.add(po)
    db.session.flush()

    created_items = []
    for item in items_data:
        product_id = item.get('product_id') or item.get('item_id')
        if not product_id:
            continue
        qty = Decimal(str(item.get('quantity') or item.get('qty') or 1))
        rate = Decimal(str(item.get('unit_price') if item.get('unit_price') is not None
                           else item.get('rate') or 0))
        disc_pct = Decimal(str(item.get('discount_percent') or 0))
        gst_pct = Decimal(str(item.get('gst_rate') if item.get('gst_rate') is not None
                              else item.get('tax_percent') or 0))
        disc_amt = qty * rate * disc_pct / 100
        taxable = qty * rate - disc_amt
        gst_amt = taxable * gst_pct / 100
        line_total = taxable + gst_amt

        line = PurchaseItem(
            tenant_id=user.tenant_id,
            purchase_order_id=po.id,
            product_id=int(product_id),
            quantity=int(qty),
            rate=rate,
            discount_percent=disc_pct,
            discount_amount=disc_amt,
            gst_rate=gst_pct,
            gst_amount=gst_amt,
            total_amount=line_total,
        )
        db.session.add(line)
        created_items.append(line)

    db.session.commit()

    po_data = po.to_dict()
    po_data['items'] = [i.to_dict() for i in created_items]
    return jsonify({"data": po_data, "errors": None}), 201

# --- Goods Receipt Notes (GRN) Endpoints ---
@purchases_bp.route('/grn', methods=['GET'])
@jwt_required()
def get_grns():
    user = get_current_user()
    query = GoodsReceiptNote.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    
    is_mfg = request.args.get('is_mfg')
    if is_mfg:
        if is_mfg.lower() == 'true':
            query = query.filter(GoodsReceiptNote.items.any(GRNItem.product_id.in_(
                db.session.query(Product.id).filter_by(tenant_id=user.tenant_id, is_raw_material=True)
            )))
        elif is_mfg.lower() == 'false':
            query = query.filter(~GoodsReceiptNote.items.any(GRNItem.product_id.in_(
                db.session.query(Product.id).filter_by(tenant_id=user.tenant_id, is_raw_material=True)
            )))
            
    grns = query.order_by(GoodsReceiptNote.received_date.desc()).all()
    return jsonify({"data": [g.to_dict() for g in grns], "errors": None}), 200

@purchases_bp.route('/grn', methods=['POST'])
@jwt_required()
def create_grn():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "errors": ["User not found"]}), 404
    try:
        grn = create_grn_record(user.tenant_id, user.company_id, request.get_json() or {})
    except ValueError as e:
        return jsonify({"data": None, "errors": [str(e)]}), 400
    return jsonify({"data": grn.to_dict(), "errors": None}), 201

@purchases_bp.route('/grn/<int:grn_id>', methods=['GET'])
@jwt_required()
def get_grn_detail(grn_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "errors": ["User not found"]}), 404
    grn_data = get_grn_record(user.tenant_id, grn_id)
    if grn_data is None:
        return jsonify({"data": None, "errors": ["GRN not found"]}), 404
    return jsonify({"data": grn_data, "errors": None}), 200

# --- Purchase Returns Endpoints ---
@purchases_bp.route('/returns', methods=['GET'])
@jwt_required()
def get_returns():
    user = get_current_user()
    query = PurchaseReturn.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    
    is_mfg = request.args.get('is_mfg')
    if is_mfg:
        if is_mfg.lower() == 'true':
            query = query.filter(PurchaseReturn.items.any(PurchaseReturnItem.product_id.in_(
                db.session.query(Product.id).filter_by(tenant_id=user.tenant_id, is_raw_material=True)
            )))
        elif is_mfg.lower() == 'false':
            query = query.filter(~PurchaseReturn.items.any(PurchaseReturnItem.product_id.in_(
                db.session.query(Product.id).filter_by(tenant_id=user.tenant_id, is_raw_material=True)
            )))
            
    returns = query.order_by(PurchaseReturn.return_date.desc()).all()
    return jsonify({"data": [r.to_dict() for r in returns], "errors": None}), 200

@purchases_bp.route('/returns', methods=['POST'])
@jwt_required()
def create_return():
    user = get_current_user()
    data = request.get_json() or {}
    ret_num = data.get('return_number') or f"PR-{uuid.uuid4().hex[:8].upper()}"
    
    ret = PurchaseReturn(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        supplier_id=data.get('supplier_id'),
        purchase_order_id=data.get('purchase_order_id'),
        return_number=ret_num,
        return_date=datetime.utcnow(),
        reason=data.get('reason'),
        total_amount=data.get('total_amount', 0.00),
        status='Completed'
    )
    db.session.add(ret)
    db.session.flush()
    
    product_id = data.get('product_id')
    if product_id:
        qty = int(data.get('quantity') or 1)
        rate = Decimal(str(data.get('rate') or 0.00))
        ret_item = PurchaseReturnItem(
            tenant_id=user.tenant_id,
            purchase_return_id=ret.id,
            product_id=product_id,
            quantity=qty,
            rate=rate,
            total_amount=ret.total_amount
        )
        db.session.add(ret_item)
        
    db.session.commit()
    return jsonify({"data": ret.to_dict(), "errors": None}), 201

@purchases_bp.route('/<int:po_id>', methods=['GET'])
@jwt_required()
def get_purchase(po_id):
    user = get_current_user()
    po = PurchaseOrder.query.filter_by(id=po_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not po:
        return jsonify({"data": None, "errors": ["Purchase order not found"]}), 404
        
    items = PurchaseItem.query.filter_by(purchase_order_id=po.id, tenant_id=user.tenant_id).all()
    po_data = po.to_dict()
    po_data['items'] = [item.to_dict() for item in items]
    return jsonify({"data": po_data, "errors": None}), 200

@purchases_bp.route('/<int:po_id>', methods=['DELETE'])
@jwt_required()
def delete_purchase(po_id):
    user = get_current_user()
    po = PurchaseOrder.query.filter_by(id=po_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not po:
        return jsonify({"data": None, "errors": ["Purchase order not found"]}), 404
    po.soft_delete()
    return jsonify({"data": {"message": "Purchase order deleted successfully"}, "errors": None}), 200
