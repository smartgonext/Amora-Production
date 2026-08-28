"""Phase 1 Upgrade: Goods Receipt Note (GRN) with Gate Entry, Lorry Tracking,
Incoming QC and Raw-Batch receipt for the Indian Manufacturing module.

This replaces the minimal GRN creation with an actual-data-driven procurement
step:
  * Gate Entry / inward register number capture
  * Vehicle (lorry) & Lorry Receipt (LR) tracking
  * Raw material batch receipt (batch_no / mfg_date / expiry_date)
  * Incoming-QC accept/reject quantities per line
  * Only accepted quantities are posted to warehouse stock + ProductBatch
"""
from datetime import datetime, date
import uuid

from app.extensions import db
from app.models.product import (
    Product, ProductBatch, GoodsReceiptNote, GRNItem, PurchaseOrder,
)
from app.services.manufacturing_service import as_decimal, post_stock_ledger


def _parse_date(value):
    if not value:
        return None
    if isinstance(value, (datetime, date)):
        return value if isinstance(value, date) else value.date()
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def create_grn(tenant_id, company_id, data):
    """Create a GRN with gate entry, lorry tracking and incoming-QC line items.

    Returns the persisted GRN (with items embedded) or raises ValueError.
    """
    data = data or {}
    items = data.get('items') or []
    if not items:
        raise ValueError("At least one GRN item is required")

    warehouse_id = data.get('warehouse_id')
    received_date = data.get('received_date')
    if received_date:
        received_date = _parse_date(received_date)
    else:
        received_date = datetime.utcnow()

    grn_number = (data.get('grn_number') or "").strip() or f"GRN-{uuid.uuid4().hex[:8].upper()}"

    grn = GoodsReceiptNote(
        tenant_id=tenant_id,
        company_id=company_id,
        purchase_order_id=data.get('purchase_order_id'),
        warehouse_id=warehouse_id,
        grn_number=grn_number,
        received_date=received_date,
        supplier_invoice_no=data.get('supplier_invoice_no'),
        supplier_invoice_date=_parse_date(data.get('supplier_invoice_date')),
        gate_entry_no=data.get('gate_entry_no'),
        vehicle_no=data.get('vehicle_no'),
        lr_no=data.get('lr_no'),
        notes=data.get('notes'),
        status=data.get('status', 'pending_qc'),
    )
    db.session.add(grn)
    db.session.flush()

    total_received = 0
    total_accepted = 0
    line_items = []
    for it in items:
        product_id = it.get('product_id')
        if not product_id:
            continue
        received_qty = int(it.get('received_quantity') or 0)
        accepted_qty = int(it.get('accepted_quantity', received_qty))
        rejected_qty = int(it.get('rejected_quantity') or max(received_qty - accepted_qty, 0))
        total_received += received_qty
        total_accepted += accepted_qty

        line = GRNItem(
            tenant_id=tenant_id,
            grn_id=grn.id,
            purchase_item_id=it.get('purchase_item_id'),
            product_id=int(product_id),
            ordered_quantity=int(it.get('ordered_quantity') or 0),
            received_quantity=received_qty,
            accepted_quantity=accepted_qty,
            rejected_quantity=rejected_qty,
            rejection_reason=it.get('rejection_reason'),
            batch_no=it.get('batch_no'),
            mfg_date=_parse_date(it.get('mfg_date')),
            expiry_date=_parse_date(it.get('expiry_date')),
        )
        db.session.add(line)
        line_items.append(line)

        # Post only accepted qty to stock with raw batch traceability
        if accepted_qty > 0:
            batch = None
            if it.get('batch_no'):
                batch = ProductBatch(
                    tenant_id=tenant_id,
                    product_id=int(product_id),
                    batch_no=str(it.get('batch_no')),
                    mfg_date=_parse_date(it.get('mfg_date')),
                    expiry_date=_parse_date(it.get('expiry_date')),
                    quantity=accepted_qty,
                    purchase_price=as_decimal(it.get('rate') or 0),
                )
                db.session.add(batch)
                db.session.flush()
            product = db.session.get(Product, int(product_id))
            rate = as_decimal(it.get('rate') or (product.purchase_price if product else 0))
            post_stock_ledger(
                tenant_id, company_id, warehouse_id, int(product_id), accepted_qty,
                'Purchase', 'grn', grn.id,
                f"GRN {grn_number} receipt (incoming QC accepted)",
                rate=rate,
            )

    # Derive QC gate status when not explicitly provided
    if data.get('status') in (None, '', 'pending_qc'):
        if total_received and total_accepted > 0 and total_accepted == total_received:
            grn.status = 'approved'
        elif total_accepted == 0 and total_received > 0:
            grn.status = 'rejected'
        elif total_accepted > 0:
            grn.status = 'partial'
        else:
            grn.status = 'pending_qc'

    db.session.add(grn)
    db.session.commit()
    return db.session.get(GoodsReceiptNote, grn.id)


def get_grn(tenant_id, grn_id):
    """Return GRN dict with its line items (incl. raw batches)."""
    grn = GoodsReceiptNote.query.filter_by(
        id=int(grn_id), tenant_id=tenant_id, is_deleted=False
    ).first()
    if grn is None:
        return None
    grn_dict = grn.to_dict()
    grn_dict['supplier_name'] = None
    if grn.purchase_order_id:
        po = db.session.get(PurchaseOrder, grn.purchase_order_id)
        if po and po.supplier:
            grn_dict['supplier_name'] = po.supplier.name
    return grn_dict