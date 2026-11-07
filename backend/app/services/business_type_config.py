"""
Company-Type Driven Module & Field Gating.

This is the **single source of truth** for what a tenant sees based on their
selected Business Type (Retail, Bakery, Manufacturing, Pharmacy, ...).

It mirrors PLAN.md "Appendix A -- Business Type -> Module Enablement Matrix".
It is kept as *data* (an editable registry) rather than spread across
per-page conditionals. Per-tenant effective config is persisted into
``CompanySetting`` rows (``ui_modules``, ``ui_features``, ``ui_hidden``) at
registration and whenever the business type changes, and is served to the
front-end via ``GET /api/v1/setup/ui-config``.

EVERY company keeps the **core** modules. Unknown / empty business types fall
back to ALL modules so legacy tenants are never broken (mirrors the
`useManufacturingConfig` 404-fallback behaviour already used in the app).
"""
import json
from app.extensions import db
from app.models.tenant import CompanySetting

# ---------------------------------------------------------------------------
# Canonical module codes understood by the front-end navigation.
# ---------------------------------------------------------------------------
MODULE_CODES = [
    'dashboard', 'products', 'customers', 'suppliers', 'sales', 'purchases',
    'inventory', 'equipment', 'rentals', 'amc', 'hr', 'projects',
    'documents', 'billing', 'finance', 'reports', 'manufacturing',
]


def all_modules():
    """Every module we know about (used as the legacy fallback)."""
    return list(MODULE_CODES)


def _module(items):
    return {
        'enabled': [m for m in items['enabled'] if m in MODULE_CODES],
        'hidden': [m for m in items['hidden'] if m in MODULE_CODES],
        'features': dict(items.get('features', {})),
    }


