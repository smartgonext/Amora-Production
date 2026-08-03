"""
PDF Generation Utility — Using ReportLab
Provides functions to generate PDFs for invoices, reports, and documents.
"""
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.units import inch, mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.pdfgen import canvas
from io import BytesIO
from datetime import datetime
import os


def generate_invoice_pdf(invoice_data, template_settings=None):
    """
    Generate PDF for an invoice.
    
    Args:
        invoice_data (dict): Invoice details (invoice_number, date, customer, items, totals)
        template_settings (dict): Template configuration from setup wizard
    
    Returns:
        BytesIO: PDF file buffer
    """
    if template_settings and template_settings.get('layout_json'):
        return generate_coordinate_pdf(invoice_data, template_settings['layout_json'])

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles for better readability
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=30,
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#2d3748'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#4a5568'),
        fontName='Helvetica'
    )
    
    # Company logo (if provided)
    if template_settings and template_settings.get('logo_path'):
        try:
            logo = Image(template_settings['logo_path'], width=2*inch, height=1*inch)
            story.append(logo)
            story.append(Spacer(1, 12))
        except:
            pass
    
    # Title
    story.append(Paragraph(f"INVOICE #{invoice_data.get('invoice_number', 'N/A')}", title_style))
    story.append(Spacer(1, 12))
    
    # Company details
    company = invoice_data.get('company', {})
    company_info = f"""
    <b>{company.get('name', 'Company Name')}</b><br/>
    {company.get('address', 'Address')}<br/>
    GST: {company.get('gst_number', 'N/A')}<br/>
    Phone: {company.get('phone', 'N/A')}
    """
    story.append(Paragraph(company_info, body_style))
    story.append(Spacer(1, 20))
    
    # Customer details
    story.append(Paragraph("BILL TO:", heading_style))
    customer = invoice_data.get('customer', {})
    customer_info = f"""
    <b>{customer.get('name', 'Customer Name')}</b><br/>
    {customer.get('address', 'Address')}<br/>
    Phone: {customer.get('phone', 'N/A')}<br/>
    GST: {customer.get('gst_number', 'N/A')}
    """
    story.append(Paragraph(customer_info, body_style))
    story.append(Spacer(1, 20))
    
    # Invoice metadata
    invoice_date = invoice_data.get('invoice_date', datetime.now().strftime('%Y-%m-%d'))
    due_date = invoice_data.get('due_date', '')
    meta_data = [
        ['Invoice Date:', invoice_date],
        ['Due Date:', due_date],
        ['Payment Terms:', invoice_data.get('payment_terms', 'Net 30')]
    ]
    meta_table = Table(meta_data, colWidths=[2*inch, 3*inch])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#4a5568')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 20))
    
    # Line items table
    story.append(Paragraph("ITEMS:", heading_style))
    items = invoice_data.get('items', [])
    
    # Table header
    table_data = [['#', 'Description', 'HSN', 'Qty', 'Rate', 'Tax', 'Amount']]
    
    # Table rows
    for idx, item in enumerate(items, 1):
        table_data.append([
            str(idx),
            item.get('product_name', ''),
            item.get('hsn_code', ''),
            str(item.get('quantity', 0)),
            f"₹{item.get('rate', 0):.2f}",
            f"{item.get('tax_rate', 0)}%",
            f"₹{item.get('total', 0):.2f}"
        ])
    
    items_table = Table(table_data, colWidths=[0.5*inch, 2.5*inch, 1*inch, 0.7*inch, 1*inch, 0.8*inch, 1.2*inch])
    items_table.setStyle(TableStyle([
        # Header style
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d3748')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        
        # Body style
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#4a5568')),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 20))
    
    # Totals section
    totals = invoice_data.get('totals', {})
    totals_data = [
        ['Subtotal:', f"₹{totals.get('subtotal', 0):.2f}"],
        ['CGST:', f"₹{totals.get('cgst', 0):.2f}"],
        ['SGST:', f"₹{totals.get('sgst', 0):.2f}"],
        ['IGST:', f"₹{totals.get('igst', 0):.2f}"],
        ['Discount:', f"-₹{totals.get('discount', 0):.2f}"],
        ['<b>TOTAL:</b>', f"<b>₹{totals.get('total', 0):.2f}</b>"]
    ]
    
    totals_table = Table(totals_data, colWidths=[4*inch, 2*inch])
    totals_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -2), 'Helvetica'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2d3748')),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LINEABOVE', (0, -1), (-1, -1), 2, colors.HexColor('#2d3748')),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 30))
    
    # Terms & conditions
    if template_settings and template_settings.get('show_terms'):
        story.append(Paragraph("Terms & Conditions:", heading_style))
        terms = template_settings.get('terms_text', 'Payment due within 30 days.')
        story.append(Paragraph(terms, body_style))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer


