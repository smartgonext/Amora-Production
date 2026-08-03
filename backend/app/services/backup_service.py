"""
Cloud Backup & Disaster Recovery Service — Phase 11
Handles:
  - Encrypted backup creation (tenant data snapshot as JSON)
  - Backup upload metadata recording
  - Restore flow: retrieve latest backup payload for a tenant
  - Remote backup trigger (called by superadmin or by scheduled job)
"""
import json
import hashlib
import base64
import os
from datetime import datetime
from typing import Optional, Dict, Any

from app.extensions import db
from app.models.audit import BackupLog, EventLog


# ---------------------------------------------------------------------------
# Symmetric encryption helpers (AES-256 via Fernet / fallback XOR for demo)
# In production, swap for cryptography.fernet.Fernet or AWS KMS.
# ---------------------------------------------------------------------------
try:
    from cryptography.fernet import Fernet
    _CRYPTO_AVAILABLE = True
except ImportError:
    _CRYPTO_AVAILABLE = False


def _get_or_create_tenant_key(tenant_id: int) -> bytes:
    """
    Derive a stable per-tenant encryption key.
    Uses HMAC-SHA256 of the master secret + tenant_id so each tenant's
    backup can only be decrypted with knowledge of both.
    In production, store the master secret in an env-var / secrets manager.
    """
    master_secret = os.environ.get('BACKUP_MASTER_SECRET', 'smartgonext-backup-secret-change-in-prod')
    raw = hashlib.sha256(f"{master_secret}:{tenant_id}".encode()).digest()
    # Fernet requires a URL-safe base64-encoded 32-byte key
    return base64.urlsafe_b64encode(raw)


def encrypt_payload(data: str, tenant_id: int) -> str:
    """Return base64-encoded encrypted string of *data*."""
    if _CRYPTO_AVAILABLE:
        key = _get_or_create_tenant_key(tenant_id)
        f = Fernet(key)
        return f.encrypt(data.encode()).decode()
    # Fallback: base64 (NOT production-safe — replace with real encryption)
    return base64.b64encode(data.encode()).decode()


def decrypt_payload(token: str, tenant_id: int) -> str:
    """Decrypt a string produced by encrypt_payload."""
    if _CRYPTO_AVAILABLE:
        key = _get_or_create_tenant_key(tenant_id)
        f = Fernet(key)
        return f.decrypt(token.encode()).decode()
    return base64.b64decode(token.encode()).decode()


