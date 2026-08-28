"""
Default document templates for the Visual Template Designer.

Every document type ships with a complete, non-empty default design so the
template canvas is never blank when a company first opens it. Companies can
still open the Template Designer and change / save their own layout — the
defaults below are just the starting point returned by
GET /api/v1/setup/templates/<doc_type> when no custom template exists yet.

The blueprints use the percentage-based coordinate element schema consumed by:
  - frontend/src/pages/settings/TemplateDesignerPage.jsx  (layout_json.elements)
  - backend/app/utils/pdf.py :: generate_coordinate_pdf()  (layout_json.elements)

Element types:
  - text:       { type, x_pct, y_pct, w_pct, h_pct, z_index, text, font, size,
                  color, align, bold, italic, underline }
  - image:      { type, x_pct, y_pct, w_pct, h_pct, z_index, image_url, opacity }
  - table:      { type, x_pct, y_pct, w_pct, h_pct, z_index, columns,
                  header_bg, header_text_color }
  - signature:  { type, x_pct, y_pct, w_pct, h_pct, z_index, text, font, size,
                  color, align }
"""

CANVAS_W = 595
CANVAS_H = 842


def _blueprint(elements):
    return {
        "canvas_width": CANVAS_W,
        "canvas_height": CANVAS_H,
        "elements": elements,
    }


def _text(eid, x, y, w, h, z, text, size=12, align="left", bold=False,
          font="Helvetica", color="#111827"):
    return {
        "id": eid, "type": "text", "x_pct": x, "y_pct": y, "w_pct": w, "h_pct": h,
        "z_index": z, "text": text, "font": font, "size": size, "color": color,
        "align": align, "bold": bold, "italic": False, "underline": False,
    }


def _image(eid, x, y, w, h, z, url, opacity=100):
    return {
        "id": eid, "type": "image", "x_pct": x, "y_pct": y, "w_pct": w, "h_pct": h,
        "z_index": z, "image_url": url, "opacity": opacity,
    }


def _table(eid, x, y, w, h, z, columns):
    return {
        "id": eid, "type": "table", "x_pct": x, "y_pct": y, "w_pct": w, "h_pct": h,
        "z_index": z, "columns": columns, "header_bg": "#1e293b",
        "header_text_color": "#ffffff",
    }


def _signature(eid, x, y, w, h, z, text="Authorized Signatory"):
    return {
        "id": eid, "type": "signature", "x_pct": x, "y_pct": y, "w_pct": w, "h_pct": h,
        "z_index": z, "text": text, "font": "Courier", "size": 13,
        "color": "#334155", "align": "center",
    }


# ── Shared building blocks ─────────────────────────────────────────────────

def _header_meta(doc_title, meta_lines):
    """Company header (logo + name + contact) + document title + meta block."""
    return [
        _image("logo", 4, 5, 13, 11, 1, "{{company_logo}}"),
        _text("company_name", 20, 5, 55, 6, 2, "{{company_name}}", size=16,
              bold=True, color="#0f172a"),
        _text("company_contact", 20, 12, 60, 8, 3,
              "{{company_address}}  |  GSTIN: {{company_gstin}}  |  {{company_phone}}",
              size=9, color="#475569"),
        _text("doc_title", 62, 22, 34, 7, 4, doc_title, size=22, align="center",
              bold=True, color="#111827"),
        _text("doc_meta", 60, 30, 36, 12, 5, meta_lines, size=10, align="right",
              color="#374151"),
    ]


def _bill_to(title_label):
    return [
        _text("bill_label", 4, 35, 40, 4, 6, title_label, size=11, bold=True,
              color="#1e293b"),
        _text("bill_to", 4, 39, 42, 9, 7, "{{customer_name}}\n{{customer_address}}",
              size=10, color="#334155"),
    ]


def _amount_summary():
    return [
        _text("sum_subtotal", 60, 76, 36, 3.5, 9,
              "Subtotal:  ₹{{subtotal}}", size=10, align="right", color="#334155"),
        _text("sum_discount", 60, 79.5, 36, 3.5, 10,
              "Discount:  ₹{{discount}}", size=10, align="right", color="#334155"),
        _text("sum_tax", 60, 83, 36, 3.5, 11,
              "Tax Total:  ₹{{tax_total}}", size=10, align="right", color="#334155"),
        _text("sum_grand", 60, 87, 36, 4, 12, "TOTAL:  ₹{{total}}",
              size=14, align="right", bold=True, color="#0f172a"),
        _text("sum_words", 4, 88, 55, 5, 13,
              "( {{amount_in_words}} )", size=10, color="#475569"),
    ]


def _footer():
    return [
        _text("footer", 4, 95, 92, 4, 14, "{{footer_text}}",
              size=9, align="center", color="#64748b"),
    ]

# ── Per document type defaults ─────────────────────────────────────────────

def invoice_default():
    return _blueprint(
        _header_meta("INVOICE",
                     "Invoice No : {{invoice_number}}\nDate       : {{invoice_date}}"
                     "\nDue Date : {{due_date}}")
        + _bill_to("BILL TO")
        + [
            _table("items", 4, 46, 92, 26, 8, ["Item", "Qty", "Rate", "Amount"]),
        ]
        + _amount_summary()
        + [_signature("signature", 62, 90, 30, 6, 14)]
        + _footer()
    )


