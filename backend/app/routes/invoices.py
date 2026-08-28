from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.sales import Invoice, InvoiceItem
from app.models.product import Product
from datetime import datetime
import uuid

invoices_bp = Blueprint('invoices', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))

@invoices_bp.route('', methods=['GET'])
@jwt_required()
def get_invoices():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    query = Invoice.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    
    # Optional search by invoice number
    search = request.args.get('search')
    if search:
        query = query.filter(Invoice.invoice_number.like(f"%{search}%"))
        
    invoices = query.all()
    return jsonify({
        "data": [inv.to_dict() for inv in invoices],
        "meta": {"count": len(invoices)},
        "errors": None
    }), 200

@invoices_bp.route('', methods=['POST'])
@jwt_required()
def create_invoice():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    if not data.get('customer_id'):
        return jsonify({"data": None, "meta": None, "errors": ["Customer is required"]}), 400
        
    if not data.get('items') or len(data.get('items')) == 0:
        return jsonify({"data": None, "meta": None, "errors": ["At least one item is required"]}), 400
        
    # Generate invoice number if not provided
    inv_num = data.get('invoice_number') or f"INV-{uuid.uuid4().hex[:8].upper()}"
    
    # Compute totals
    items_data = data.get('items', [])
    subtotal = 0.00
    discount_amount = 0.00
    cgst_amount = 0.00
    sgst_amount = 0.00
    
    invoice_items = []
    
    for item in items_data:
        prod_id = item.get('product_id')
        qty = parseFloat = float(item.get('qty', 1))
        rate = float(item.get('rate', 0.00))
        disc_pct = float(item.get('discount_percent', 0.00))
        gst_pct = float(item.get('tax_percent', 18.00))
        
        line_amt = qty * rate
        line_disc = (line_amt * disc_pct) / 100
        taxable_amt = line_amt - line_disc
        
        # Split GST into CGST/SGST (9% + 9% for 18% GST)
        line_gst = (taxable_amt * gst_pct) / 100
        line_cgst = line_gst / 2
        line_sgst = line_gst / 2
        line_total = taxable_amt + line_gst
        
        subtotal += line_amt
        discount_amount += line_disc
        cgst_amount += line_cgst
        sgst_amount += line_sgst
        
        inv_item = InvoiceItem(
            tenant_id=user.tenant_id,
            product_id=prod_id,
            description=item.get('description') or item.get('product_name'),
            hsn_code=item.get('hsn_code'),
            quantity=int(qty),
            rate=rate,
            discount_percent=disc_pct,
            discount_amount=line_disc,
            gst_rate=gst_pct,
            cgst_amount=line_cgst,
            sgst_amount=line_sgst,
            total_amount=line_total
        )
        invoice_items.append(inv_item)
                
    total_amount = subtotal - discount_amount + cgst_amount + sgst_amount
    
    from app.services.form_builder_service import extract_custom_fields
    custom_fields = extract_custom_fields('invoice', data)
    if data.get('custom_fields'):
        custom_fields.update(data['custom_fields'])

    invoice = Invoice(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        customer_id=data.get('customer_id'),
        invoice_number=inv_num,
        invoice_date=datetime.utcnow(),
        type=data.get('type', 'Sales'),
        subtotal=subtotal,
        discount_amount=discount_amount,
        cgst_amount=cgst_amount,
        sgst_amount=sgst_amount,
        total_amount=total_amount,
        net_amount=total_amount,
        payment_method=data.get('payment_method', 'Cash'),
        payment_status=data.get('payment_status', 'Paid'),
        is_pos=data.get('is_pos', False),
        notes=data.get('notes'),
        custom_fields=custom_fields
    )
    
    # Save invoice to get ID
    db.session.add(invoice)
    db.session.flush()
    
    # Associate items and perform batch-wise stock deduction
    from app.models.product import ProductBatch, StockLedger
    for item in invoice_items:
        item.invoice_id = invoice.id
        db.session.add(item)
        
        if item.product_id:
            prod = Product.query.filter_by(id=item.product_id, tenant_id=user.tenant_id).first()
            if prod:
                qty = item.quantity
                prod.current_stock = (prod.current_stock or 0) - qty
                db.session.add(prod)
                
                # FEFO: allocate from earliest-expiring batches first
                remaining = qty
                batches = (ProductBatch.query
                           .filter_by(tenant_id=user.tenant_id, product_id=prod.id)
                           .filter(ProductBatch.quantity > 0)
                           .all())
                batches.sort(key=lambda b: (b.expiry_date is None, b.expiry_date or datetime.max, b.id))
                
                for batch in batches:
                    if remaining <= 0:
                        break
                    take = min(int(batch.quantity or 0), remaining)
                    if take <= 0:
                        continue
                    batch.quantity = int(batch.quantity or 0) - take
                    db.session.add(batch)
                    
                    db.session.add(StockLedger(
                        tenant_id=user.tenant_id,
                        company_id=user.company_id,
                        product_id=prod.id,
                        batch_id=batch.id,
                        quantity_delta=-take,
                        running_balance=prod.current_stock,
                        type='Sale',
                        reference_type='invoice',
                        reference_id=invoice.id,
                        rate=batch.purchase_price or 0,
                        notes=f"Invoice {inv_num} dispatch (batch {batch.batch_no})",
                        transaction_date=datetime.utcnow(),
                    ))
                    remaining -= take
                    
                if remaining > 0:
                    db.session.add(StockLedger(
                        tenant_id=user.tenant_id,
                        company_id=user.company_id,
                        product_id=prod.id,
                        quantity_delta=-remaining,
                        running_balance=prod.current_stock,
                        type='Sale',
                        reference_type='invoice',
                        reference_id=invoice.id,
                        notes=f"Invoice {inv_num} (unbatched stock)",
                        transaction_date=datetime.utcnow(),
                    ))
        
    db.session.commit()
    
    return jsonify({"data": invoice.to_dict(), "meta": None, "errors": None}), 201

@invoices_bp.route('/<int:invoice_id>', methods=['GET'])
@jwt_required()
def get_invoice(invoice_id):
    user = get_current_user()
    invoice = Invoice.query.filter_by(id=invoice_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not invoice:
        return jsonify({"data": None, "meta": None, "errors": ["Invoice not found"]}), 404
        
    # Get items
    items = InvoiceItem.query.filter_by(invoice_id=invoice.id, tenant_id=user.tenant_id).all()
    
    invoice_data = invoice.to_dict()
    invoice_data['items'] = [item.to_dict() for item in items]
    
    return jsonify({"data": invoice_data, "meta": None, "errors": None}), 200

@invoices_bp.route('/<int:invoice_id>', methods=['DELETE'])
@jwt_required()
def delete_invoice(invoice_id):
    user = get_current_user()
    invoice = Invoice.query.filter_by(id=invoice_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not invoice:
        return jsonify({"data": None, "meta": None, "errors": ["Invoice not found"]}), 404
        
    invoice.soft_delete()
    return jsonify({"data": {"message": "Invoice deleted successfully"}, "meta": None, "errors": None}), 200