# ---------------------------------------------------------------------------
# Backup snapshot builder
# ---------------------------------------------------------------------------
def _collect_tenant_snapshot(tenant_id: int) -> Dict[str, Any]:
    """
    Pull all tenant data into a serialisable dict.
    Each model that is tenant-scoped is included.
    Returns a dict keyed by table name → list of row dicts.
    """
    from app.models.tenant import Company, Branch, DeviceRegistry, License, Subscription
    from app.models.user import User
    from app.models.customer import Customer, Supplier, CustomerLedger, SupplierLedger
    from app.models.product import Product, ProductCategory, StockLedger
    from app.models.sales import Invoice, InvoiceItem, Receipt
    from app.models.finance import CashAccount, BankAccount, Expense, JournalEntry
    from app.models.hr import Employee, Attendance
    from app.models.audit import AuditLog, SyncLog

    def rows(model, extra_filter=None):
        q = model.query.filter_by(tenant_id=tenant_id, is_deleted=False)
        if extra_filter:
            q = q.filter(extra_filter)
        return [r.to_dict() for r in q.all()]

    snapshot = {
        "tenant_id": tenant_id,
        "snapshot_at": datetime.utcnow().isoformat(),
        "schema_version": "1.0",
        "tables": {
            "companies":        rows(Company),
            "branches":         rows(Branch),
            "users":            rows(User),
            "devices":          rows(DeviceRegistry),
            "subscriptions":    rows(Subscription),
            "licenses":         rows(License),
            "customers":        rows(Customer),
            "suppliers":        rows(Supplier),
            "customer_ledger":  rows(CustomerLedger),
            "supplier_ledger":  rows(SupplierLedger),
            "products":         rows(Product),
            "product_categories": rows(ProductCategory),
            "stock_ledger":     rows(StockLedger),
            "invoices":         rows(Invoice),
            "invoice_items":    rows(InvoiceItem),
            "receipts":         rows(Receipt),
            "cash_accounts":    rows(CashAccount),
            "bank_accounts":    rows(BankAccount),
            "expenses":         rows(Expense),
            "journal_entries":  rows(JournalEntry),
            "employees":        rows(Employee),
            "attendance":       rows(Attendance),
        }
    }
    return snapshot


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def create_backup(tenant_id: int, backup_type: str = 'automatic',
                  triggered_by_user_id: Optional[int] = None) -> BackupLog:
    """
    Create an encrypted backup of all tenant data.
    Stores the encrypted payload in BackupLog.encrypted_payload (TEXT column).
    Returns the BackupLog record.
    """
    started_at = datetime.utcnow()
    log = BackupLog(
        tenant_id=tenant_id,
        backup_type=backup_type,
        file_name=f"backup_{tenant_id}_{started_at.strftime('%Y%m%d_%H%M%S')}.enc",
        status='running',
        started_at=started_at,
    )
    db.session.add(log)
    db.session.flush()  # get log.id

    try:
        snapshot = _collect_tenant_snapshot(tenant_id)
        json_str = json.dumps(snapshot, default=str)
        encrypted = encrypt_payload(json_str, tenant_id)

        log.encrypted_payload = encrypted
        log.file_size = len(encrypted.encode())
        log.status = 'completed'
        log.completed_at = datetime.utcnow()

        # Fire event
        EventLog(
            tenant_id=tenant_id,
            event_name='backup.completed',
            entity_type='backup_log',
            entity_id=log.id,
            payload_json={'file_name': log.file_name, 'size': log.file_size},
            fired_at=datetime.utcnow(),
            processed=True,
        )

    except Exception as exc:
        log.status = 'failed'
        log.notes = str(exc)
        log.completed_at = datetime.utcnow()

        EventLog(
            tenant_id=tenant_id,
            event_name='backup.failed',
            entity_type='backup_log',
            entity_id=log.id,
            payload_json={'error': str(exc)},
            fired_at=datetime.utcnow(),
            processed=True,
        )
        raise

    finally:
        db.session.commit()

    return log


def get_latest_backup(tenant_id: int) -> Optional[BackupLog]:
    """Return the most recent successful BackupLog for this tenant."""
    return (
        BackupLog.query
        .filter_by(tenant_id=tenant_id, status='completed', is_deleted=False)
        .order_by(BackupLog.completed_at.desc())
        .first()
    )


def restore_from_backup(backup_log_id: int, tenant_id: int) -> Dict[str, Any]:
    """
    Decrypt and return the raw snapshot dict from a BackupLog.
    The caller (route handler) is responsible for re-inserting records.
    We return the snapshot dict so the restore endpoint can stream it back
    to a freshly reinstalled desktop client.
    """
    log = BackupLog.query.filter_by(
        id=backup_log_id, tenant_id=tenant_id, is_deleted=False
    ).first()

    if not log:
        raise ValueError("Backup not found or access denied.")
    if log.status != 'completed':
        raise ValueError("Backup is not in completed state.")
    if not log.encrypted_payload:
        raise ValueError("Backup payload is missing.")

    json_str = decrypt_payload(log.encrypted_payload, tenant_id)
    return json.loads(json_str)


def list_backups(tenant_id: int, page: int = 1, page_size: int = 20):
    """Paginated list of BackupLog records for a tenant."""
    query = (
        BackupLog.query
        .filter_by(tenant_id=tenant_id, is_deleted=False)
        .order_by(BackupLog.started_at.desc())
    )
    total = query.count()
    records = query.offset((page - 1) * page_size).limit(page_size).all()
    return records, total
