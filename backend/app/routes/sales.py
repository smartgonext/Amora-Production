from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.sales import (
    Quotation, QuotationItem, SalesOrder, SalesOrderItem, 
    SalesReturn, SalesReturnItem, DeliveryChallan, DeliveryChallanItem,
    Receipt, ReceiptAllocation, Invoice, InvoiceItem
)
from app.models.product import Product, ProductBatch, StockLedger
from datetime import datetime
import uuid

sales_bp = Blueprint('sales', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))

# --- Quotations Endpoints ---
@sales_bp.route('/quotations', methods=['GET'])
@jwt_required()
def get_quotations():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "errors": ["User not found"]}), 404
    quotes = Quotation.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(Quotation.quotation_date.desc()).all()
    return jsonify({"data": [q.to_dict() for q in quotes], "errors": None}), 200

@sales_bp.route('/quotations/<int:quotation_id>', methods=['GET'])
@jwt_required()
def get_quotation(quotation_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "errors": ["User not found"]}), 404
    quote = Quotation.query.filter_by(id=quotation_id, tenant_id=user.tenant_id, is_deleted=False).first()
    if not quote:
        return jsonify({"data": None, "errors": ["Quotation not found"]}), 404
        
    items = QuotationItem.query.filter_by(quotation_id=quote.id, tenant_id=user.tenant_id).all()
    quote_data = quote.to_dict()
    quote_data['items'] = [item.to_dict() for item in items]
    return jsonify({"data": quote_data, "errors": None}), 200

@sales_bp.route('/quotations', methods=['POST'])
@jwt_required()
def create_quotation():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "errors": ["User not found"]}), 404
    data = request.get_json() or {}
    
    q_num = data.get('quotation_number') or f"QT-{uuid.uuid4().hex[:8].upper()}"
    items_data = data.get('items', [])
    
    subtotal = 0.00
    cgst_amount = 0.00
    sgst_amount = 0.00
    discount_amount = 0.00
    
    quote_items = []
    
    for item in items_data:
        prod_id = item.get('product_id')
        qty = float(item.get('qty', 1))
        rate = float(item.get('rate', 0.00))
        disc_pct = float(item.get('discount_percent', 0.00))
        gst_pct = float(item.get('tax_percent', 18.00))
        
        line_amt = qty * rate
        line_disc = (line_amt * disc_pct) / 100
        taxable_amt = line_amt - line_disc
        
        line_gst = (taxable_amt * gst_pct) / 100
        line_cgst = line_gst / 2
        line_sgst = line_gst / 2
        line_total = taxable_amt + line_gst
        
        subtotal += line_amt
        discount_amount += line_disc
        cgst_amount += line_cgst
        sgst_amount += line_sgst
        
        q_item = QuotationItem(
            tenant_id=user.tenant_id,
            product_id=prod_id,
            description=item.get('description') or item.get('product_name'),
            quantity=int(qty),
            rate=rate,
            discount_percent=disc_pct,
            discount_amount=line_disc,
            gst_rate=gst_pct,
            cgst_amount=line_cgst,
            sgst_amount=line_sgst,
            total_amount=line_total
        )
        quote_items.append(q_item)
        
    total_amount = subtotal - discount_amount + cgst_amount + sgst_amount
    
    quote = Quotation(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        customer_id=data.get('customer_id'),
        quotation_number=q_num,
        quotation_date=datetime.utcnow(),
        subtotal=subtotal,
        discount_amount=discount_amount,
        cgst_amount=cgst_amount,
        sgst_amount=sgst_amount,
        total_amount=total_amount,
        status='Sent',
        notes=data.get('notes')
    )
    
    db.session.add(quote)
    db.session.flush()
    
    for item in quote_items:
        item.quotation_id = quote.id
        db.session.add(item)
        
    db.session.commit()
    return jsonify({"data": quote.to_dict(), "errors": None}), 201

# --- Sales Orders Endpoints ---
@sales_bp.route('/orders', methods=['GET'])
@jwt_required()
def get_sales_orders():
    user = get_current_user()
    orders = SalesOrder.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(SalesOrder.order_date.desc()).all()
    return jsonify({"data": [o.to_dict() for o in orders], "errors": None}), 200

@sales_bp.route('/orders', methods=['POST'])
@jwt_required()
def create_sales_order():
    user = get_current_user()
    data = request.get_json() or {}
    o_num = data.get('order_number') or f"SO-{uuid.uuid4().hex[:8].upper()}"
    order = SalesOrder(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        customer_id=data.get('customer_id'),
        order_number=o_num,
        order_date=datetime.utcnow(),
        subtotal=data.get('subtotal', 0.00),
        total_amount=data.get('total_amount', 0.00),
        status='Confirmed'
    )
    db.session.add(order)
    db.session.commit()
    return jsonify({"data": order.to_dict(), "errors": None}), 201