# ---------------------------------------------------------------------------
# Business-type -> enabled modules (PLAN.md Appendix A, mapped to real paths)
# ---------------------------------------------------------------------------
# Modules NOT listed for a type are hidden from that company's navigation.
BUSINESS_MODULE_DEFAULTS = {
    'Retail Shop': _module({
        'enabled': ['dashboard', 'products', 'billing', 'inventory', 'purchases', 'sales',
                    'customers', 'suppliers', 'finance', 'reports', 'documents'],
        'hidden': ['equipment', 'rentals', 'amc', 'hr', 'projects', 'manufacturing'],
        'features': {'pos': True, 'retail': True},
    }),
    'Supermarket': _module({
        'enabled': ['dashboard', 'products', 'billing', 'inventory', 'purchases', 'sales',
                    'customers', 'suppliers', 'finance', 'reports', 'documents'],
        'hidden': ['equipment', 'rentals', 'amc', 'hr', 'projects', 'manufacturing'],
        'features': {'pos': True, 'retail': True, 'wholesale': True},
    }),
    'Wholesale Distribution': _module({
        'enabled': ['dashboard', 'products', 'purchases', 'sales', 'inventory', 'suppliers',
                    'customers', 'documents', 'finance', 'reports'],
        'hidden': ['billing', 'equipment', 'rentals', 'amc', 'hr', 'projects',
                   'manufacturing'],
        'features': {'wholesale': True},
    }),
    'Bakery': _module({
        'enabled': ['dashboard', 'products', 'billing', 'sales', 'purchases', 'inventory',
                    'customers', 'suppliers', 'hr', 'documents', 'finance',
                    'reports', 'manufacturing'],
        'hidden': ['equipment', 'rentals', 'amc', 'projects'],
        'features': {'pos': True, 'batch': True, 'expiry': True, 'qc': True,
                     'freshness': True, 'recipe': True, 'mfg_type': 'process', 'baker_pct_scaling': True},
    }),
    'Ice Cream Manufacturing': _module({
        'enabled': ['dashboard', 'products', 'billing', 'sales', 'purchases', 'inventory',
                    'customers', 'suppliers', 'hr', 'documents', 'finance',
                    'reports', 'manufacturing'],
        'hidden': ['equipment', 'rentals', 'amc', 'projects'],
        'features': {
            'pos': True, 'batch': True, 'expiry': True, 'qc': True,
            'freshness': True, 'recipe': True, 'fefo': True, 'haccp': True,
            'routing': True, 'mrp': True, 'work_orders': True,
            'mfg_type': 'process', 'baker_pct_scaling': True,
        },
    }),
    'Ice Cream & Dairy': _module({
        'enabled': ['dashboard', 'products', 'billing', 'sales', 'purchases', 'inventory',
                    'customers', 'suppliers', 'hr', 'documents', 'finance',
                    'reports', 'manufacturing'],
        'hidden': ['equipment', 'rentals', 'amc', 'projects'],
        'features': {
            'pos': True, 'batch': True, 'expiry': True, 'qc': True,
            'freshness': True, 'recipe': True, 'fefo': True, 'haccp': True,
            'routing': True, 'mrp': True, 'work_orders': True,
            'mfg_type': 'process', 'baker_pct_scaling': True,
        },
    }),
    'Manufacturing Unit': _module({
        'enabled': ['dashboard', 'products', 'customers', 'suppliers', 'sales', 'purchases',
                    'inventory', 'hr', 'projects', 'documents', 'finance',
                    'reports', 'manufacturing'],
        'hidden': ['billing', 'equipment', 'rentals', 'amc'],
        'features': {'mfg_type': 'discrete', 'routing': True, 'serial': True,
                     'mrp': True},
    }),
    'Textile Business': _module({
        'enabled': ['dashboard', 'products', 'customers', 'suppliers', 'sales', 'purchases',
                    'inventory', 'hr', 'projects', 'documents', 'finance',
                    'reports', 'manufacturing'],
        'hidden': ['billing', 'equipment', 'rentals', 'amc'],
        'features': {'mfg_type': 'textile', 'variant': True, 'lot': True,
                     'job_work': True},
    }),
    'Equipment Rental': _module({
        'enabled': ['dashboard', 'products', 'customers', 'suppliers', 'inventory', 'sales',
                    'finance', 'reports', 'documents', 'equipment', 'rentals',
                    'amc'],
        'hidden': ['billing', 'hr', 'projects', 'manufacturing', 'purchases'],
        'features': {'rental': True, 'amc': True},
    }),
    'Crane & Forklift': _module({
        'enabled': ['dashboard', 'products', 'customers', 'suppliers', 'purchases', 'inventory',
                    'billing', 'sales', 'finance', 'reports', 'documents',
                    'equipment', 'rentals', 'amc'],
        'hidden': ['hr', 'projects', 'manufacturing'],
        'features': {'rental': True, 'amc': True, 'parts': True},
    }),
    'Repair Shop': _module({
        'enabled': ['dashboard', 'products', 'customers', 'sales', 'inventory', 'documents',
                    'finance', 'reports', 'purchases'],
        'hidden': ['equipment', 'rentals', 'amc', 'hr', 'billing', 'manufacturing',
                   'projects'],
        'features': {'repair': True, 'job_card': True},
    }),
    'Vehicle Service': _module({
        'enabled': ['dashboard', 'products', 'customers', 'sales', 'inventory', 'documents',
                    'finance', 'reports', 'purchases'],
        'hidden': ['equipment', 'rentals', 'amc', 'hr', 'billing', 'manufacturing',
                   'projects'],
        'features': {'repair': True, 'vehicle': True, 'job_card': True},
    }),
    'Mobile Shop': _module({
        'enabled': ['dashboard', 'products', 'customers', 'suppliers', 'sales', 'purchases',
                    'inventory', 'billing', 'finance', 'reports', 'documents'],
        'hidden': ['equipment', 'rentals', 'amc', 'hr', 'projects', 'manufacturing'],
        'features': {'pos': True, 'serial': True},
    }),
    'Medical Shop': _module({
        'enabled': ['dashboard', 'products', 'customers', 'suppliers', 'sales', 'purchases',
                    'inventory', 'billing', 'finance', 'reports', 'documents'],
        'hidden': ['equipment', 'rentals', 'amc', 'hr', 'projects', 'manufacturing'],
        'features': {'batch': True, 'expiry': True},
    }),
    'Pharmacy': _module({
        'enabled': ['dashboard', 'products', 'customers', 'suppliers', 'sales', 'purchases',
                    'inventory', 'billing', 'finance', 'reports', 'documents'],
        'hidden': ['equipment', 'rentals', 'amc', 'hr', 'projects', 'manufacturing'],
        'features': {'batch': True, 'expiry': True},
    }),
    'Restaurant': _module({
        'enabled': ['dashboard', 'products', 'customers', 'suppliers', 'purchases',
                    'inventory', 'billing', 'finance', 'reports', 'documents', 'hr'],
        'hidden': ['equipment', 'rentals', 'amc', 'projects', 'manufacturing'],
        'features': {'pos': True, 'table_mgmt': True, 'kitchen': True},
    }),
    'Spa': _module({
        'enabled': ['dashboard', 'products', 'customers', 'billing', 'finance',
                    'reports', 'documents', 'hr'],
        'hidden': ['equipment', 'rentals', 'amc', 'projects', 'manufacturing', 'purchases'],
        'features': {'pos': True, 'appointments': True},
    }),
    'Construction': _module({
        'enabled': ['dashboard', 'products', 'customers', 'suppliers', 'purchases',
                    'inventory', 'sales', 'finance', 'reports', 'documents',
                    'equipment', 'rentals', 'projects', 'hr'],
        'hidden': ['billing', 'amc', 'manufacturing'],
        'features': {'projects': True, 'equipment': True, 'rental': True},
    }),
    'Universal ERP': _module({
        'enabled': MODULE_CODES,
        'hidden': [],
        'features': {
            'pos': True, 'rental': True, 'amc': True, 'mfg_type': 'hybrid',
            'baker_pct_scaling': True, 'freshness': True, 'fefo': True,
            'haccp': True, 'routing': True, 'mrp': True, 'work_orders': True,
            'quality_control': True, 'job_work': True, 'qc': True
        },
    }),
    'Heavy Equipment & Services': _module({
        'enabled': MODULE_CODES,
        'hidden': [],
        'features': {
            'rental': True, 'amc': True, 'parts': True, 'mfg_type': 'hybrid',
            'baker_pct_scaling': True, 'freshness': True, 'fefo': True,
            'haccp': True, 'routing': True, 'mrp': True, 'work_orders': True,
            'quality_control': True, 'job_work': True, 'qc': True
        },
    }),
}