def quotation_default():
    return _blueprint(
        _header_meta("QUOTATION",
                     "Quote No  : {{quotation_number}}\nDate       : {{quotation_date}}"
                     "\nValid Till : {{valid_until}}")
        + _bill_to("TO")
        + [
            _table("items", 4, 46, 92, 26, 8, ["Item", "Qty", "Rate", "Amount"]),
        ]
        + _amount_summary()
        + [_signature("signature", 62, 90, 30, 6, 14)]
        + [_text("terms", 4, 92, 92, 3.5, 15, "Terms & Conditions: {{terms}}",
                 size=9, color="#64748b")]
        + _footer()
    )


def agreement_default():
    return _blueprint(
        _header_meta("SERVICE AGREEMENT",
                     "Agreement No : {{agreement_number}}\nDate           : {{agreement_date}}"
                     "\nParty           : {{customer_name}}")
        + [
            _text("sec_head", 4, 46, 92, 4, 8, "1. Parties", size=11, bold=True,
                  color="#1e293b"),
            _text("sec_parties", 4, 50, 92, 8, 9,
                  "This agreement is made between {{company_name}} (\"Provider\") "
                  "and {{customer_name}} (\"Client\").", size=10, color="#334155"),
            _text("sec_head2", 4, 60, 92, 4, 10, "2. Scope of Work", size=11,
                  bold=True, color="#1e293b"),
            _text("sec_scope", 4, 64, 92, 8, 11,
                  "The Provider agrees to render the services as described and "
                  "the Client agrees to the terms herein.", size=10, color="#334155"),
            _text("sec_head3", 4, 74, 92, 4, 12, "3. Terms", size=11, bold=True,
                  color="#1e293b"),
            _text("sec_terms", 4, 78, 92, 6, 13, "{{terms}}", size=10, color="#334155"),
        ]
        + [
            _signature("sign_left", 12, 90, 30, 6, 14, "For {{company_name}}"),
            _signature("sign_right", 58, 90, 30, 6, 15, "For {{customer_name}}"),
        ]
        + _footer()
    )


def receipt_default():
    return _blueprint(
        [
            _image("logo", 4, 5, 13, 11, 1, "{{company_logo}}"),
            _text("company_name", 20, 7, 55, 6, 2, "{{company_name}}", size=16,
                  bold=True, color="#0f172a"),
            _text("doc_title", 60, 26, 36, 7, 4, "PAYMENT RECEIPT", size=20,
                  align="center", bold=True, color="#111827"),
            _text("doc_meta", 60, 34, 36, 12, 5,
                  "Receipt No : {{receipt_number}}\nDate        : {{receipt_date}}"
                  "\nMode       : {{payment_method}}", size=10, align="right",
                  color="#374151"),
            _text("receipt_from", 4, 40, 40, 9, 6,
                  "Received from: {{customer_name}}\n{{customer_address}}",
                  size=10, color="#334155"),
            _text("amount_received", 4, 56, 92, 7, 7,
                  "Amount Received:  ₹{{amount_received}}", size=18, bold=True,
                  color="#0f172a"),
            _text("amount_words", 4, 63, 92, 5, 8,
                  "In Words : {{amount_in_words}}", size=10, color="#475569"),
            _text("against", 4, 70, 92, 5, 9,
                  "Against : {{against_reference}}", size=10, color="#475569"),
        ]
        + [_signature("signature", 62, 88, 30, 6, 10)]
        + _footer()
    )


def purchase_order_default():
    return _blueprint(
        _header_meta("PURCHASE ORDER",
                     "PO No        : {{po_number}}\nOrder Date : {{po_date}}"
                     "\nExpected   : {{expected_date}}")
        + [
            _text("supplier_label", 4, 35, 40, 4, 6, "SUPPLIER", size=11, bold=True,
                  color="#1e293b"),
            _text("supplier_to", 4, 39, 42, 8, 7, "{{supplier_name}}\n{{supplier_address}}",
                  size=10, color="#334155"),
            _table("items", 4, 48, 92, 24, 8, ["Item", "Qty", "Rate", "Amount"]),
        ]
        + _amount_summary()
        + [_signature("signature", 62, 90, 30, 6, 14)]
        + _footer()
    )


def delivery_challan_default():
    return _blueprint(
        _header_meta("DELIVERY CHALLAN",
                     "DC No      : {{challan_number}}\nDate        : {{challan_date}}"
                     "\nRef        : {{reference}}")
        + [
            _text("ship_label", 4, 35, 40, 4, 6, "DELIVER TO", size=11, bold=True,
                  color="#1e293b"),
            _text("ship_to", 4, 39, 42, 8, 7, "{{customer_name}}\n{{customer_address}}",
                  size=10, color="#334155"),
            _text("vehicle", 58, 35, 38, 8, 8, "Vehicle No : {{vehicle_number}}",
                  size=10, align="right", color="#374151"),
            _table("items", 4, 48, 92, 24, 9, ["Item", "Qty", "Unit", "Remarks"]),
        ]
        + [
            _signature("sign_left", 12, 88, 30, 6, 14, "Received By"),
            _signature("sign_right", 58, 88, 30, 6, 15, "Prepared By"),
        ]
        + _footer()
    )


DEFAULT_BLUEPRINTS = {
    "invoice": invoice_default,
    "quotation": quotation_default,
    "agreement": agreement_default,
    "receipt": receipt_default,
    "purchase_order": purchase_order_default,
    "delivery_challan": delivery_challan_default,
}

