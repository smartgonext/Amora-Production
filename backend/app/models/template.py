from app.extensions import db
from app.models.base import BaseModel


class TaxSetting(BaseModel):
    """Tax configuration per company"""
    __tablename__ = 'tax_settings'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=False, index=True)
    gst_enabled = db.Column(db.Boolean, default=True)
    cgst_rate = db.Column(db.Numeric(5, 2), default=9.00)
    sgst_rate = db.Column(db.Numeric(5, 2), default=9.00)
    igst_rate = db.Column(db.Numeric(5, 2), default=18.00)
    cess_rate = db.Column(db.Numeric(5, 2), default=0.00)
    default_discount_type = db.Column(db.String(10), default='percentage')  # flat, percentage
    round_off_rule = db.Column(db.String(20), default='nearest')  # nearest, floor, ceil, none
    default_gst_rate = db.Column(db.Numeric(5, 2), default=18.00)


class InvoiceTemplate(BaseModel):
    __tablename__ = 'invoice_templates'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=False)
    name = db.Column(db.String(50), default='Default')
    layout = db.Column(db.String(20), default='A4')  # Thermal58, Thermal80, A4, A5, POS, Custom
    show_logo = db.Column(db.Boolean, default=True)
    show_gst_breakdown = db.Column(db.Boolean, default=True)
    show_terms = db.Column(db.Boolean, default=True)
    show_signature = db.Column(db.Boolean, default=True)
    show_qr_code = db.Column(db.Boolean, default=False)
    header_text = db.Column(db.Text, nullable=True)
    footer_text = db.Column(db.Text, nullable=True)
    template_html = db.Column(db.Text, nullable=True)
    layout_json = db.Column(db.JSON, nullable=True)
    is_default = db.Column(db.Boolean, default=False)


class AgreementTemplate(BaseModel):
    __tablename__ = 'agreement_templates'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=False)
    name = db.Column(db.String(50), default='Default')
    template_html = db.Column(db.Text, nullable=True)
    layout_json = db.Column(db.JSON, nullable=True)
    is_default = db.Column(db.Boolean, default=False)


class ReceiptTemplate(BaseModel):
    __tablename__ = 'receipt_templates'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=False)
    name = db.Column(db.String(50), default='Default')
    template_html = db.Column(db.Text, nullable=True)
    layout_json = db.Column(db.JSON, nullable=True)
    is_default = db.Column(db.Boolean, default=False)


class QuotationTemplate(BaseModel):
    __tablename__ = 'quotation_templates'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=False)
    name = db.Column(db.String(50), default='Default')
    template_html = db.Column(db.Text, nullable=True)
    layout_json = db.Column(db.JSON, nullable=True)
    is_default = db.Column(db.Boolean, default=False)


class PurchaseOrderTemplate(BaseModel):
    __tablename__ = 'purchase_order_templates'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=False)
    name = db.Column(db.String(50), default='Default')
    template_html = db.Column(db.Text, nullable=True)
    layout_json = db.Column(db.JSON, nullable=True)
    is_default = db.Column(db.Boolean, default=False)


class DeliveryChallanTemplate(BaseModel):
    __tablename__ = 'delivery_challan_templates'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=False)
    name = db.Column(db.String(50), default='Default')
    template_html = db.Column(db.Text, nullable=True)
    layout_json = db.Column(db.JSON, nullable=True)
    is_default = db.Column(db.Boolean, default=False)