from app.extensions import db
from app.models.base import BaseModel


class Equipment(BaseModel):
    """Equipment registry for rental businesses (cranes, forklifts, etc.)"""
    __tablename__ = 'equipment'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # Crane, Forklift, Excavator, etc.
    model_number = db.Column(db.String(50), nullable=True)
    ton_capacity = db.Column(db.Numeric(10, 2), nullable=True)
    serial_number = db.Column(db.String(50), nullable=True, index=True)
    registration_number = db.Column(db.String(50), nullable=True)
    rental_status = db.Column(db.String(20), default='Available', index=True)  # Available, Rented, Maintenance, Retired
    purchase_date = db.Column(db.DateTime, nullable=True)
    purchase_price = db.Column(db.Numeric(10, 2), default=0.00)
    last_service_date = db.Column(db.DateTime, nullable=True)
    next_service_date = db.Column(db.DateTime, nullable=True)
    min_hourly_rate = db.Column(db.Numeric(10, 2), default=0.00)
    min_daily_rate = db.Column(db.Numeric(10, 2), default=0.00)
    min_weekly_rate = db.Column(db.Numeric(10, 2), default=0.00)
    min_monthly_rate = db.Column(db.Numeric(10, 2), default=0.00)
    insurance_expiry = db.Column(db.DateTime, nullable=True)
    fitness_expiry = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    
    bookings = db.relationship('RentalBooking', backref='equipment', lazy='dynamic')
    documents = db.relationship('EquipmentDocument', backref='equipment', lazy='dynamic', cascade="all, delete-orphan")
    service_history = db.relationship('EquipmentServiceHistory', backref='equipment', lazy='dynamic', cascade="all, delete-orphan")


class EquipmentDocument(BaseModel):
    """RC, insurance, fitness certificate documents for equipment"""
    __tablename__ = 'equipment_documents'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    equipment_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('equipment.id'), nullable=False)
    document_type = db.Column(db.String(30), nullable=False)  # rc, insurance, fitness, pollution, other
    document_name = db.Column(db.String(100), nullable=False)
    file_url = db.Column(db.String(255), nullable=False)
    expiry_date = db.Column(db.DateTime, nullable=True)
    uploaded_at = db.Column(db.DateTime, nullable=False)


class EquipmentServiceHistory(BaseModel):
    """Service/maintenance history for equipment"""
    __tablename__ = 'equipment_service_history'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    equipment_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('equipment.id'), nullable=False)
    service_date = db.Column(db.DateTime, nullable=False)
    service_type = db.Column(db.String(30), nullable=False)  # Regular, Breakdown, AMC, Inspection
    description = db.Column(db.Text, nullable=True)
    cost = db.Column(db.Numeric(10, 2), default=0.00)
    vendor_name = db.Column(db.String(100), nullable=True)
    next_service_date = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)


class RentalBooking(BaseModel):
    """Equipment rental booking/agreement"""
    __tablename__ = 'rental_bookings'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    equipment_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('equipment.id'), nullable=False)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=False)
    booking_number = db.Column(db.String(50), nullable=False, index=True)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    return_date = db.Column(db.DateTime, nullable=True)
    site_address = db.Column(db.Text, nullable=True)
    site_contact_person = db.Column(db.String(100), nullable=True)
    site_contact_phone = db.Column(db.String(20), nullable=True)
    mobilization_charges = db.Column(db.Numeric(10, 2), default=0.00)
    demobilization_charges = db.Column(db.Numeric(10, 2), default=0.00)
    operator_name = db.Column(db.String(100), nullable=True)
    operator_phone = db.Column(db.String(20), nullable=True)
    security_deposit = db.Column(db.Numeric(10, 2), default=0.00)
    deposit_refunded = db.Column(db.Boolean, default=False)
    rental_rate_applied = db.Column(db.Numeric(10, 2), nullable=False)
    rate_type = db.Column(db.String(20), default='Daily')  # Hourly, Daily, Weekly, Monthly
    total_rental_amount = db.Column(db.Numeric(10, 2), default=0.00)
    damage_charges = db.Column(db.Numeric(10, 2), default=0.00)
    total_amount = db.Column(db.Numeric(10, 2), default=0.00)
    billing_status = db.Column(db.String(20), default='Unbilled', index=True)  # Unbilled, Billed, Paid
    status = db.Column(db.String(20), default='Active', index=True)  # Active, Completed, Cancelled, Overdue
    return_condition_notes = db.Column(db.Text, nullable=True)
    agreement_document_url = db.Column(db.String(255), nullable=True)
    
    extensions = db.relationship('RentalExtension', backref='booking', lazy='dynamic', cascade="all, delete-orphan")


class RentalExtension(BaseModel):
    """Extension of a rental booking beyond original end date"""
    __tablename__ = 'rental_extensions'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    booking_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('rental_bookings.id'), nullable=False)
    extension_start = db.Column(db.DateTime, nullable=False)
    extension_end = db.Column(db.DateTime, nullable=False)
    additional_charges = db.Column(db.Numeric(10, 2), default=0.00)
    rate_applied = db.Column(db.Numeric(10, 2), nullable=False)
    reason = db.Column(db.String(255), nullable=True)