from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.product import Product

products_bp = Blueprint('products', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))

@products_bp.route('', methods=['GET'])
@jwt_required()
def get_products():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    query = Product.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    
    # Optional search query
    search = request.args.get('search')
    if search:
        query = query.filter(
            (Product.name.like(f"%{search}%")) |
            (Product.sku.like(f"%{search}%"))
        )
        
    products = query.all()
    return jsonify({
        "data": [p.to_dict() for p in products],
        "meta": {"count": len(products)},
        "errors": None
    }), 200

@products_bp.route('', methods=['POST'])
@jwt_required()
def create_product():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    if not data.get('name'):
        return jsonify({"data": None, "meta": None, "errors": ["Name is required"]}), 400
        
    product = Product(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        name=data.get('name'),
        sku=data.get('sku'),
        hsn_code=data.get('hsn_code'),
        gst_rate=data.get('gst_rate', 18.00),
        purchase_price=data.get('purchase_price', 0.00),
        selling_price=data.get('selling_price', 0.00),
        min_stock_level=data.get('min_stock_level', 5),
        opening_stock=data.get('opening_stock', 0),
        current_stock=data.get('opening_stock', 0),
        is_service=bool(data.get('is_service', False)),
        is_active=data.get('is_active', True),
        description=data.get('description')
    )
    
    db.session.add(product)
    db.session.commit()
    
    return jsonify({"data": product.to_dict(), "meta": None, "errors": None}), 201

@products_bp.route('/<int:product_id>', methods=['GET'])
@jwt_required()
def get_product(product_id):
    user = get_current_user()
    product = Product.query.filter_by(id=product_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not product:
        return jsonify({"data": None, "meta": None, "errors": ["Product not found"]}), 404
        
    return jsonify({"data": product.to_dict(), "meta": None, "errors": None}), 200

@products_bp.route('/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    user = get_current_user()
    product = Product.query.filter_by(id=product_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not product:
        return jsonify({"data": None, "meta": None, "errors": ["Product not found"]}), 404
        
    data = request.get_json() or {}
    
    for field in ['name', 'sku', 'hsn_code', 'gst_rate', 'purchase_price', 'selling_price', 'min_stock_level', 'is_service', 'is_active', 'description', 'current_stock', 'opening_stock']:
        if field in data:
            setattr(product, field, data[field])
            
    db.session.add(product)
    db.session.commit()
    
    return jsonify({"data": product.to_dict(), "meta": None, "errors": None}), 200

@products_bp.route('/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    user = get_current_user()
    product = Product.query.filter_by(id=product_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not product:
        return jsonify({"data": None, "meta": None, "errors": ["Product not found"]}), 404
        
    product.soft_delete()
    return jsonify({"data": {"message": "Product deleted successfully"}, "meta": None, "errors": None}), 200
