from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.customer import Customer
from app.models.product import Product
from app.models.sales import Invoice

search_bp = Blueprint('search', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))

@search_bp.route('', methods=['GET'])
@jwt_required()
def global_search():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404

    q = request.args.get('q', '').strip()
    if len(q) < 2:
        return jsonify({
            "data": {
                "customers": [],
                "products": [],
                "invoices": []
            },
            "errors": None
        }), 200

    # Search Customers
    customers = Customer.query.filter(
        Customer.tenant_id == user.tenant_id,
        Customer.is_deleted == False,
        (Customer.name.like(f"%{q}%")) |
        (Customer.phone.like(f"%{q}%")) |
        (Customer.email.like(f"%{q}%"))
    ).limit(10).all()

    # Search Products
    products = Product.query.filter(
        Product.tenant_id == user.tenant_id,
        Product.is_deleted == False,
        (Product.name.like(f"%{q}%")) |
        (Product.sku.like(f"%{q}%")) |
        (Product.hsn_code.like(f"%{q}%"))
    ).limit(10).all()

    # Search Invoices
    invoices = Invoice.query.filter(
        Invoice.tenant_id == user.tenant_id,
        Invoice.is_deleted == False,
        (Invoice.invoice_number.like(f"%{q}%")) |
        (Invoice.notes.like(f"%{q}%"))
    ).limit(10).all()

    return jsonify({
        "data": {
            "customers": [{
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "email": c.email,
                "type": "customer"
            } for c in customers],
            "products": [{
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "selling_price": float(p.selling_price or 0),
                "type": "product"
            } for p in products],
            "invoices": [{
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "total_amount": float(inv.total_amount or 0),
                "type": "invoice"
            } for inv in invoices]
        },
        "errors": None
    }), 200