def generate_report_pdf(report_data, report_title="Report", company_data=None):
    """
    Generate PDF for a report.
    
    Args:
        report_data (list): List of dictionaries containing report rows
        report_title (str): Title of the report
        company_data (dict): Company branding data (name, logo_path, address, etc.)
    
    Returns:
        BytesIO: PDF file buffer
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm)
    story = []
    styles = getSampleStyleSheet()
    
    # Company branding header
    if company_data:
        # Company logo
        if company_data.get('logo_path') and os.path.exists(company_data['logo_path']):
            try:
                logo = Image(company_data['logo_path'], width=1.5*inch, height=1*inch)
                story.append(logo)
                story.append(Spacer(1, 8))
            except:
                pass
        
        # Company name and details
        company_style = ParagraphStyle(
            'CompanyStyle',
            parent=styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor('#1a1a1a'),
            fontName='Helvetica-Bold',
            spaceAfter=4
        )
        
        details_style = ParagraphStyle(
            'DetailsStyle',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#4a5568'),
            fontName='Helvetica'
        )
        
        story.append(Paragraph(company_data.get('name', ''), company_style))
        
        # Address line
        address_parts = []
        if company_data.get('address'):
            address_parts.append(company_data['address'])
        if company_data.get('city'):
            address_parts.append(company_data['city'])
        if company_data.get('state'):
            address_parts.append(company_data['state'])
        if company_data.get('pincode'):
            address_parts.append(company_data['pincode'])
        
        if address_parts:
            story.append(Paragraph(', '.join(address_parts), details_style))
        
        # Contact and GST line
        contact_parts = []
        if company_data.get('gstin'):
            contact_parts.append(f"GST: {company_data['gstin']}")
        if company_data.get('phone'):
            contact_parts.append(f"Phone: {company_data['phone']}")
        if company_data.get('email'):
            contact_parts.append(f"Email: {company_data['email']}")
        
        if contact_parts:
            story.append(Paragraph(' | '.join(contact_parts), details_style))
        
        story.append(Spacer(1, 20))
        
        # Separator line
        from reportlab.platypus import HRFlowable
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0')))
        story.append(Spacer(1, 20))
    
    # Title
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )
    story.append(Paragraph(report_title, title_style))
    story.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Data table
    if report_data and len(report_data) > 0:
        # Extract headers from first row
        headers = list(report_data[0].keys())
        table_data = [headers]
        
        # Add data rows
        for row in report_data:
            table_data.append([str(row.get(h, '')) for h in headers])
        
        # Calculate column widths dynamically
        col_count = len(headers)
        col_width = (A4[0] - 40*mm) / col_count
        
        report_table = Table(table_data, colWidths=[col_width] * col_count)
        report_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d3748')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#4a5568')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(report_table)
    else:
        story.append(Paragraph("No data available", styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer


def generate_simple_pdf(content, title="Document"):
    """
    Generate a simple PDF document.
    
    Args:
        content (str): Text content
        title (str): Document title
    
    Returns:
        BytesIO: PDF file buffer
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    story = []
    styles = getSampleStyleSheet()
    
    story.append(Paragraph(title, styles['Title']))
    story.append(Spacer(1, 12))
    story.append(Paragraph(content, styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    return buffer


def generate_coordinate_pdf(document_data, layout_json):
    """
    Generate PDF using percentage-based coordinate layout saved from MS Word Template Designer.
    Translates percentage coordinates to ReportLab points on A4 page (595.27 x 841.89 pt).
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width_pts, height_pts = A4

    elements = layout_json.get('elements', []) if isinstance(layout_json, dict) else []
    elements.sort(key=lambda e: e.get('z_index', 1))

    for el in elements:
        el_type = el.get('type', 'text')
        x_pct = el.get('x_pct', 0)
        y_pct = el.get('y_pct', 0)
        w_pct = el.get('w_pct', 10)
        h_pct = el.get('h_pct', 5)

        x_pts = (x_pct / 100.0) * width_pts
        w_pts = (w_pct / 100.0) * width_pts
        h_pts = (h_pct / 100.0) * height_pts
        # Canvas origin is bottom-left; top-left y_pct converts as:
        y_pts = height_pts - ((y_pct / 100.0) * height_pts) - h_pts

        if el_type == 'text':
            text = el.get('text', '')
            for key, val in document_data.items():
                if isinstance(val, (str, int, float)):
                    text = text.replace(f'{{{{{key}}}}}', str(val))
            
            font_name = el.get('font', 'Helvetica')
            if el.get('bold'):
                font_name = 'Helvetica-Bold' if font_name == 'Helvetica' else font_name
            font_size = el.get('size', 12)
            c.setFont(font_name, font_size)

            hex_color = el.get('color', '#000000')
            try:
                c.setFillColor(colors.HexColor(hex_color))
            except:
                c.setFillColor(colors.black)

            align = el.get('align', 'left')
            if align == 'center':
                c.drawCentredString(x_pts + (w_pts / 2.0), y_pts + (h_pts / 3.0), text)
            elif align == 'right':
                c.drawRightString(x_pts + w_pts, y_pts + (h_pts / 3.0), text)
            else:
                c.drawString(x_pts, y_pts + (h_pts / 3.0), text)

        elif el_type == 'image':
            img_url = el.get('image_url', '')
            opacity = el.get('opacity', 100) / 100.0
            if img_url and os.path.exists(img_url):
                try:
                    c.saveState()
                    if hasattr(c, 'setFillAlpha'):
                        c.setFillAlpha(opacity)
                    c.drawImage(img_url, x_pts, y_pts, width=w_pts, height=h_pts, preserveAspectRatio=True, mask='auto')
                    c.restoreState()
                except:
                    pass
            else:
                c.setStrokeColor(colors.HexColor('#cbd5e1'))
                c.setFillColor(colors.HexColor('#f8fafc'))
                c.rect(x_pts, y_pts, w_pts, h_pts, fill=1, stroke=1)
                c.setFont("Helvetica", 9)
                c.setFillColor(colors.HexColor('#64748b'))
                c.drawCentredString(x_pts + (w_pts / 2.0), y_pts + (h_pts / 2.0), "[ Image Asset ]")

        elif el_type == 'table':
            items = document_data.get('items', [])
            table_data = [['Item', 'Qty', 'Rate', 'Amount']]
            for item in items:
                table_data.append([
                    str(item.get('product_name', item.get('description', 'Item'))),
                    str(item.get('quantity', 1)),
                    f"₹{float(item.get('rate', 0)):.2f}",
                    f"₹{float(item.get('total', 0)):.2f}"
                ])
            if len(table_data) == 1:
                table_data.append(['Sample Item', '1', '₹100.00', '₹100.00'])

            t = Table(table_data, colWidths=[w_pts * 0.4, w_pts * 0.15, w_pts * 0.2, w_pts * 0.25])
            header_bg = el.get('header_bg', '#1e293b')
            header_txt = el.get('header_text_color', '#ffffff')
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(header_bg)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor(header_txt)),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ]))
            t.wrapOn(c, w_pts, h_pts)
            t.drawOn(c, x_pts, y_pts)

        elif el_type == 'signature':
            c.setStrokeColor(colors.HexColor('#94a3b8'))
            c.line(x_pts, y_pts + 15, x_pts + w_pts, y_pts + 15)
            c.setFont("Helvetica", 9)
            c.setFillColor(colors.HexColor('#334155'))
            c.drawCentredString(x_pts + (w_pts / 2.0), y_pts, el.get('text', 'Authorized Signatory'))

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer

