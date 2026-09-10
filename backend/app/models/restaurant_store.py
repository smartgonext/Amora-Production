"""
Manufacturer -> Restaurant / Store delivery channel.

This is the bridge between the ERP (bakery / manufacturer, which turns raw
material into FINISHED products via the Manufacturing engine) and an external
RESTAURANT billing software (a local EXE that is connected to the internet).

Concept
-------
1. ERP manufactures finished products (raw material -> finished goods).
2. Those finished products are DISPATCHED from the manufacturer to a restaurant
   store/outlet.
3. The restaurant EXE polls the ERP:
     * GET /api/v1/store/products          -> "how many products are ready?"
     * POST /api/v1/store/dispatch         -> move products to the store.
        At that moment the ERP adjusts & records its stock (StockLedger +
        Product.current_stock + ProductBatch.quantity) and saves a
        StoreDispatch record. The restaurant EXE then increases its OWN stock.
4. Each store/outlet is a StoreChannel with its own API key so every EXE only
   ever sees its own data.
"""
from datetime import datetime
import uuid

from app.extensions import db
from app.models.base import BaseModel


class StoreChannel(BaseModel):
    """One restaurant outlet / store that consumes this ERP's product feed."""

    __tablename__ = 'store_channels'
    # outlet `code` is unique PER TENANT (two different manufacturers can reuse
    # the same outlet code; only the api_key must be globally unique).
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'code', name='uq_store_channel_tenant_code'),
    )

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                          db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                           db.ForeignKey('companies.id'), nullable=True)
    # Restaurant / outlet identity
    name = db.Column(db.String(150), nullable=False)
    code = db.Column(db.String(50), nullable=False, index=True)
    location = db.Column(db.String(255), nullable=True)
    # Credentials presented by the EXE on every call: Header -> X-API-Key
    api_key = db.Column(db.String(64), unique=True, nullable=False, index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_sync_at = db.Column(db.DateTime, nullable=True)

    dispatches = db.relationship('StoreDispatch', backref='store', lazy='dynamic',
                                 cascade="all, delete-orphan")

    def to_dict(self, include_secret=False):
        data = super().to_dict()
        if include_secret:
            data['api_key'] = self.api_key
        else:
            data.pop('api_key', None)
        return data


class StoreDispatch(BaseModel):
    """A dispatch (delivery) of finished products from the ERP to a store.

    Created when finished goods move from manufacturing to the restaurant. The
    ERP reduces its stock here and the restaurant EXE confirms reception.
    """

    __tablename__ = 'store_dispatches'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                          db.ForeignKey('tenants.id'), nullable=False, index=True)
    store_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                         db.ForeignKey('store_channels.id'), nullable=False, index=True)
    dispatch_ref = db.Column(db.String(40), unique=True, nullable=False, index=True)
    status = db.Column(db.String(20), default='dispatched', index=True)
    # dispatched -> received / cancelled
    total_qty = db.Column(db.Integer, default=0)
    dispatched_at = db.Column(db.DateTime, nullable=False)
    received_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    items = db.relationship('StoreDispatchItem', backref='dispatch', lazy='dynamic',
                            cascade="all, delete-orphan")

    def to_dict(self):
        data = super().to_dict()
        data['items'] = [i.to_dict() for i in self.items if not i.is_deleted]
        return data


class StoreDispatchItem(BaseModel):
    """One product line inside a dispatch."""

    __tablename__ = 'store_dispatch_items'

    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                          db.ForeignKey('tenants.id'), nullable=False, index=True)
    dispatch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                            db.ForeignKey('store_dispatches.id'), nullable=False, index=True)
    product_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"),
                           db.ForeignKey('products.id'), nullable=False)
    product_name = db.Column(db.String(150), nullable=True)  # denormalised snapshot
    sku = db.Column(db.String(50), nullable=True)
    qty = db.Column(db.Integer, nullable=False)
    qty_received = db.Column(db.Integer, default=0)
    unit = db.Column(db.String(20), nullable=True)
    batch_no = db.Column(db.String(50), nullable=True)
    mfg_date = db.Column(db.DateTime, nullable=True)
    expiry_date = db.Column(db.DateTime, nullable=True)
    selling_price = db.Column(db.Numeric(10, 2), default=0.00)

    def to_dict(self):
        data = super().to_dict()
        if data.get('selling_price') is not None:
            data['selling_price'] = float(data['selling_price'])
        return data