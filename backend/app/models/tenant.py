from datetime import datetime
from app.extensions import db
from app.models.base import BaseModel


class Tenant(BaseModel):
    """Platform-level tenant account - a paying customer"""
    __tablename__ = 'tenants'
    
    name = db.Column(db.String(100), nullable=False)
    subdomain = db.Column(db.String(50), unique=True, nullable=False, index=True)
    db_status = db.Column(db.String(20), default='active')  # active, suspended, trial_expired
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    business_type = db.Column(db.String(50), nullable=True)  # From the 20 business types
    website_url = db.Column(db.String(255), nullable=True)
    contact_email = db.Column(db.String(100), nullable=True)
    contact_phone = db.Column(db.String(20), nullable=True)
    
    companies = db.relationship('Company', backref='tenant', lazy='dynamic', cascade="all, delete-orphan")
    subscriptions = db.relationship('Subscription', backref='tenant', lazy='dynamic', cascade="all, delete-orphan")
    licenses = db.relationship('License', backref='tenant', lazy='dynamic', cascade="all, delete-orphan")
    users = db.relationship('User', backref='tenant', lazy='dynamic', cascade="all, delete-orphan")
    payments = db.relationship('Payment', backref='tenant', lazy='dynamic', cascade="all, delete-orphan")
    devices = db.relationship('DeviceRegistry', backref='tenant', lazy='dynamic', cascade="all, delete-orphan")


class SubscriptionPlan(BaseModel):
    """Pricing plans with module/device/user entitlements"""
    __tablename__ = 'subscription_plans'
    
    name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    billing_cycle = db.Column(db.String(20), default='monthly')  # monthly, quarterly, annual
    allowed_modules = db.Column(db.JSON, nullable=True)  # List of enabled module codes
    allowed_devices = db.Column(db.Integer, default=1)
    max_users = db.Column(db.Integer, default=5)
    max_storage_mb = db.Column(db.Integer, default=500)
    max_transactions = db.Column(db.Integer, default=0)  # 0 = unlimited
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    
    subscriptions = db.relationship('Subscription', backref='plan', lazy='dynamic')


class Subscription(BaseModel):
    """Tenant's current subscription - links tenant to a plan with status tracking"""
    __tablename__ = 'subscriptions'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    plan_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('subscription_plans.id'), nullable=False)
    status = db.Column(db.String(20), default='active', index=True)  # active, expired, cancelled, trial
    start_date = db.Column(db.DateTime, nullable=False)
    expiry_date = db.Column(db.DateTime, nullable=False)
    trial_end_date = db.Column(db.DateTime, nullable=True)
    auto_renew = db.Column(db.Boolean, default=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)
    
    licenses = db.relationship('License', backref='subscription', lazy='dynamic')


class License(BaseModel):
    """Device-specific license record - grants a specific device the right to run the ERP"""
    __tablename__ = 'licenses'
    
    license_key = db.Column(db.String(64), unique=True, nullable=False, index=True)
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    device_id = db.Column(db.String(64), nullable=True)  # Device fingerprint
    subscription_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('subscriptions.id'), nullable=True)
    plan_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('subscription_plans.id'), nullable=True)
    modules_json = db.Column(db.JSON, nullable=True)  # Which modules this license enables
    max_bills = db.Column(db.Integer, default=0)  # 0 = unlimited
    issued_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    last_verified_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='active', index=True)  # active, suspended, expired, revoked
    is_trial = db.Column(db.Boolean, default=False)
    
    events = db.relationship('LicenseEvent', backref='license', lazy='dynamic', cascade="all, delete-orphan")


class LicenseEvent(BaseModel):
    """Audit trail of every license activation/suspension/renewal"""
    __tablename__ = 'license_events'
    
    license_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('licenses.id'), nullable=False, index=True)
    event_type = db.Column(db.String(30), nullable=False)  # activated, suspended, renewed, expired, revoked, device_changed
    event_payload = db.Column(db.JSON, nullable=True)
    triggered_by = db.Column(db.String(50), default='system')  # system, admin, customer
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Payment(BaseModel):
    """Payment records for subscriptions/license purchases"""
    __tablename__ = 'payments'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    subscription_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('subscriptions.id'), nullable=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(3), default='INR')
    provider = db.Column(db.String(30), nullable=True)  # razorpay, stripe, paypal
    provider_ref = db.Column(db.String(100), nullable=True)  # Payment gateway reference
    status = db.Column(db.String(20), default='pending', index=True)  # pending, completed, failed, refunded
    payment_method = db.Column(db.String(30), nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)
    receipt_url = db.Column(db.String(255), nullable=True)


class DeviceRegistry(BaseModel):
    """Registered devices for a tenant - used for desktop EXE device control"""
    __tablename__ = 'device_registry'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    device_id = db.Column(db.String(64), unique=True, nullable=False, index=True)
    device_name = db.Column(db.String(100), nullable=True)
    device_type = db.Column(db.String(20), default='desktop')  # desktop, mobile, tablet
    os_info = db.Column(db.String(100), nullable=True)
    app_version = db.Column(db.String(20), nullable=True)
    db_schema_version = db.Column(db.String(20), nullable=True)
    last_sync_at = db.Column(db.DateTime, nullable=True)
    last_ip_address = db.Column(db.String(45), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_locked = db.Column(db.Boolean, default=False, nullable=False)
    locked_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)


