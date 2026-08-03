from app.extensions import db
from app.models.base import BaseModel


class RepairJobCard(BaseModel):
    """Repair job card for service centers and repair shops"""
    __tablename__ = 'repair_job_cards'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=False)
    job_card_number = db.Column(db.String(50), nullable=False, index=True)
    item_description = db.Column(db.String(255), nullable=False)
    serial_no = db.Column(db.String(100), nullable=True)
    model_no = db.Column(db.String(50), nullable=True)
    reported_issues = db.Column(db.Text, nullable=True)
    diagnostic_notes = db.Column(db.Text, nullable=True)
    assigned_technician_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    estimated_cost = db.Column(db.Numeric(10, 2), default=0.00)
    actual_cost = db.Column(db.Numeric(10, 2), default=0.00)
    status = db.Column(db.String(30), default='Received', index=True)  # Received, Diagnosing, AwaitingParts, InProgress, Completed, Delivered, Cancelled
    received_date = db.Column(db.DateTime, nullable=False)
    completed_date = db.Column(db.DateTime, nullable=True)
    delivered_date = db.Column(db.DateTime, nullable=True)
    customer_notes = db.Column(db.Text, nullable=True)
    internal_notes = db.Column(db.Text, nullable=True)