from app.extensions import db
from app.models.tenant import CustomFormSection, CustomFormField
import re

DEFAULT_SECTIONS = {
    'product': [
        {'name': 'Basic Product Info', 'order': 1},
        {'name': 'Pricing & Tax Details', 'order': 2},
        {'name': 'Inventory & Stock Specs', 'order': 3},
        {'name': 'Custom Product Attributes', 'order': 4}
    ],
    'service': [
        {'name': 'Service Overview', 'order': 1},
        {'name': 'Service Rates & Billing', 'order': 2},
        {'name': 'Custom Specifications', 'order': 3}
    ],
    'rental': [
        {'name': 'Agreement Info', 'order': 1},
        {'name': 'Rental Timeline & Rates', 'order': 2},
        {'name': 'Additional Rental Specs', 'order': 3}
    ],
    'amc': [
        {'name': 'Contract Info', 'order': 1},
        {'name': 'Service Schedule & Details', 'order': 2},
        {'name': 'Covered Equipment Details', 'order': 3}
    ],
    'customer': [
        {'name': 'General Information', 'order': 1},
        {'name': 'Contact & Address', 'order': 2},
        {'name': 'Tax & Compliance', 'order': 3},
        {'name': 'Custom Customer Attributes', 'order': 4}
    ],
    'invoice': [
        {'name': 'Invoice Header & Notes', 'order': 1},
        {'name': 'Additional Custom Fields', 'order': 2}
    ]
}