class Company(BaseModel):
    """A business entity under a tenant - has its own GST, branches, financial year"""
    __tablename__ = 'companies'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    logo = db.Column(db.String(255), nullable=True)
    address = db.Column(db.Text, nullable=True)
    city = db.Column(db.String(50), nullable=True)
    state = db.Column(db.String(50), nullable=True)
    pincode = db.Column(db.String(10), nullable=True)
    country = db.Column(db.String(50), default='India')
    gstin = db.Column(db.String(15), nullable=True)
    pan = db.Column(db.String(10), nullable=True)
    email = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    website = db.Column(db.String(255), nullable=True)
    currency = db.Column(db.String(3), default='INR')
    financial_year_start_month = db.Column(db.Integer, default=4)  # April
    timezone = db.Column(db.String(50), default='Asia/Kolkata')
    default_language = db.Column(db.String(10), default='en')
    business_type = db.Column(db.String(50), nullable=True)  # From the 20 business types
    is_head_office = db.Column(db.Boolean, default=True)
    
    branches = db.relationship('Branch', backref='company', lazy='dynamic', cascade="all, delete-orphan")
    settings = db.relationship('CompanySetting', backref='company', lazy='dynamic', cascade="all, delete-orphan")
    number_series = db.relationship('NumberSeries', backref='company', lazy='dynamic', cascade="all, delete-orphan")


class Branch(BaseModel):
    """Physical or logical sub-location of a company"""
    __tablename__ = 'branches'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), nullable=True)
    address = db.Column(db.Text, nullable=True)
    city = db.Column(db.String(50), nullable=True)
    state = db.Column(db.String(50), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(100), nullable=True)
    pincode = db.Column(db.String(10), nullable=True)
    is_main = db.Column(db.Boolean, default=False, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)


class CompanySetting(BaseModel):
    """Per-company settings and configuration"""
    __tablename__ = 'company_settings'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=False, index=True)
    setting_key = db.Column(db.String(50), nullable=False)
    setting_value = db.Column(db.Text, nullable=True)
    setting_group = db.Column(db.String(50), nullable=True)


class NumberSeries(BaseModel):
    """Configurable number series per document type, per company"""
    __tablename__ = 'number_series'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=False, index=True)
    document_type = db.Column(db.String(30), nullable=False)  # invoice, quotation, po, challan, receipt
    prefix = db.Column(db.String(10), default='')
    suffix = db.Column(db.String(10), default='')
    starting_number = db.Column(db.Integer, default=1)
    current_number = db.Column(db.Integer, default=1)
    padding = db.Column(db.Integer, default=5)  # Zero-pad to this width
    reset_frequency = db.Column(db.String(10), default='yearly')  # yearly, monthly, never
    is_active = db.Column(db.Boolean, default=True)


class CustomFieldDefinition(BaseModel):
    """Admin-defined custom fields that can be attached to entities"""
    __tablename__ = 'custom_field_definitions'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    entity_type = db.Column(db.String(50), nullable=False, index=True)  # customer, product, employee, invoice
    field_name = db.Column(db.String(50), nullable=False)
    field_type = db.Column(db.String(20), nullable=False)  # text, number, date, dropdown, boolean
    field_options = db.Column(db.JSON, nullable=True)  # For dropdown: list of options
    is_required = db.Column(db.Boolean, default=False)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)


class CustomFieldValue(BaseModel):
    """Values of custom fields attached to specific entity records"""
    __tablename__ = 'custom_field_values'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    field_definition_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('custom_field_definitions.id'), nullable=False)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=False)
    value = db.Column(db.Text, nullable=True)


class CustomFormSection(BaseModel):
    """Hierarchical sections to group custom fields (Form Builder)"""
    __tablename__ = 'custom_form_sections'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    entity_type = db.Column(db.String(50), nullable=False, index=True)  # product, service, rental, amc, customer, invoice
    section_name = db.Column(db.String(100), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    is_collapsed = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    
    fields = db.relationship('CustomFormField', backref='section', lazy='joined', cascade="all, delete-orphan", order_by="CustomFormField.sort_order")

    def to_dict(self):
        data = super().to_dict()
        data['fields'] = [f.to_dict() for f in self.fields if not f.is_deleted]
        return data


class CustomFormField(BaseModel):
    """Form field definitions inside custom form sections"""
    __tablename__ = 'custom_form_fields'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    section_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('custom_form_sections.id'), nullable=False, index=True)
    field_name = db.Column(db.String(100), nullable=False)
    field_key = db.Column(db.String(100), nullable=False)
    field_type = db.Column(db.String(50), nullable=False, default='text')  # text, number, select, multiselect, date, checkbox, textarea
    placeholder = db.Column(db.String(255), nullable=True)
    help_text = db.Column(db.String(255), nullable=True)
    options_json = db.Column(db.JSON, nullable=True)  # List of strings or [{label, value}]
    default_value = db.Column(db.String(255), nullable=True)
    is_required = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    is_static = db.Column(db.Boolean, default=False)  # True for core system fields that cannot be removed
    width = db.Column(db.String(20), default='100%')  # 100%, 50%, 33%, 25%
    sort_order = db.Column(db.Integer, default=0)