# ---------------------------------------------------------------------------
# Resolver + lookup
# ---------------------------------------------------------------------------
def _lookup_profile(business_type):
    if not business_type:
        return None
    key = str(business_type).strip()
    for name, profile in BUSINESS_MODULE_DEFAULTS.items():
        if name.lower() == key.lower():
            return profile
    # Fallback substring match, e.g. "Bakery Manufacturing Unit"
    lowered = key.lower()
    for name, profile in BUSINESS_MODULE_DEFAULTS.items():
        if name.lower() in lowered or lowered in name.lower():
            return profile
    return None


def get_default_business_modules(business_type):
    """Return effective modules/features for a business type.

    Unknown / blank types return *every* module so nothing ever disappears
    for legacy tenants that predate this gating.
    """
    profile = _lookup_profile(business_type)
    if profile is None:
        return {
            'enabled_modules': all_modules(),
            'features': {},
            'hidden': [],
        }
    return {
        'enabled_modules': list(profile['enabled']),
        'features': dict(profile['features']),
        'hidden': list(profile['hidden']),
    }


# ---------------------------------------------------------------------------
# Persistence (per-tenant effective config in CompanySetting rows)
# ---------------------------------------------------------------------------
def _set_company_setting(tenant_id, company_id, key, value):
    row = CompanySetting.query.filter_by(company_id=company_id, setting_key=key).first()
    if not row:
        row = CompanySetting(tenant_id=tenant_id, company_id=company_id, setting_key=key)
    row.setting_value = value
    db.session.add(row)


def seed_business_type_config(tenant_id, company_id, business_type, commit=True):
    """Persist a company's effective UI config for its business type.

    Idempotent and safe to call at registration and whenever the business
    type changes (Setup wizard step 2 / company settings).
    """
    resolved = get_default_business_modules(business_type)
    _set_company_setting(tenant_id, company_id, 'ui_modules', ",".join(resolved['enabled_modules']))
    _set_company_setting(tenant_id, company_id, 'ui_features', json.dumps(resolved['features']))
    _set_company_setting(tenant_id, company_id, 'ui_hidden', ",".join(resolved['hidden']))
    if commit:
        db.session.commit()
    return resolved


def get_company_ui_config(company):
    """Effective UI config for a company.

    Prefers persisted CompanySetting rows (admins can edit these without a
    redeploy) and falls back to the registry defaults.
    """
    bt = getattr(company, 'business_type', None) or None
    resolved = get_default_business_modules(bt)

    enabled = _read_setting_list(company.id, 'ui_modules') or resolved['enabled_modules']
    hidden = _read_setting_list(company.id, 'ui_hidden') or resolved['hidden']
    features = _read_setting_json(company.id, 'ui_features') or resolved['features']

    return {
        'business_type': bt,
        'enabled_modules': enabled,
        'hidden_modules': hidden,
        'features': features,
    }


def _read_setting_list(company_id, key):
    row = CompanySetting.query.filter_by(company_id=company_id, setting_key=key).first()
    if not row or not row.setting_value:
        return None
    val = row.setting_value
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        if val.startswith('['):
            try:
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
        return [x for x in val.split(',') if x]
    return None


def _read_setting_json(company_id, key):
    row = CompanySetting.query.filter_by(company_id=company_id, setting_key=key).first()
    if not row or not row.setting_value:
        return None
    try:
        return json.loads(row.setting_value)
    except Exception:
        return None