# --- Delivery Challans Endpoints ---
@sales_bp.route('/challans', methods=['GET'])
@jwt_required()
def get_challans():
    user = get_current_user()
    challans = DeliveryChallan.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(DeliveryChallan.challan_date.desc()).all()
    return jsonify({"data": [c.to_dict() for c in challans], "errors": None}), 200

@sales_bp.route('/challans', methods=['POST'])
@jwt_required()
def create_challan():
    user = get_current_user()
    data = request.get_json() or {}
    c_num = data.get('challan_number') or f"DC-{uuid.uuid4().hex[:8].upper()}"
    challan = DeliveryChallan(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        customer_id=data.get('customer_id'),
        challan_number=c_num,
        challan_date=datetime.utcnow(),
        delivery_address=data.get('delivery_address'),
        vehicle_number=data.get('vehicle_number'),
        status='Delivered'
    )
    db.session.add(challan)
    db.session.commit()
    return jsonify({"data": challan.to_dict(), "errors": None}), 201

# --- Sales Returns Endpoints ---
@sales_bp.route('/returns', methods=['GET'])
@jwt_required()
def get_returns():
    user = get_current_user()
    returns = SalesReturn.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(SalesReturn.return_date.desc()).all()
    return jsonify({"data": [r.to_dict() for r in returns], "errors": None}), 200

@sales_bp.route('/returns', methods=['POST'])
@jwt_required()
def create_return():
    user = get_current_user()
    data = request.get_json() or {}
    r_num = data.get('return_number') or f"SR-{uuid.uuid4().hex[:8].upper()}"
    s_return = SalesReturn(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        customer_id=data.get('customer_id'),
        invoice_id=data.get('invoice_id'),
        return_number=r_num,
        return_date=datetime.utcnow(),
        reason=data.get('reason'),
        total_amount=data.get('total_amount', 0.00),
        status='Completed'
    )
    db.session.add(s_return)
    db.session.commit()
    return jsonify({"data": s_return.to_dict(), "errors": None}), 201

# --- Receipts & Allocations Endpoints ---
@sales_bp.route('/receipts', methods=['GET'])
@jwt_required()
def get_receipts():
    user = get_current_user()
    receipts = Receipt.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(Receipt.receipt_date.desc()).all()
    return jsonify({"data": [r.to_dict() for r in receipts], "errors": None}), 200

@sales_bp.route('/receipts', methods=['POST'])
@jwt_required()
def create_receipt():
    user = get_current_user()
    data = request.get_json() or {}
    r_num = data.get('receipt_number') or f"REC-{uuid.uuid4().hex[:8].upper()}"
    receipt = Receipt(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        customer_id=data.get('customer_id'),
        receipt_number=r_num,
        receipt_date=datetime.utcnow(),
        amount=data.get('amount', 0.00),
        payment_method=data.get('payment_method', 'Cash'),
        reference_no=data.get('reference_no'),
        notes=data.get('notes'),
        status='Active'
    )
    db.session.add(receipt)
    db.session.flush()

    # Allocate payment to open invoices
    for allocation in data.get('allocations', []):
        alloc = ReceiptAllocation(
            tenant_id=user.tenant_id,
            receipt_id=receipt.id,
            invoice_id=allocation.get('invoice_id'),
            amount=allocation.get('amount', 0.00)
        )
        db.session.add(alloc)

        # Update invoice outstanding balance
        inv = Invoice.query.filter_by(id=allocation.get('invoice_id'), tenant_id=user.tenant_id).first()
        if inv:
            inv.outstanding_balance = float(inv.outstanding_balance or inv.total_amount) - float(allocation.get('amount', 0.00))
            if inv.outstanding_balance <= 0:
                inv.payment_status = 'Paid'
                inv.outstanding_balance = 0
            else:
                inv.payment_status = 'Partial'
            db.session.add(inv)

    db.session.commit()
    return jsonify({"data": receipt.to_dict(), "errors": None}), 201


