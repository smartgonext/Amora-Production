from app.extensions import db
from app.models.base import BaseModel


class Quotation(BaseModel):
    """Sales quotation - convertible to sales order or invoice"""
    __tablename__ = 'quotations'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    branch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('branches.id'), nullable=True)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=False)
    quotation_number = db.Column(db.String(50), nullable=False, index=True)
    quotation_date = db.Column(db.DateTime, nullable=False)
    valid_until = db.Column(db.DateTime, nullable=True)
    subtotal = db.Column(db.Numeric(10, 2), default=0.00)
    discount_amount = db.Column(db.Numeric(10, 2), default=0.00)
    discount_percent = db.Column(db.Numeric(5, 2), default=0.00)
    cgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    sgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    igst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)
    status = db.Column(db.String(20), default='Draft', index=True)  # Draft, Sent, Accepted, Rejected, Converted
    notes = db.Column(db.Text, nullable=True)
    terms_conditions = db.Column(db.Text, nullable=True)
    converted_to_invoice_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    converted_to_sales_order_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    
    items = db.relationship('QuotationItem', backref='quotation', lazy='dynamic', cascade="all, delete-orphan")


class QuotationItem(BaseModel):
    __tablename__ = 'quotation_items'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    quotation_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('quotations.id'), nullable=False)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=True)
    description = db.Column(db.String(255), nullable=True)
    quantity = db.Column(db.Integer, default=1)
    rate = db.Column(db.Numeric(10, 2), nullable=False)
    discount_percent = db.Column(db.Numeric(5, 2), default=0.00)
    discount_amount = db.Column(db.Numeric(10, 2), default=0.00)
    gst_rate = db.Column(db.Numeric(5, 2), default=18.00)
    cgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    sgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)

    def to_dict(self):
        data = super().to_dict()
        if self.product_id:
            from app.models.product import Product
            prod = Product.query.get(self.product_id)
            if prod:
                data['product_name'] = prod.name
                data['unit'] = getattr(prod.unit, 'short_name', 'Nos') if getattr(prod, 'unit', None) else 'Nos'
                data['product'] = prod.to_dict()
        data['unit_price'] = float(self.rate or 0)
        data['line_total'] = float(self.total_amount or 0)
        return data


class SalesOrder(BaseModel):
    """Sales order - confirmed order from customer"""
    __tablename__ = 'sales_orders'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    branch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('branches.id'), nullable=True)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=False)
    order_number = db.Column(db.String(50), nullable=False, index=True)
    order_date = db.Column(db.DateTime, nullable=False)
    delivery_date = db.Column(db.DateTime, nullable=True)
    subtotal = db.Column(db.Numeric(10, 2), default=0.00)
    discount_amount = db.Column(db.Numeric(10, 2), default=0.00)
    cgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    sgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    igst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)
    status = db.Column(db.String(20), default='Pending', index=True)  # Pending, Confirmed, Processing, Shipped, Delivered, Cancelled
    notes = db.Column(db.Text, nullable=True)
    
    items = db.relationship('SalesOrderItem', backref='sales_order', lazy='dynamic', cascade="all, delete-orphan")


class SalesOrderItem(BaseModel):
    __tablename__ = 'sales_order_items'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    sales_order_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('sales_orders.id'), nullable=False)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=True)
    description = db.Column(db.String(255), nullable=True)
    quantity = db.Column(db.Integer, default=1)
    rate = db.Column(db.Numeric(10, 2), nullable=False)
    gst_rate = db.Column(db.Numeric(5, 2), default=18.00)
    cgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    sgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)

    def to_dict(self):
        data = super().to_dict()
        if self.product_id:
            from app.models.product import Product
            prod = Product.query.get(self.product_id)
            if prod:
                data['product_name'] = prod.name
                data['unit'] = getattr(prod.unit, 'short_name', 'Nos') if getattr(prod, 'unit', None) else 'Nos'
                data['product'] = prod.to_dict()
        data['unit_price'] = float(self.rate or 0)
        data['line_total'] = float(self.total_amount or 0)
        return data


