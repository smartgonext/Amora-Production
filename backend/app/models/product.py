from app.extensions import db
from app.models.base import BaseModel


class ProductCategory(BaseModel):
    __tablename__ = 'product_categories'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    parent_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('product_categories.id'), nullable=True)
    
    products = db.relationship('Product', backref='category', lazy='dynamic')
    children = db.relationship('ProductCategory', backref=db.backref('parent', remote_side='ProductCategory.id'), lazy='dynamic')


class Product(BaseModel):
    __tablename__ = 'products'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    category_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('product_categories.id'), nullable=True)
    brand_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('brands.id'), nullable=True)
    unit_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('units.id'), nullable=True)
    name = db.Column(db.String(150), nullable=False)
    sku = db.Column(db.String(50), nullable=True, index=True)
    hsn_code = db.Column(db.String(20), nullable=True)
    gst_rate = db.Column(db.Numeric(5, 2), default=18.00)
    purchase_price = db.Column(db.Numeric(10, 2), default=0.00)
    selling_price = db.Column(db.Numeric(10, 2), default=0.00)
    wholesale_price = db.Column(db.Numeric(10, 2), default=0.00)
    retail_price = db.Column(db.Numeric(10, 2), default=0.00)
    offer_price = db.Column(db.Numeric(10, 2), default=0.00)
    offer_valid_from = db.Column(db.DateTime, nullable=True)
    offer_valid_to = db.Column(db.DateTime, nullable=True)
    min_stock_level = db.Column(db.Integer, default=5)
    max_stock_level = db.Column(db.Integer, default=0)
    current_stock = db.Column(db.Integer, default=0)
    opening_stock = db.Column(db.Integer, default=0)
    is_serial_tracked = db.Column(db.Boolean, default=False)
    is_batch_tracked = db.Column(db.Boolean, default=False)
    is_service = db.Column(db.Boolean, default=False, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    barcodes = db.relationship('ProductBarcode', backref='product', lazy='dynamic', cascade="all, delete-orphan")
    variants = db.relationship('ProductVariant', backref='product', lazy='dynamic', cascade="all, delete-orphan")
    batches = db.relationship('ProductBatch', backref='product', lazy='dynamic', cascade="all, delete-orphan")
    images = db.relationship('ProductImage', backref='product', lazy='dynamic', cascade="all, delete-orphan")
    ledger_entries = db.relationship('StockLedger', backref='product', lazy='dynamic')


class Brand(BaseModel):
    __tablename__ = 'brands'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    
    products = db.relationship('Product', backref='brand', lazy='dynamic')


class Unit(BaseModel):
    __tablename__ = 'units'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    name = db.Column(db.String(30), nullable=False)  # Pcs, Kg, Meter, Liter, Box
    short_name = db.Column(db.String(10), nullable=False)


class ProductBarcode(BaseModel):
    __tablename__ = 'product_barcodes'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    barcode = db.Column(db.String(50), unique=True, nullable=False, index=True)
    is_primary = db.Column(db.Boolean, default=False)


class ProductImage(BaseModel):
    __tablename__ = 'product_images'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    image_url = db.Column(db.String(255), nullable=False)
    sort_order = db.Column(db.Integer, default=0)


class ProductVariant(BaseModel):
    __tablename__ = 'product_variants'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    variant_name = db.Column(db.String(50), nullable=False)  # e.g., "Red, Large"
    sku = db.Column(db.String(50), nullable=True)
    color = db.Column(db.String(30), nullable=True)
    size = db.Column(db.String(30), nullable=True)
    weight = db.Column(db.Numeric(10, 2), nullable=True)
    purchase_price = db.Column(db.Numeric(10, 2), default=0.00)
    selling_price = db.Column(db.Numeric(10, 2), default=0.00)
    current_stock = db.Column(db.Integer, default=0)


class ProductBatch(BaseModel):
    __tablename__ = 'product_batches'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    batch_no = db.Column(db.String(50), nullable=False)
    expiry_date = db.Column(db.DateTime, nullable=True)
    mfg_date = db.Column(db.DateTime, nullable=True)
    quantity = db.Column(db.Integer, default=0)
    purchase_price = db.Column(db.Numeric(10, 2), default=0.00)


class StockLedger(BaseModel):
    __tablename__ = 'stock_ledger'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    warehouse_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('warehouses.id'), nullable=True)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    batch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('product_batches.id'), nullable=True)
    quantity_delta = db.Column(db.Integer, nullable=False)
    running_balance = db.Column(db.Integer, default=0)
    type = db.Column(db.String(50), nullable=False, index=True)  # Purchase, Sale, Return, Adjustment, Transfer
    reference_type = db.Column(db.String(30), nullable=True)
    reference_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    rate = db.Column(db.Numeric(10, 2), default=0.00)
    notes = db.Column(db.Text, nullable=True)
    transaction_date = db.Column(db.DateTime, nullable=False)


