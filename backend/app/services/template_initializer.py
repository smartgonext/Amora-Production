from app.extensions import db
from app.models.template import (
    InvoiceTemplate, AgreementTemplate, ReceiptTemplate,
    QuotationTemplate, PurchaseOrderTemplate, DeliveryChallanTemplate
)
from app.utils.default_templates import DEFAULT_BLUEPRINTS

def seed_default_templates(tenant_id, company_id, commit=False):
    """Seed default visual templates for a company"""
    template_models = {
        'invoice': InvoiceTemplate,
        'agreement': AgreementTemplate,
        'receipt': ReceiptTemplate,
        'quotation': QuotationTemplate,
        'purchase_order': PurchaseOrderTemplate,
        'delivery_challan': DeliveryChallanTemplate
    }
    
    default_html_map = {
        'invoice': '<h3>INVOICE</h3><p><strong>Billed To:</strong> {Customer}</p><p><strong>Date:</strong> {Date}</p><p><strong>Grand Total:</strong> {Amount}</p><hr/><p>Thank you for your business!</p>',
        'agreement': '<h3>LEASE AGREEMENT</h3><p>This contract confirms equipment leasing terms to <strong>{Customer}</strong> commencing on {Date}.</p><p><strong>Agreed Amount:</strong> {Amount}</p><hr/><p>Authorized Signature: __________________</p>',
        'receipt': '<h3>RECEIPT</h3><p>Received payment from {Customer} on {Date}.</p><p><strong>Paid Sum:</strong> {Amount}</p>',
        'quotation': '<h3>QUOTATION ESTIMATE</h3><p>Quote valid for {Customer} for 30 days starting {Date}.</p><p><strong>Estimated Quote:</strong> {Amount}</p>',
        'purchase_order': '<h3>PURCHASE ORDER</h3><p>Issued to Supplier for purchase requisition on {Date}.</p><p><strong>PO Total:</strong> {Amount}</p>',
        'delivery_challan': '<h3>DELIVERY CHALLAN</h3><p>Goods receipt dispatch verification for {Customer} on {Date}.</p>'
    }
    
    seeded_any = False
    for doc_type, model_class in template_models.items():
        # Check if already exists to avoid duplicate seeding
        existing = model_class.query.filter_by(company_id=company_id).first()
        if not existing:
            builder = DEFAULT_BLUEPRINTS.get(doc_type)
            layout_json = builder() if builder else {"canvas_width": 595, "canvas_height": 842, "elements": []}
            
            template = model_class(
                tenant_id=tenant_id,
                company_id=company_id,
                name="Default Visual Template",
                template_html=default_html_map.get(doc_type),
                layout_json=layout_json,
                is_default=True
            )
            
            # For InvoiceTemplate, also set standard parameters
            if doc_type == 'invoice':
                template.layout = 'A4'
                template.show_logo = True
                template.show_gst_breakdown = True
                template.show_terms = True
                template.show_signature = True
                template.show_qr_code = False
                
            db.session.add(template)
            seeded_any = True
            
    if seeded_any and commit:
        db.session.commit()
