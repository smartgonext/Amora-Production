from app.extensions import db
from app.models.base import BaseModel

class AMCContract(BaseModel):
    __tablename__ = 'amc_contracts'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=False)
    contract_title = db.Column(db.String(150), nullable=False)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    amc_value = db.Column(db.Numeric(10, 2), nullable=False)
    billing_frequency = db.Column(db.String(30), default='Annual')  # Quarterly, Half-Yearly, Annual
    last_invoice_date = db.Column(db.DateTime, nullable=True)
    next_invoice_date = db.Column(db.DateTime, nullable=True)
    service_interval_days = db.Column(db.Integer, default=90)  # default quarterly service
    custom_fields = db.Column(db.JSON, nullable=True)

    equipment_items = db.relationship('AMCEquipment', backref='contract', lazy=True, cascade="all, delete-orphan")
    schedules = db.relationship('AMCServiceSchedule', backref='contract', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        data = super().to_dict()
        if self.custom_fields and isinstance(self.custom_fields, dict):
            data.update(self.custom_fields)
        return data

class AMCEquipment(BaseModel):
    __tablename__ = 'amc_equipment'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    amc_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('amc_contracts.id'), nullable=False)
    machine_name = db.Column(db.String(100), nullable=False)
    machine_serial = db.Column(db.String(100), nullable=True)
    model = db.Column(db.String(50), nullable=True)
    capacity = db.Column(db.String(50), nullable=True)  # ton capacity, horsepower, etc.

class AMCServiceSchedule(BaseModel):
    __tablename__ = 'amc_service_schedule'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    amc_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('amc_contracts.id'), nullable=False)
    scheduled_date = db.Column(db.DateTime, nullable=False)
    assigned_technician_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    status = db.Column(db.String(20), default='Pending')  # Pending, Completed, Missed
    serviced_at = db.Column(db.DateTime, nullable=True)
    findings_report = db.Column(db.Text, nullable=True)
    parts_consumed_json = db.Column(db.JSON, nullable=True)  # [{"product_id": 1, "qty": 2}]