class Invoice(BaseModel):
    """Sales invoice - GST compliant"""
    __tablename__ = 'invoices'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    branch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('branches.id'), nullable=True)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=False)
    invoice_number = db.Column(db.String(50), nullable=False, index=True)
    invoice_date = db.Column(db.DateTime, nullable=False)
    due_date = db.Column(db.DateTime, nullable=True)
    type = db.Column(db.String(30), nullable=False, index=True)  # Sales, Rental, AMC, Repair, Service
    subtotal = db.Column(db.Numeric(10, 2), default=0.00)
    discount_amount = db.Column(db.Numeric(10, 2), default=0.00)
    discount_percent = db.Column(db.Numeric(5, 2), default=0.00)
    cgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    sgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    igst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    cess_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)
    round_off = db.Column(db.Numeric(10, 2), default=0.00)
    net_amount = db.Column(db.Numeric(10, 2), default=0.00)
    payment_method = db.Column(db.String(30), default='Cash')  # Cash, Card, UPI, Credit, BankTransfer, Cheque
    payment_status = db.Column(db.String(20), default='Unpaid', index=True)  # Paid, Partial, Unpaid, Overdue
    outstanding_balance = db.Column(db.Numeric(10, 2), default=0.00)
    notes = db.Column(db.Text, nullable=True)
    terms_conditions = db.Column(db.Text, nullable=True)
    is_pos = db.Column(db.Boolean, default=False)
    custom_fields = db.Column(db.JSON, nullable=True)
    
    items = db.relationship('InvoiceItem', backref='invoice', lazy='dynamic', cascade="all, delete-orphan")
    receipts = db.relationship('ReceiptAllocation', backref='invoice', lazy='dynamic', cascade="all, delete-orphan")

    def to_dict(self):
        data = super().to_dict()
        data['tax_amount'] = float(self.cgst_amount or 0) + float(self.sgst_amount or 0) + float(self.igst_amount or 0)
        data['status'] = data.get('status') or self.payment_status or 'Paid'
        
        # Serialize customer details
        if self.customer_id:
            from app.models.customer import Customer
            cust = Customer.query.get(self.customer_id)
            if cust:
                data['customer_name'] = cust.name
                data['customer'] = cust.to_dict()
            else:
                data['customer_name'] = 'Walk-in Customer'
        else:
            data['customer_name'] = 'Walk-in Customer'

        data['items'] = [item.to_dict() for item in self.items]
        if self.custom_fields and isinstance(self.custom_fields, dict):
            data.update(self.custom_fields)
        return data


class InvoiceItem(BaseModel):
    __tablename__ = 'invoice_items'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    invoice_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('invoices.id'), nullable=False)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=True)
    description = db.Column(db.String(255), nullable=True)
    hsn_code = db.Column(db.String(20), nullable=True)
    quantity = db.Column(db.Integer, default=1)
    rate = db.Column(db.Numeric(10, 2), nullable=False)
    discount_percent = db.Column(db.Numeric(5, 2), default=0.00)
    discount_amount = db.Column(db.Numeric(10, 2), default=0.00)
    gst_rate = db.Column(db.Numeric(5, 2), default=18.00)
    cgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    sgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)

    def to_dict(self):
        data = super().to_dict()
        if self.product_id:
            from app.models.product import Product
            prod = Product.query.get(self.product_id)
            if prod:
                data['product_name'] = prod.name
                data['unit'] = getattr(prod.unit, 'short_name', 'Nos') if getattr(prod, 'unit', None) else 'Nos'
                data['product'] = prod.to_dict()
        data['unit_price'] = float(self.rate or 0)
        data['line_total'] = float(self.total_amount or 0)
        return data