DEFAULT_STATIC_FIELDS = {
    'product': {
        'Basic Product Info': [
            {'key': 'name', 'name': 'Product Name', 'type': 'text', 'required': True, 'width': '50%', 'order': 1},
            {'key': 'sku', 'name': 'SKU / Code', 'type': 'text', 'required': False, 'width': '50%', 'order': 2},
            {'key': 'description', 'name': 'Description', 'type': 'textarea', 'required': False, 'width': '100%', 'order': 3}
        ],
        'Pricing & Tax Details': [
            {'key': 'purchase_price', 'name': 'Purchase Price', 'type': 'number', 'required': True, 'width': '50%', 'order': 1},
            {'key': 'selling_price', 'name': 'Selling Price', 'type': 'number', 'required': True, 'width': '50%', 'order': 2},
            {'key': 'gst_rate', 'name': 'GST Rate (%)', 'type': 'select', 'required': True, 'width': '50%', 'order': 3, 'options': ['0% GST', '5% GST', '12% GST', '18% GST', '28% GST']},
            {'key': 'hsn_code', 'name': 'HSN Code', 'type': 'text', 'required': False, 'width': '50%', 'order': 4}
        ],
        'Inventory & Stock Specs': [
            {'key': 'min_stock_level', 'name': 'Minimum Stock Threshold', 'type': 'number', 'required': False, 'width': '50%', 'order': 1},
            {'key': 'opening_stock', 'name': 'Opening Stock Qty', 'type': 'number', 'required': False, 'width': '50%', 'order': 2},
            {'key': 'is_active', 'name': 'Set Catalog Product to Active', 'type': 'checkbox', 'required': False, 'width': '100%', 'order': 3}
        ]
    },
    'service': {
        'Service Overview': [
            {'key': 'name', 'name': 'Service Name', 'type': 'text', 'required': True, 'width': '50%', 'order': 1},
            {'key': 'sku', 'name': 'Service Code', 'type': 'text', 'required': False, 'width': '50%', 'order': 2},
            {'key': 'description', 'name': 'Description', 'type': 'textarea', 'required': False, 'width': '100%', 'order': 3}
        ],
        'Service Rates & Billing': [
            {'key': 'purchase_price', 'name': 'Base Cost / Rate', 'type': 'number', 'required': True, 'width': '50%', 'order': 1},
            {'key': 'selling_price', 'name': 'Service Charge / Price', 'type': 'number', 'required': True, 'width': '50%', 'order': 2},
            {'key': 'gst_rate', 'name': 'GST Rate (%)', 'type': 'select', 'required': True, 'width': '50%', 'order': 3, 'options': ['0% GST', '5% GST', '12% GST', '18% GST', '28% GST']},
            {'key': 'hsn_code', 'name': 'SAC Code', 'type': 'text', 'required': False, 'width': '50%', 'order': 4},
            {'key': 'is_active', 'name': 'Active Service', 'type': 'checkbox', 'required': False, 'width': '100%', 'order': 5}
        ]
    },
    'rental': {
        'Agreement Info': [
            {'key': 'customer_id', 'name': 'Select Customer', 'type': 'select', 'required': True, 'width': '50%', 'order': 1},
            {'key': 'equipment_id', 'name': 'Select Available Equipment', 'type': 'select', 'required': True, 'width': '50%', 'order': 2}
        ],
        'Rental Timeline & Rates': [
            {'key': 'start_date', 'name': 'Start Date', 'type': 'date', 'required': True, 'width': '50%', 'order': 1},
            {'key': 'end_date', 'name': 'End Date', 'type': 'date', 'required': True, 'width': '50%', 'order': 2},
            {'key': 'rental_rate_applied', 'name': 'Daily Rental Rate (₹)', 'type': 'number', 'required': True, 'width': '50%', 'order': 3},
            {'key': 'security_deposit', 'name': 'Security Deposit (₹)', 'type': 'number', 'required': False, 'width': '50%', 'order': 4}
        ],
        'Additional Rental Specs': [
            {'key': 'site_address', 'name': 'Delivery / Site Address', 'type': 'textarea', 'required': False, 'width': '100%', 'order': 1}
        ]
    },
    'amc': {
        'Contract Info': [
            {'key': 'customer_id', 'name': 'Select Customer', 'type': 'select', 'required': True, 'width': '50%', 'order': 1},
            {'key': 'contract_title', 'name': 'Contract Title', 'type': 'text', 'required': True, 'width': '50%', 'order': 2},
            {'key': 'amc_value', 'name': 'Contract SLA Value (₹)', 'type': 'number', 'required': True, 'width': '100%', 'order': 3}
        ],
        'Service Schedule & Details': [
            {'key': 'start_date', 'name': 'Start Date', 'type': 'date', 'required': True, 'width': '33%', 'order': 1},
            {'key': 'end_date', 'name': 'End Date', 'type': 'date', 'required': True, 'width': '33%', 'order': 2},
            {'key': 'service_interval_days', 'name': 'Service Visit Interval (Days)', 'type': 'select', 'required': True, 'width': '34%', 'order': 3, 'options': ['30', '90', '180', '365']}
        ],
        'Covered Equipment Details': [
            {'key': 'machine_name', 'name': 'Machine Name', 'type': 'text', 'required': False, 'width': '50%', 'order': 1},
            {'key': 'machine_serial', 'name': 'Serial / Plate Number', 'type': 'text', 'required': False, 'width': '50%', 'order': 2},
            {'key': 'model', 'name': 'Model Number', 'type': 'text', 'required': False, 'width': '50%', 'order': 3},
            {'key': 'capacity', 'name': 'Machine Capacity', 'type': 'text', 'required': False, 'width': '50%', 'order': 4}
        ]
    },
    'customer': {
        'General Information': [
            {'key': 'name', 'name': 'Customer Name', 'type': 'text', 'required': True, 'width': '50%', 'order': 1},
            {'key': 'phone', 'name': 'Phone Number', 'type': 'text', 'required': True, 'width': '50%', 'order': 2},
            {'key': 'email', 'name': 'Email Address', 'type': 'text', 'required': False, 'width': '50%', 'order': 3},
            {'key': 'credit_limit', 'name': 'Credit Limit (INR)', 'type': 'number', 'required': False, 'width': '50%', 'order': 4},
            {'key': 'credit_period_days', 'name': 'Credit Period (Days)', 'type': 'number', 'required': False, 'width': '50%', 'order': 5},
            {'key': 'is_active', 'name': 'Set Account to Active', 'type': 'checkbox', 'required': False, 'width': '100%', 'order': 6}
        ],
        'Contact & Address': [
            {'key': 'address', 'name': 'Billing Address', 'type': 'text', 'required': False, 'width': '100%', 'order': 1},
            {'key': 'city', 'name': 'City', 'type': 'text', 'required': False, 'width': '33%', 'order': 2},
            {'key': 'state', 'name': 'State', 'type': 'text', 'required': False, 'width': '33%', 'order': 3},
            {'key': 'pincode', 'name': 'Pincode', 'type': 'text', 'required': False, 'width': '33%', 'order': 4}
        ],
        'Tax & Compliance': [
            {'key': 'gstin', 'name': 'GSTIN', 'type': 'text', 'required': False, 'width': '50%', 'order': 1},
            {'key': 'pan', 'name': 'PAN', 'type': 'text', 'required': False, 'width': '50%', 'order': 2},
            {'key': 'notes', 'name': 'Remarks / Notes', 'type': 'textarea', 'required': False, 'width': '100%', 'order': 3}
        ]
    },
    'invoice': {
        'Invoice Header & Notes': [
            {'key': 'invoice_no', 'name': 'Invoice Number', 'type': 'text', 'required': True, 'width': '50%', 'order': 1},
            {'key': 'invoice_date', 'name': 'Invoice Date', 'type': 'date', 'required': True, 'width': '50%', 'order': 2},
            {'key': 'notes', 'name': 'Terms & Notes', 'type': 'textarea', 'required': False, 'width': '100%', 'order': 3}
        ]
    }
}


