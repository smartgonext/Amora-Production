from app.extensions import db
from app.models.manufacturing import TenantManufacturingConfig


# Maps ERP business types to a Universal Manufacturing Engine profile.
# Only business types that represent manufacturing industries get a config row;
# a tenant that does not manufacture gets no row (feature stays disabled).
BUSINESS_TYPE_MFG_PROFILES = {
    'Manufacturing Unit': {
        'mfg_type': 'discrete',
        'enabled_features': ['routing', 'serial_tracking', 'subcontracting', 'job_work', 'mrp_auto_po'],
        'bom_label': 'Multi-level BOM',
        'tracking_label': 'Serial + Warranty',
        'operation_label': 'Multi-stage Routing',
    },
    'Textile Business': {
        'mfg_type': 'textile',
        'enabled_features': ['routing', 'lot_tracking', 'variant_matrix', 'subcontracting', 'job_work', 'mrp_auto_po'],
        'bom_label': 'Variant Matrix',
        'tracking_label': 'Lot + Variant Tag',
        'operation_label': 'Cutting/Stitching/Packing',
    },
    'Bakery': {
        'mfg_type': 'process',
        'enabled_features': ['batch_production', 'expiry_tracking', 'qc',
                             'baker_pct_scaling', 'fefo', 'freshness',
                             'allergen_label', 'haccp'],
        'bom_label': 'Recipe / Yield',
        'tracking_label': 'Batch + Expiry',
        'operation_label': 'Batch Mixing',
    },
    'Ice Cream Manufacturing': {
        'mfg_type': 'process',
        'enabled_features': ['batch_production', 'expiry_tracking', 'qc',
                             'fefo', 'cold_chain', 'haccp', 'routing', 'mrp',
                             'work_orders', 'job_work'],
        'bom_label': 'Recipe / Batch Formula',
        'tracking_label': 'Batch + Expiry (FEFO)',
        'operation_label': 'Pasteurization / Churning',
    },
    'Ice Cream & Dairy': {
        'mfg_type': 'process',
        'enabled_features': ['batch_production', 'expiry_tracking', 'qc',
                             'fefo', 'cold_chain', 'haccp', 'routing', 'mrp',
                             'work_orders', 'job_work'],
        'bom_label': 'Recipe / Batch Formula',
        'tracking_label': 'Batch + Expiry (FEFO)',
        'operation_label': 'Pasteurization / Churning',
    },
}


def get_default_manufacturing_profile(business_type):
    """Return the manufacturing profile dict for a business type, or None."""
    if not business_type:
        return None
    key = business_type.strip()
    # Case-insensitive lookup, then a fallback substring match
    for name, profile in BUSINESS_TYPE_MFG_PROFILES.items():
        if name.lower() == key.lower():
            return profile
    lowered = key.lower()
    for name, profile in BUSINESS_TYPE_MFG_PROFILES.items():
        if name.lower() in lowered:
            return profile
    return None


def seed_manufacturing_config(tenant_id, business_type, commit=True):
    """Create a fresh `tenant_manufacturing_configs` row for the tenant
    based on the selected industry/business type. Best-effort; no-ops when
    the business type is not a manufacturing industry."""
    profile = get_default_manufacturing_profile(business_type)
    if profile is None:
        return None

    existing = TenantManufacturingConfig.query.filter_by(
        tenant_id=tenant_id, is_deleted=False
    ).first()
    if existing:
        return existing

    config = TenantManufacturingConfig(
        tenant_id=tenant_id,
        mfg_type=profile['mfg_type'],
        enabled_features=profile['enabled_features'],
        bom_label=profile['bom_label'],
        tracking_label=profile['tracking_label'],
        operation_label=profile['operation_label'],
        is_active=True,
    )
    db.session.add(config)
    if commit:
        db.session.commit()
    return config