class POSSession(BaseModel):
    """Point of Sale session tracking"""
    __tablename__ = 'pos_sessions'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    branch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('branches.id'), nullable=True)
    user_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=False)
    opened_at = db.Column(db.DateTime, nullable=False)
    closed_at = db.Column(db.DateTime, nullable=True)
    opening_balance = db.Column(db.Numeric(10, 2), default=0.00)
    closing_balance = db.Column(db.Numeric(10, 2), default=0.00)
    total_sales = db.Column(db.Numeric(10, 2), default=0.00)
    total_cash = db.Column(db.Numeric(10, 2), default=0.00)
    total_card = db.Column(db.Numeric(10, 2), default=0.00)
    total_upi = db.Column(db.Numeric(10, 2), default=0.00)
    invoice_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='Open', index=True)  # Open, Closed


class SalesReturn(BaseModel):
    """Sales return / credit note"""
    __tablename__ = 'sales_returns'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=False)
    invoice_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('invoices.id'), nullable=True)
    return_number = db.Column(db.String(50), nullable=False, index=True)
    return_date = db.Column(db.DateTime, nullable=False)
    reason = db.Column(db.String(255), nullable=True)
    subtotal = db.Column(db.Numeric(10, 2), default=0.00)
    cgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    sgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    igst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)
    status = db.Column(db.String(20), default='Draft', index=True)  # Draft, Completed, Cancelled
    
    items = db.relationship('SalesReturnItem', backref='sales_return', lazy='dynamic', cascade="all, delete-orphan")


class SalesReturnItem(BaseModel):
    __tablename__ = 'sales_return_items'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    sales_return_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('sales_returns.id'), nullable=False)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    rate = db.Column(db.Numeric(10, 2), nullable=False)
    gst_rate = db.Column(db.Numeric(5, 2), default=18.00)
    cgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    sgst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)

    def to_dict(self):
        data = super().to_dict()
        if self.product_id:
            from app.models.product import Product
            prod = Product.query.get(self.product_id)
            if prod:
                data['product_name'] = prod.name
                data['unit'] = getattr(prod.unit, 'short_name', 'Nos') if getattr(prod, 'unit', None) else 'Nos'
                data['product'] = prod.to_dict()
        data['unit_price'] = float(self.rate or 0)
        data['line_total'] = float(self.total_amount or 0)
        return data


class DeliveryChallan(BaseModel):
    """Delivery challan - for goods delivery without invoice (samples, transfers)"""
    __tablename__ = 'delivery_challans'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    branch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('branches.id'), nullable=True)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=False)
    challan_number = db.Column(db.String(50), nullable=False, index=True)
    challan_date = db.Column(db.DateTime, nullable=False)
    delivery_address = db.Column(db.Text, nullable=True)
    vehicle_number = db.Column(db.String(20), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='Draft', index=True)  # Draft, Delivered, Cancelled
    linked_invoice_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    
    items = db.relationship('DeliveryChallanItem', backref='delivery_challan', lazy='dynamic', cascade="all, delete-orphan")


class DeliveryChallanItem(BaseModel):
    __tablename__ = 'delivery_challan_items'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    challan_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('delivery_challans.id'), nullable=False)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    description = db.Column(db.String(255), nullable=True)


class Receipt(BaseModel):
    """Payment receipt - records money received from customer"""
    __tablename__ = 'receipts'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=False)
    receipt_number = db.Column(db.String(50), nullable=False, index=True)
    receipt_date = db.Column(db.DateTime, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_method = db.Column(db.String(30), default='Cash')  # Cash, Card, UPI, BankTransfer, Cheque
    reference_no = db.Column(db.String(50), nullable=True)  # Cheque no, transaction ID
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='Active', index=True)  # Active, Cancelled
    
    allocations = db.relationship('ReceiptAllocation', backref='receipt', lazy='dynamic', cascade="all, delete-orphan")


class ReceiptAllocation(BaseModel):
    """Links a receipt to specific invoices it pays down"""
    __tablename__ = 'receipt_allocations'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    receipt_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('receipts.id'), nullable=False)
    invoice_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('invoices.id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)