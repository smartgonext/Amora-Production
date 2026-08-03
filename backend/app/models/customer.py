from app.extensions import db
from app.models.base import BaseModel


class Customer(BaseModel):
    """Customer profile with full financial and loyalty tracking"""
    __tablename__ = 'customers'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False, index=True)
    email = db.Column(db.String(100), nullable=True)
    address = db.Column(db.Text, nullable=True)
    city = db.Column(db.String(50), nullable=True)
    state = db.Column(db.String(50), nullable=True)
    pincode = db.Column(db.String(10), nullable=True)
    gstin = db.Column(db.String(15), nullable=True)
    pan = db.Column(db.String(10), nullable=True)
    credit_limit = db.Column(db.Numeric(10, 2), default=0.00)
    credit_period_days = db.Column(db.Integer, default=0)
    wallet_balance = db.Column(db.Numeric(10, 2), default=0.00)
    total_purchases = db.Column(db.Numeric(12, 2), default=0.00)
    purchase_count = db.Column(db.Integer, default=0)
    last_purchase_date = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    ledger_entries = db.relationship('CustomerLedger', backref='customer', lazy='dynamic', cascade="all, delete-orphan")
    invoices = db.relationship('Invoice', backref='customer', lazy='dynamic')
    documents = db.relationship('CustomerDocument', backref='customer', lazy='dynamic', cascade="all, delete-orphan")


class CustomerDocument(BaseModel):
    """Uploaded KYC and other documents for a customer"""
    __tablename__ = 'customer_documents'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=False)
    document_type = db.Column(db.String(30), nullable=False)  # aadhar, pan, gst_certificate, agreement, other
    document_name = db.Column(db.String(100), nullable=False)
    file_url = db.Column(db.String(255), nullable=False)
    uploaded_at = db.Column(db.DateTime, nullable=False)
    notes = db.Column(db.Text, nullable=True)


class CustomerLedger(BaseModel):
    """Running ledger for customer - tracks all debits and credits"""
    __tablename__ = 'customer_ledger'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=False, index=True)
    transaction_date = db.Column(db.DateTime, nullable=False)
    type = db.Column(db.String(10), nullable=False)  # Debit (due), Credit (paid)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    reference_type = db.Column(db.String(30), nullable=True)  # invoice, receipt, payment, credit_note, debit_note
    reference_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    description = db.Column(db.String(255), nullable=True)
    running_balance = db.Column(db.Numeric(10, 2), nullable=False)


class Supplier(BaseModel):
    """Supplier profile with bank details and purchase tracking"""
    __tablename__ = 'suppliers'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(100), nullable=True)
    address = db.Column(db.Text, nullable=True)
    city = db.Column(db.String(50), nullable=True)
    state = db.Column(db.String(50), nullable=True)
    pincode = db.Column(db.String(10), nullable=True)
    gstin = db.Column(db.String(15), nullable=True)
    contact_person = db.Column(db.String(100), nullable=True)
    bank_name = db.Column(db.String(100), nullable=True)
    bank_account_no = db.Column(db.String(50), nullable=True)
    bank_ifsc = db.Column(db.String(20), nullable=True)
    payment_terms = db.Column(db.String(50), nullable=True)
    credit_limit = db.Column(db.Numeric(10, 2), default=0.00)
    total_purchases = db.Column(db.Numeric(12, 2), default=0.00)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    purchase_orders = db.relationship('PurchaseOrder', backref='supplier', lazy='dynamic')
    ledger_entries = db.relationship('SupplierLedger', backref='supplier', lazy='dynamic', cascade="all, delete-orphan")
    documents = db.relationship('SupplierDocument', backref='supplier', lazy='dynamic', cascade="all, delete-orphan")


class SupplierDocument(BaseModel):
    """Uploaded documents for a supplier"""
    __tablename__ = 'supplier_documents'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    supplier_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('suppliers.id'), nullable=False)
    document_type = db.Column(db.String(30), nullable=False)
    document_name = db.Column(db.String(100), nullable=False)
    file_url = db.Column(db.String(255), nullable=False)
    uploaded_at = db.Column(db.DateTime, nullable=False)


class SupplierLedger(BaseModel):
    """Running ledger for supplier - tracks bills and payments"""
    __tablename__ = 'supplier_ledger'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    supplier_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('suppliers.id'), nullable=False, index=True)
    transaction_date = db.Column(db.DateTime, nullable=False)
    type = db.Column(db.String(10), nullable=False)  # Debit (paid), Credit (due)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    reference_type = db.Column(db.String(30), nullable=True)  # purchase, payment, debit_note, credit_note
    reference_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    description = db.Column(db.String(255), nullable=True)
    running_balance = db.Column(db.Numeric(10, 2), nullable=False)