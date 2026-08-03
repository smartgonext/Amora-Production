from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.product import (
    PurchaseOrder, PurchaseItem, Product, 
    GoodsReceiptNote, GRNItem, PurchaseReturn, PurchaseReturnItem
)
from datetime import datetime
import uuid

purchases_bp = Blueprint('purchases', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))

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
        
    purchases = query.all()
    return jsonify({
        "data": [po.to_dict() for po in purchases],
        "meta": {"count": len(purchases)},
        "errors": None
    }), 200

@purchases_bp.route('', methods=['POST'])
@jwt_required()
def create_purchase():
    user = get_current_user()
    data = request.get_json() or {}
    po_num = data.get('po_number') or f"PO-{uuid.uuid4().hex[:8].upper()}"
    
    po = PurchaseOrder(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        supplier_id=data.get('supplier_id'),
        po_number=po_num,
        order_date=datetime.utcnow(),
        total_amount=data.get('total_amount', 0.00),
        status=data.get('status', 'Received'),
        notes=data.get('notes'),
        is_active=True
    )
    db.session.add(po)
    db.session.commit()
    return jsonify({"data": po.to_dict(), "errors": None}), 201

# --- Goods Receipt Notes (GRN) Endpoints ---
@purchases_bp.route('/grn', methods=['GET'])
@jwt_required()
def get_grns():
    user = get_current_user()
    grns = GoodsReceiptNote.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(GoodsReceiptNote.received_date.desc()).all()
    return jsonify({"data": [g.to_dict() for g in grns], "errors": None}), 200

@purchases_bp.route('/grn', methods=['POST'])
@jwt_required()
def create_grn():
    user = get_current_user()
    data = request.get_json() or {}
    grn_num = data.get('grn_number') or f"GRN-{uuid.uuid4().hex[:8].upper()}"
    
    grn = GoodsReceiptNote(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        purchase_order_id=data.get('purchase_order_id'),
        grn_number=grn_num,
        received_date=datetime.utcnow(),
        notes=data.get('notes'),
        status='Completed'
    )
    db.session.add(grn)
    db.session.commit()
    return jsonify({"data": grn.to_dict(), "errors": None}), 201

# --- Purchase Returns Endpoints ---
@purchases_bp.route('/returns', methods=['GET'])
@jwt_required()
def get_returns():
    user = get_current_user()
    returns = PurchaseReturn.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(PurchaseReturn.return_date.desc()).all()
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