class Warehouse(BaseModel):
    __tablename__ = 'warehouses'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=False, index=True)
    branch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('branches.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)


class StockTransfer(BaseModel):
    __tablename__ = 'stock_transfers'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    from_warehouse_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('warehouses.id'), nullable=False)
    to_warehouse_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('warehouses.id'), nullable=False)
    transfer_date = db.Column(db.DateTime, nullable=False)
    reference_no = db.Column(db.String(50), nullable=True)
    status = db.Column(db.String(20), default='Draft')  # Draft, Transferred, Received, Cancelled
    notes = db.Column(db.Text, nullable=True)


class StockAdjustment(BaseModel):
    __tablename__ = 'stock_adjustments'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    warehouse_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('warehouses.id'), nullable=True)
    adjustment_date = db.Column(db.DateTime, nullable=False)
    reason = db.Column(db.String(100), nullable=False)  # Damaged, Lost, Found, CountingError, Other
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='Draft')  # Draft, Completed, Cancelled


class PurchaseOrder(BaseModel):
    __tablename__ = 'purchase_orders'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    branch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('branches.id'), nullable=True)
    supplier_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('suppliers.id'), nullable=False)
    po_number = db.Column(db.String(50), nullable=False, index=True)
    order_date = db.Column(db.DateTime, nullable=False)
    expected_date = db.Column(db.DateTime, nullable=True)
    subtotal = db.Column(db.Numeric(10, 2), default=0.00)
    discount_amount = db.Column(db.Numeric(10, 2), default=0.00)
    gst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)
    status = db.Column(db.String(20), default='Draft', index=True)  # Draft, Sent, Confirmed, Received, Cancelled
    notes = db.Column(db.Text, nullable=True)
    
    items = db.relationship('PurchaseItem', backref='purchase_order', lazy='dynamic', cascade="all, delete-orphan")


class PurchaseItem(BaseModel):
    __tablename__ = 'purchase_items'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    purchase_order_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('purchase_orders.id'), nullable=False)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    rate = db.Column(db.Numeric(10, 2), nullable=False)
    discount_percent = db.Column(db.Numeric(5, 2), default=0.00)
    discount_amount = db.Column(db.Numeric(10, 2), default=0.00)
    gst_rate = db.Column(db.Numeric(5, 2), default=18.00)
    gst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)


class GoodsReceiptNote(BaseModel):
    """GRN - goods receipt against a purchase order"""
    __tablename__ = 'goods_receipt_notes'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    warehouse_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('warehouses.id'), nullable=True)
    purchase_order_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('purchase_orders.id'), nullable=True)
    grn_number = db.Column(db.String(50), nullable=False, index=True)
    received_date = db.Column(db.DateTime, nullable=False)
    supplier_invoice_no = db.Column(db.String(50), nullable=True)
    supplier_invoice_date = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='Draft')  # Draft, Completed, Cancelled
    
    items = db.relationship('GRNItem', backref='grn', lazy='dynamic', cascade="all, delete-orphan")


class GRNItem(BaseModel):
    __tablename__ = 'grn_items'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    grn_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('goods_receipt_notes.id'), nullable=False)
    purchase_item_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('purchase_items.id'), nullable=True)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    ordered_quantity = db.Column(db.Integer, default=0)
    received_quantity = db.Column(db.Integer, nullable=False)
    accepted_quantity = db.Column(db.Integer, nullable=False)
    rejected_quantity = db.Column(db.Integer, default=0)
    rejection_reason = db.Column(db.String(255), nullable=True)


class PurchaseReturn(BaseModel):
    __tablename__ = 'purchase_returns'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    supplier_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('suppliers.id'), nullable=False)
    purchase_order_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('purchase_orders.id'), nullable=True)
    return_number = db.Column(db.String(50), nullable=False, index=True)
    return_date = db.Column(db.DateTime, nullable=False)
    reason = db.Column(db.String(255), nullable=True)
    subtotal = db.Column(db.Numeric(10, 2), default=0.00)
    gst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)
    status = db.Column(db.String(20), default='Draft')  # Draft, Completed, Cancelled
    
    items = db.relationship('PurchaseReturnItem', backref='purchase_return', lazy='dynamic', cascade="all, delete-orphan")


class PurchaseReturnItem(BaseModel):
    __tablename__ = 'purchase_return_items'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    purchase_return_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('purchase_returns.id'), nullable=False)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    rate = db.Column(db.Numeric(10, 2), nullable=False)
    gst_rate = db.Column(db.Numeric(5, 2), default=18.00)
    gst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)