def slugify_key(text):
    """Generate clean field_key from field label/name"""
    key = text.lower().strip()
    key = re.sub(r'[^\w\s-]', '', key)
    return re.sub(r'[-\s]+', '_', key)


def get_form_schema(tenant_id, entity_type, company_id=None):
    """Retrieve full dynamic form schema with sections and fields"""
    sections = CustomFormSection.query.filter_by(
        tenant_id=tenant_id,
        entity_type=entity_type,
        is_deleted=False
    ).order_by(CustomFormSection.sort_order.asc()).all()

    # Auto-seed default sections if none exist
    if not sections and entity_type in DEFAULT_SECTIONS:
        sections = seed_default_sections(tenant_id, entity_type, company_id)

    # Self-healing: seed missing static fields in existing sections if none exist
    has_any_static = False
    for sec in sections:
        for f in sec.fields:
            if not f.is_deleted and f.is_static:
                has_any_static = True
                break
        if has_any_static:
            break

    if not has_any_static and entity_type in DEFAULT_STATIC_FIELDS:
        for sec in sections:
            static_fields = DEFAULT_STATIC_FIELDS.get(entity_type, {}).get(sec.section_name, [])
            for f in static_fields:
                existing = CustomFormField.query.filter_by(
                    section_id=sec.id,
                    field_key=f['key'],
                    is_deleted=False
                ).first()
                if not existing:
                    field = CustomFormField(
                        tenant_id=tenant_id,
                        company_id=company_id,
                        section_id=sec.id,
                        field_key=f['key'],
                        field_name=f['name'],
                        field_type=f['type'],
                        is_required=f['required'],
                        is_static=True,
                        is_active=True,
                        width=f['width'],
                        sort_order=f['order'],
                        options_json=f.get('options', [])
                    )
                    db.session.add(field)
        db.session.commit()
        # Reload sections
        sections = CustomFormSection.query.filter_by(
            tenant_id=tenant_id,
            entity_type=entity_type,
            is_deleted=False
        ).order_by(CustomFormSection.sort_order.asc()).all()

    return [sec.to_dict() for sec in sections]


def seed_default_sections(tenant_id, entity_type, company_id=None):
    """Seeds baseline form sections and static fields if none exist for a tenant"""
    created_sections = []
    defaults = DEFAULT_SECTIONS.get(entity_type, [{'name': 'General Details', 'order': 1}])

    for item in defaults:
        sec = CustomFormSection(
            tenant_id=tenant_id,
            company_id=company_id,
            entity_type=entity_type,
            section_name=item['name'],
            sort_order=item['order']
        )
        db.session.add(sec)
        db.session.flush()
        created_sections.append(sec)

        # Seed default static fields for this section
        static_fields = DEFAULT_STATIC_FIELDS.get(entity_type, {}).get(item['name'], [])
        for f in static_fields:
            field = CustomFormField(
                tenant_id=tenant_id,
                company_id=company_id,
                section_id=sec.id,
                field_key=f['key'],
                field_name=f['name'],
                field_type=f['type'],
                is_required=f['required'],
                is_static=True,
                is_active=True,
                width=f['width'],
                sort_order=f['order'],
                options_json=f.get('options', [])
            )
            db.session.add(field)

    db.session.commit()
    return created_sections


def create_section(tenant_id, company_id, entity_type, section_name, sort_order=0):
    """Create a new dynamic form section"""
    section = CustomFormSection(
        tenant_id=tenant_id,
        company_id=company_id,
        entity_type=entity_type,
        section_name=section_name,
        sort_order=sort_order
    )
    db.session.add(section)
    db.session.commit()
    return section


def update_section(section_id, tenant_id, data):
    """Update section properties"""
    section = CustomFormSection.query.filter_by(id=section_id, tenant_id=tenant_id, is_deleted=False).first()
    if not section:
        return None

    if 'section_name' in data:
        section.section_name = data['section_name']
    if 'sort_order' in data:
        section.sort_order = data['sort_order']
    if 'is_collapsed' in data:
        section.is_collapsed = data['is_collapsed']
    if 'is_active' in data:
        section.is_active = data['is_active']

    db.session.commit()
    return section


def delete_section(section_id, tenant_id):
    """Soft delete section and its associated fields"""
    section = CustomFormSection.query.filter_by(id=section_id, tenant_id=tenant_id, is_deleted=False).first()
    if not section:
        return False

    section.soft_delete()
    for field in section.fields:
        field.soft_delete()

    db.session.commit()
    return True