# ---------------------------------------------------------------------------
# Quotation → Invoice conversion (finished-goods stock deduction w/ batch)
# ---------------------------------------------------------------------------
def _sell_finished_stock(tenant_id, company_id, product_id, qty, invoice_id, invoice_number):
    """Deduct sold finished-product stock with FIFO (FEFO) batch allocation.

    Every deduction posts a StockLedger 'Sale' movement referencing the invoice
    so the whole movement is traceable to its source transaction.
    """
    qty = int(qty)
    if qty <= 0:
        return
    product = Product.query.filter_by(id=int(product_id), tenant_id=tenant_id).first()
    if not product or int(product.current_stock or 0) < qty:
        raise ValueError(
            f"Insufficient finished stock for product #{product_id} "
            f"(available {int(product.current_stock or 0)}, required {qty})"
        )

    product.current_stock = int(product.current_stock or 0) - qty
    db.session.add(product)

    remaining = qty
    # FEFO: allocate from earliest-expiring batches first, then oldest.
    batches = (ProductBatch.query
               .filter_by(tenant_id=tenant_id, product_id=int(product_id))
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
            tenant_id=tenant_id,
            company_id=company_id,
            product_id=int(product_id),
            batch_id=batch.id,
            quantity_delta=-take,
            running_balance=int(product.current_stock or 0),
            type='Sale',
            reference_type='invoice',
            reference_id=invoice_id,
            rate=batch.purchase_price or 0,
            notes=f"Invoice {invoice_number} dispatch (batch {batch.batch_no})",
            transaction_date=datetime.utcnow(),
        ))
        remaining -= take

    if remaining > 0:
        # No batch rows left (un-tracked / opened stock) — log the remainder.
        db.session.add(StockLedger(
            tenant_id=tenant_id,
            company_id=company_id,
            product_id=int(product_id),
            quantity_delta=-remaining,
            running_balance=int(product.current_stock or 0),
            type='Sale',
            reference_type='invoice',
            reference_id=invoice_id,
            notes=f"Invoice {invoice_number} (unbatched stock)",
            transaction_date=datetime.utcnow(),
        ))


@sales_bp.route('/quotations/<int:quotation_id>/convert-to-invoice', methods=['POST'])
@jwt_required()
def convert_quotation_to_invoice(quotation_id):
    """Convert a saved quotation into a GST invoice without re-entering data.

    Carries forward customer, product, qty, rate, tax and totals from the
    quotation, marks the quotation as Converted and deducts finished-product
    stock (with batch allocation) when the sale is dispatched/confirmed.
    """
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "errors": ["User not found"]}), 404

    quote = Quotation.query.filter_by(
        id=int(quotation_id), tenant_id=user.tenant_id, is_deleted=False).first()
    if not quote:
        return jsonify({"data": None, "errors": ["Quotation not found"]}), 404
    if quote.converted_to_invoice_id:
        return jsonify({
            "data": None,
            "errors": [f"Already converted (invoice #{quote.converted_to_invoice_id})"],
        }), 400

    items = QuotationItem.query.filter_by(
        quotation_id=quote.id, tenant_id=user.tenant_id, is_deleted=False).all()
    if not items:
        return jsonify({"data": None, "errors": ["Quotation has no items"]}), 400

    data = request.get_json() or {}
    inv_num = data.get('invoice_number') or f"INV-{uuid.uuid4().hex[:8].upper()}"
    payment_method = data.get('payment_method') or 'Credit'
    payment_status = data.get('payment_status') or 'Unpaid'
    net_amount = float(data.get('net_amount') or quote.total_amount or 0)

    invoice = Invoice(
        tenant_id=user.tenant_id,
        company_id=data.get('company_id') or quote.company_id,
        branch_id=quote.branch_id,
        customer_id=quote.customer_id,
        invoice_number=inv_num,
        invoice_date=datetime.utcnow(),
        type='Sales',
        subtotal=quote.subtotal,
        discount_amount=quote.discount_amount,
        discount_percent=quote.discount_percent,
        cgst_amount=quote.cgst_amount,
        sgst_amount=quote.sgst_amount,
        igst_amount=quote.igst_amount,
        total_amount=quote.total_amount,
        net_amount=net_amount,
        payment_method=payment_method,
        payment_status=payment_status,
        outstanding_balance=net_amount if payment_status != 'Paid' else 0,
        notes=quote.notes,
        terms_conditions=quote.terms_conditions,
        is_pos=False,
    )
    db.session.add(invoice)
    db.session.flush()

    for item in items:
        db.session.add(InvoiceItem(
            tenant_id=user.tenant_id,
            invoice_id=invoice.id,
            product_id=item.product_id,
            description=item.description,
            hsn_code=_hsn_code(user.tenant_id, item.product_id),
            quantity=item.quantity,
            rate=item.rate,
            discount_percent=item.discount_percent,
            discount_amount=item.discount_amount,
            gst_rate=item.gst_rate,
            cgst_amount=item.cgst_amount,
            sgst_amount=item.sgst_amount,
            total_amount=item.total_amount,
        ))
        # Dispatch/confirm — deduct finished stock for trackable products.
        if item.product_id:
            _sell_finished_stock(user.tenant_id, user.company_id,
                                 item.product_id, item.quantity,
                                 invoice.id, inv_num)

    quote.status = 'Converted'
    quote.converted_to_invoice_id = invoice.id
    db.session.add(quote)
    db.session.commit()

    invoice_data = invoice.to_dict()
    invoice_data['items'] = [i.to_dict() for i in InvoiceItem.query
                             .filter_by(invoice_id=invoice.id).all()]
    return jsonify({"data": invoice_data, "errors": None}), 201


def _hsn_code(tenant_id, product_id):
    """Best-effort HSN lookup for an invoice line (may be None)."""
    if not product_id:
        return None
    prod = db.session.get(Product, int(product_id))
    return getattr(prod, 'hsn_code', None) if prod else None
