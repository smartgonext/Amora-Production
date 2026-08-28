from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.product import (
    Warehouse, StockTransfer, StockAdjustment, StockLedger, Product
)
from datetime import datetime

inventory_bp = Blueprint('inventory', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))

# --- Warehouse Endpoints ---
@inventory_bp.route('/warehouses', methods=['GET'])
@jwt_required()
def get_warehouses():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "errors": ["User not found"]}), 404
    warehouses = Warehouse.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({"data": [w.to_dict() for w in warehouses], "errors": None}), 200

@inventory_bp.route('/warehouses', methods=['POST'])
@jwt_required()
def create_warehouse():
    user = get_current_user()
    data = request.get_json() or {}
    wh = Warehouse(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        name=data.get('name'),
        location=data.get('location'),
        is_active=True
    )
    db.session.add(wh)
    db.session.commit()
    return jsonify({"data": wh.to_dict(), "errors": None}), 201

# --- Stock Transfers Endpoints ---
@inventory_bp.route('/transfers', methods=['GET'])
@jwt_required()
def get_transfers():
    user = get_current_user()
    transfers = StockTransfer.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(StockTransfer.transfer_date.desc()).all()
    return jsonify({"data": [t.to_dict() for t in transfers], "errors": None}), 200

@inventory_bp.route('/transfers', methods=['POST'])
@jwt_required()
def create_transfer():
    user = get_current_user()
    data = request.get_json() or {}
    
    # Simple transfer logging
    transfer = StockTransfer(
        tenant_id=user.tenant_id,
        from_warehouse_id=data.get('from_warehouse_id'),
        to_warehouse_id=data.get('to_warehouse_id'),
        transfer_date=datetime.utcnow(),
        reference_no=data.get('reference_no'),
        status='Transferred',
        notes=data.get('notes')
    )
    db.session.add(transfer)
    
    # Adjust stock if product and quantity provided
    prod_id = data.get('product_id')
    qty = int(data.get('qty', 0))
    if prod_id and qty > 0:
        prod = Product.query.filter_by(id=prod_id, tenant_id=user.tenant_id).first()
        if prod:
            # For simplicity, log in StockLedger
            ledger_out = StockLedger(
                tenant_id=user.tenant_id,
                company_id=user.company_id,
                warehouse_id=data.get('from_warehouse_id'),
                product_id=prod_id,
                quantity_delta=-qty,
                type='Transfer',
                transaction_date=datetime.utcnow(),
                notes=f"Transfer out to WH #{data.get('to_warehouse_id')}"
            )
            ledger_in = StockLedger(
                tenant_id=user.tenant_id,
                company_id=user.company_id,
                warehouse_id=data.get('to_warehouse_id'),
                product_id=prod_id,
                quantity_delta=qty,
                type='Transfer',
                transaction_date=datetime.utcnow(),
                notes=f"Transfer in from WH #{data.get('from_warehouse_id')}"
            )
            db.session.add(ledger_out)
            db.session.add(ledger_in)
            
    db.session.commit()
    return jsonify({"data": transfer.to_dict(), "errors": None}), 201

# --- Stock Adjustments Endpoints ---
@inventory_bp.route('/adjustments', methods=['GET'])
@jwt_required()
def get_adjustments():
    user = get_current_user()
    adjusts = StockAdjustment.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(StockAdjustment.adjustment_date.desc()).all()
    return jsonify({"data": [a.to_dict() for a in adjusts], "errors": None}), 200

@inventory_bp.route('/adjustments', methods=['POST'])
@jwt_required()
def create_adjustment():
    user = get_current_user()
    data = request.get_json() or {}
    
    adjust = StockAdjustment(
        tenant_id=user.tenant_id,
        warehouse_id=data.get('warehouse_id'),
        adjustment_date=datetime.utcnow(),
        reason=data.get('reason'),
        notes=data.get('notes'),
        status='Completed'
    )
    db.session.add(adjust)
    
    # Update inventory stock levels
    prod_id = data.get('product_id')
    qty_delta = int(data.get('qty_delta', 0))
    if prod_id and qty_delta != 0:
        prod = Product.query.filter_by(id=prod_id, tenant_id=user.tenant_id).first()
        if prod:
            prod.current_stock = (prod.current_stock or 0) + qty_delta
            db.session.add(prod)
            
            ledger = StockLedger(
                tenant_id=user.tenant_id,
                company_id=user.company_id,
                warehouse_id=data.get('warehouse_id'),
                product_id=prod_id,
                quantity_delta=qty_delta,
                running_balance=prod.current_stock,
                type='Adjustment',
                transaction_date=datetime.utcnow(),
                notes=data.get('reason')
            )
            db.session.add(ledger)
            
    db.session.commit()
    return jsonify({"data": adjust.to_dict(), "errors": None}), 201

# --- Stock Ledger Movements Endpoints ---
@inventory_bp.route('/ledger', methods=['GET'])
@jwt_required()
def get_stock_ledger():
    user = get_current_user()
    product_id = request.args.get('product_id')
    query = StockLedger.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    if product_id:
        query = query.filter_by(product_id=int(product_id))
    movements = query.order_by(StockLedger.transaction_date.desc()).all()
    return jsonify({"data": [m.to_dict() for m in movements], "errors": None}), 200
