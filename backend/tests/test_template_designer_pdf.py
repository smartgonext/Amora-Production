import pytest
import sys
import os
from io import BytesIO

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.utils.pdf import generate_coordinate_pdf, generate_report_pdf
from app.utils.excel import export_report_to_excel


def test_generate_coordinate_pdf():
    """Test ReportLab coordinate PDF generation from visual percentage blueprint"""
    document_data = {
        'company_name': 'SmartGoNext Solutions',
        'customer_name': 'Acme Corp',
        'invoice_number': 'INV-2026-001',
        'total': '15,000.00',
        'items': [
            {'product_name': 'ERP Software License', 'quantity': 1, 'rate': 10000, 'total': 10000},
            {'product_name': 'Setup & Onboarding Service', 'quantity': 1, 'rate': 5000, 'total': 5000}
        ]
    }

    layout_json = {
        'canvas_width': 595,
        'canvas_height': 842,
        'elements': [
            {
                'type': 'text',
                'text': 'INVOICE: {{invoice_number}}',
                'x_pct': 10,
                'y_pct': 5,
                'w_pct': 50,
                'h_pct': 5,
                'font': 'Helvetica-Bold',
                'size': 18,
                'color': '#1e293b',
                'z_index': 1
            },
            {
                'type': 'text',
                'text': 'Customer: {{customer_name}}',
                'x_pct': 10,
                'y_pct': 12,
                'w_pct': 40,
                'h_pct': 4,
                'font': 'Helvetica',
                'size': 11,
                'color': '#475569',
                'z_index': 2
            },
            {
                'type': 'table',
                'x_pct': 10,
                'y_pct': 20,
                'w_pct': 80,
                'h_pct': 30,
                'header_bg': '#0f172a',
                'header_text_color': '#ffffff',
                'z_index': 3
            },
            {
                'type': 'signature',
                'text': 'Authorized Representative',
                'x_pct': 60,
                'y_pct': 80,
                'w_pct': 30,
                'h_pct': 10,
                'z_index': 4
            }
        ]
    }

    pdf_buffer = generate_coordinate_pdf(document_data, layout_json)
    assert pdf_buffer is not None
    pdf_bytes = pdf_buffer.getvalue()
    assert len(pdf_bytes) > 0
    assert pdf_bytes.startswith(b'%PDF-')


def test_generate_report_pdf_and_excel():
    """Test generating tabular PDF and Excel reports for Step 6"""
    report_data = [
        {'Date': '2026-08-01', 'Invoices': 5, 'Sales': '₹25,000.00', 'Tax': '₹4,500.00'},
        {'Date': '2026-08-02', 'Invoices': 8, 'Sales': '₹42,000.00', 'Tax': '₹7,560.00'}
    ]

    pdf_buf = generate_report_pdf(report_data, report_title="Daily Sales Summary")
    assert pdf_buf is not None
    assert pdf_buf.getvalue().startswith(b'%PDF-')

    excel_buf = export_report_to_excel(report_data, report_title="Daily Sales Summary")
    assert excel_buf is not None
    assert len(excel_buf.getvalue()) > 0
