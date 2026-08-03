from datetime import datetime
from app.extensions import db
from app.models.base import BaseModel


class AuditLog(BaseModel):
    __tablename__ = 'audit_logs'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=True, index=True)
    user_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    entity_type = db.Column(db.String(50), nullable=False, index=True)
    entity_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    action = db.Column(db.String(20), nullable=False)  # CREATE, UPDATE, DELETE
    old_values_json = db.Column(db.JSON, nullable=True)
    new_values_json = db.Column(db.JSON, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Notification(BaseModel):
    __tablename__ = 'notifications'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    user_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    type = db.Column(db.String(30), nullable=False, index=True)  # LowStock, ReturnDue, PaymentDue, AMCService, ContractExpiry
    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False, index=True)
    reference_type = db.Column(db.String(30), nullable=True)
    reference_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    action_url = db.Column(db.String(255), nullable=True)


class EventLog(BaseModel):
    """Internal event bus history"""
    __tablename__ = 'event_log'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=True, index=True)
    event_name = db.Column(db.String(50), nullable=False, index=True)  # invoice.created, stock.low, payment.overdue
    entity_type = db.Column(db.String(30), nullable=True)
    entity_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    payload_json = db.Column(db.JSON, nullable=True)
    fired_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    processed = db.Column(db.Boolean, default=False)


class Reminder(BaseModel):
    __tablename__ = 'reminders'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    user_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    reminder_date = db.Column(db.DateTime, nullable=False)
    is_completed = db.Column(db.Boolean, default=False)
    reference_type = db.Column(db.String(30), nullable=True)
    reference_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)


class ScheduledJob(BaseModel):
    __tablename__ = 'scheduled_jobs'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=True, index=True)
    job_name = db.Column(db.String(100), nullable=False)
    job_type = db.Column(db.String(30), nullable=False)  # backup, report, reminder, invoice
    schedule_cron = db.Column(db.String(50), nullable=True)
    last_run_at = db.Column(db.DateTime, nullable=True)
    next_run_at = db.Column(db.DateTime, nullable=True)
    config_json = db.Column(db.JSON, nullable=True)
    is_active = db.Column(db.Boolean, default=True)


class RestoreBin(BaseModel):
    """Soft-deleted records pending permanent purge"""
    __tablename__ = 'restore_bin'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=True, index=True)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=False)
    original_data_json = db.Column(db.JSON, nullable=True)
    deleted_by = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    deleted_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    auto_purge_at = db.Column(db.DateTime, nullable=True)  # When to permanently delete


class BackupLog(BaseModel):
    __tablename__ = 'backup_logs'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=True, index=True)
    backup_type = db.Column(db.String(20), nullable=False)  # automatic, manual, remote
    file_name = db.Column(db.String(150), nullable=False)
    file_size = db.Column(db.BigInteger, nullable=True)
    status = db.Column(db.String(20), default='running')  # running, completed, failed
    started_at = db.Column(db.DateTime, nullable=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    # Encrypted JSON snapshot stored inline (for moderate data sizes)
    # For large tenants, swap to an S3 object key and store only the reference here
    encrypted_payload = db.Column(db.LargeBinary().with_variant(db.Text(length=2**31), 'mysql'), nullable=True)


class SyncLog(BaseModel):
    """Desktop client sync history"""
    __tablename__ = 'sync_logs'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    device_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('device_registry.id'), nullable=True)
    sync_type = db.Column(db.String(20), nullable=False)  # upload, download, full
    status = db.Column(db.String(20), default='pending')  # pending, running, completed, failed
    records_synced = db.Column(db.Integer, default=0)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    error_message = db.Column(db.Text, nullable=True)