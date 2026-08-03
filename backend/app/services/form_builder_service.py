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
        {'name': 'Equipment Details', 'order': 1},
        {'name': 'Rental Rates & Deposit', 'order': 2},
        {'name': 'Maintenance & Operational Specs', 'order': 3}
    ],
    'amc': [
        {'name': 'Contract Info', 'order': 1},
        {'name': 'Service Schedule & Coverage', 'order': 2},
        {'name': 'Custom Contract Terms', 'order': 3}
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

    return [sec.to_dict() for sec in sections]


def seed_default_sections(tenant_id, entity_type, company_id=None):
    """Seeds baseline form sections if none exist for a tenant"""
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
        created_sections.append(sec)

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