def create_field(tenant_id, section_id, data):
    """Create a new custom form field inside a section"""
    section = CustomFormSection.query.filter_by(id=section_id, tenant_id=tenant_id, is_deleted=False).first()
    if not section:
        return None

    field_name = data.get('field_name', 'New Field')
    field_key = data.get('field_key') or slugify_key(field_name)

    field = CustomFormField(
        tenant_id=tenant_id,
        section_id=section.id,
        field_name=field_name,
        field_key=field_key,
        field_type=data.get('field_type', 'text'),
        placeholder=data.get('placeholder'),
        help_text=data.get('help_text'),
        options_json=data.get('options_json') or [],
        default_value=data.get('default_value'),
        is_required=data.get('is_required', False),
        is_active=data.get('is_active', True),
        is_static=data.get('is_static', False),
        width=data.get('width', '100%'),
        sort_order=data.get('sort_order', 0)
    )

    db.session.add(field)
    db.session.commit()
    return field


def update_field(field_id, tenant_id, data):
    """Update custom field definition"""
    field = CustomFormField.query.filter_by(id=field_id, tenant_id=tenant_id, is_deleted=False).first()
    if not field:
        return None

    updatable_fields = [
        'field_name', 'field_key', 'field_type', 'placeholder', 'help_text',
        'options_json', 'default_value', 'is_required', 'is_active', 'width', 'sort_order', 'section_id'
    ]

    for key in updatable_fields:
        if key in data:
            setattr(field, key, data[key])

    db.session.commit()
    return field


def delete_field(field_id, tenant_id):
    """Soft delete custom field"""
    field = CustomFormField.query.filter_by(id=field_id, tenant_id=tenant_id, is_deleted=False).first()
    if not field:
        return False

    if field.is_static:
        raise ValueError("Core system fields cannot be removed")

    field.soft_delete()
    db.session.commit()
    return True


def append_field_option(field_id, tenant_id, new_option):
    """
    Appends a new option to a select/multiselect field.
    Powers the inline '+' option creator modal in the UX.
    """
    from sqlalchemy.orm.attributes import flag_modified
    
    field = CustomFormField.query.filter_by(id=field_id, tenant_id=tenant_id, is_deleted=False).first()
    if not field:
        return None

    options = field.options_json or []
    if not isinstance(options, list):
        options = []

    # Check if option already exists
    option_str = str(new_option).strip()
    if option_str and option_str not in options:
        updated_options = list(options) + [option_str]
        field.options_json = updated_options
        flag_modified(field, "options_json")
        db.session.commit()

    return field


def reorder_sections_and_fields(tenant_id, entity_type, reorder_data):
    """
    Reorder sections and fields based on front-end drag-and-drop hierarchy payload.
    reorder_data: list of { id, sort_order, fields: [{ id, sort_order, section_id }] }
    """
    for sec_data in reorder_data:
        sec_id = sec_data.get('id')
        sec = CustomFormSection.query.filter_by(id=sec_id, tenant_id=tenant_id, entity_type=entity_type).first()
        if sec:
            sec.sort_order = sec_data.get('sort_order', sec.sort_order)
            
            for f_data in sec_data.get('fields', []):
                f_id = f_data.get('id')
                f = CustomFormField.query.filter_by(id=f_id, tenant_id=tenant_id).first()
                if f:
                    f.sort_order = f_data.get('sort_order', f.sort_order)
                    if 'section_id' in f_data:
                        f.section_id = f_data['section_id']

    db.session.commit()
    return True


def extract_custom_fields(entity_type, data):
    """
    Extracts all fields from `data` that are not part of the static schema for `entity_type`
    and returns them as a dictionary for the `custom_fields` JSON column.
    """
    static_keys = set()
    # Collect all static keys for this entity type
    for section_fields in DEFAULT_STATIC_FIELDS.get(entity_type, {}).values():
        for field in section_fields:
            static_keys.add(field['key'])
            
    # Standard metadata or system fields to ignore
    ignored_keys = {
        'id', 'created_at', 'updated_at', 'tenant_id', 'company_id', 'branch_id',
        'is_deleted', 'deleted_at', 'custom_fields', 'booking_number', 'total_rental_amount',
        'damage_charges', 'total_amount', 'billing_status', 'status', 'return_condition_notes',
        'agreement_document_url', 'invoice_number', 'invoice_date', 'due_date', 'type', 'subtotal',
        'discount_amount', 'discount_percent', 'cgst_amount', 'sgst_amount', 'igst_amount',
        'cess_amount', 'round_off', 'net_amount', 'payment_method', 'payment_status', 'outstanding_balance',
        'notes', 'terms_conditions', 'is_pos', 'items', 'customer', 'equipment', 'rate_type',
        'last_invoice_date', 'next_invoice_date', 'billing_frequency', 'start_date', 'end_date'
    }
    
    custom = {}
    for k, v in data.items():
        if k not in static_keys and k not in ignored_keys:
            custom[k] = v
    return custom

