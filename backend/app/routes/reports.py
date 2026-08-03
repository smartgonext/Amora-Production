"""Reports Module API - Phase 6: 100+ standard ERP reports"""
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from app.extensions import db
from app.models.user import User
from app.models.sales import Invoice, SalesOrder, Quotation
from app.models.product import Product, ProductCategory, StockLedger, PurchaseOrder, PurchaseItem
from app.models.customer import Customer, CustomerLedger, Supplier, SupplierLedger
from app.models.finance import ChartOfAccount, JournalEntry, JournalEntryLine, Expense, ExpenseCategory
from app.models.equipment import Equipment, RentalBooking
from app.models.amc import AMCContract, AMCServiceSchedule
from sqlalchemy import func, extract
from app.utils.pdf import generate_report_pdf
from app.utils.excel import export_to_excel, export_report_to_excel

reports_bp = Blueprint('reports', __name__)


def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))


def parse_date_params():
    """Extract date range from query params with defaults"""
    today = datetime.utcnow()
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    if start_date_str:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
    else:
        start_date = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    if end_date_str:
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1)
    else:
        end_date = today
    
    return start_date, end_date


# ============================================================
# SALES REPORTS
# ============================================================

@reports_bp.route('/sales/daily', methods=['GET'])
@jwt_required()
def daily_sales():
    """Daily sales summary"""
    user = get_current_user()
    start_date, end_date = parse_date_params()
    
    result = db.session.query(
        func.date(Invoice.invoice_date).label('date'),
        func.count(Invoice.id).label('invoice_count'),
        func.sum(Invoice.net_amount).label('total_sales'),
        func.sum(Invoice.cgst_amount + Invoice.sgst_amount + Invoice.igst_amount).label('total_tax')
    ).filter(
        Invoice.tenant_id == user.tenant_id,
        Invoice.invoice_date >= start_date,
        Invoice.invoice_date < end_date,
        Invoice.is_deleted == False
    ).group_by(func.date(Invoice.invoice_date)).order_by(func.date(Invoice.invoice_date)).all()
    
    return jsonify({
        "data": [{
            "date": str(r.date),
            "invoice_count": int(r.invoice_count),
            "total_sales": float(r.total_sales or 0),
            "total_tax": float(r.total_tax or 0)
        } for r in result],
        "meta": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        "errors": None
    }), 200


@reports_bp.route('/sales/by-customer', methods=['GET'])
@jwt_required()
def sales_by_customer():
    """Sales grouped by customer"""
    user = get_current_user()
    start_date, end_date = parse_date_params()
    
    result = db.session.query(
        Customer.name.label('customer_name'),
        func.count(Invoice.id).label('invoice_count'),
        func.sum(Invoice.net_amount).label('total_sales'),
        func.sum(Invoice.net_amount - Invoice.subtotal).label('total_tax')
    ).join(Invoice, Customer.id == Invoice.customer_id).filter(
        Invoice.tenant_id == user.tenant_id,
        Invoice.invoice_date >= start_date,
        Invoice.invoice_date < end_date,
        Invoice.is_deleted == False,
        Customer.is_deleted == False
    ).group_by(Customer.id).order_by(func.sum(Invoice.net_amount).desc()).all()
    
    return jsonify({
        "data": [{
            "customer_name": r.customer_name,
            "invoice_count": int(r.invoice_count),
            "total_sales": float(r.total_sales or 0),
            "total_tax": float(r.total_tax or 0)
        } for r in result],
        "meta": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        "errors": None
    }), 200


@reports_bp.route('/sales/by-product', methods=['GET'])
@jwt_required()
def sales_by_product():
    """Sales grouped by product"""
    user = get_current_user()
    start_date, end_date = parse_date_params()
    
    from app.models.sales import InvoiceItem
    result = db.session.query(
        Product.name.label('product_name'),
        ProductCategory.name.label('category_name'),
        func.sum(InvoiceItem.quantity).label('total_qty'),
        func.sum(InvoiceItem.total_amount).label('total_amount')
    ).join(Product, InvoiceItem.product_id == Product.id)\
     .join(ProductCategory, Product.category_id == ProductCategory.id, isouter=True)\
     .join(Invoice, InvoiceItem.invoice_id == Invoice.id).filter(
        Invoice.tenant_id == user.tenant_id,
        Invoice.invoice_date >= start_date,
        Invoice.invoice_date < end_date,
        Invoice.is_deleted == False,
        InvoiceItem.is_deleted == False
    ).group_by(Product.id).order_by(func.sum(InvoiceItem.total_amount).desc()).all()
    
    return jsonify({
        "data": [{
            "product_name": r.product_name,
            "category": r.category_name,
            "total_quantity": int(r.total_qty or 0),
            "total_amount": float(r.total_amount or 0)
        } for r in result],
        "meta": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        "errors": None
    }), 200


@reports_bp.route('/sales/trend', methods=['GET'])
@jwt_required()
def sales_trend():
    """Monthly sales trend"""
    user = get_current_user()
    
    result = db.session.query(
        extract('year', Invoice.invoice_date).label('year'),
        extract('month', Invoice.invoice_date).label('month'),
        func.count(Invoice.id).label('invoice_count'),
        func.sum(Invoice.net_amount).label('total_sales')
    ).filter(
        Invoice.tenant_id == user.tenant_id,
        Invoice.is_deleted == False,
        Invoice.invoice_date >= datetime.utcnow() - timedelta(days=365)
    ).group_by(
        extract('year', Invoice.invoice_date),
        extract('month', Invoice.invoice_date)
    ).order_by(
        extract('year', Invoice.invoice_date),
        extract('month', Invoice.invoice_date)
    ).all()
    
    return jsonify({
        "data": [{
            "year": int(r.year),
            "month": int(r.month),
            "month_name": datetime(2000, int(r.month), 1).strftime('%b'),
            "invoice_count": int(r.invoice_count),
            "total_sales": float(r.total_sales or 0)
        } for r in result],
        "meta": None,
        "errors": None
    }), 200


# ============================================================
# PURCHASE REPORTS
# ============================================================

@reports_bp.route('/purchases/by-supplier', methods=['GET'])
@jwt_required()
def purchases_by_supplier():
    """Purchase grouped by supplier"""
    user = get_current_user()
    start_date, end_date = parse_date_params()
    
    result = db.session.query(
        Supplier.name.label('supplier_name'),
        func.count(PurchaseOrder.id).label('po_count'),
        func.sum(PurchaseOrder.total_amount).label('total_purchases')
    ).join(PurchaseOrder, Supplier.id == PurchaseOrder.supplier_id).filter(
        PurchaseOrder.tenant_id == user.tenant_id,
        PurchaseOrder.order_date >= start_date,
        PurchaseOrder.order_date < end_date,
        PurchaseOrder.is_deleted == False,
        Supplier.is_deleted == False
    ).group_by(Supplier.id).order_by(func.sum(PurchaseOrder.total_amount).desc()).all()
    
    return jsonify({
        "data": [{
            "supplier_name": r.supplier_name,
            "po_count": int(r.po_count),
            "total_purchases": float(r.total_purchases or 0)
        } for r in result],
        "meta": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        "errors": None
    }), 200


# ============================================================
# PROFIT REPORTS
# ============================================================

@reports_bp.route('/profit/gross', methods=['GET'])
@jwt_required()
def gross_profit():
    """Gross profit calculation"""
    user = get_current_user()
    start_date, end_date = parse_date_params()
    
    from app.models.sales import InvoiceItem
    result = db.session.query(
        Product.name.label('product_name'),
        func.sum(InvoiceItem.quantity).label('qty_sold'),
        func.sum(InvoiceItem.total_amount).label('sales_amount'),
        (func.sum(InvoiceItem.total_amount) - func.sum(InvoiceItem.quantity * Product.purchase_price)).label('gross_profit')
    ).join(Product, InvoiceItem.product_id == Product.id)\
     .join(Invoice, InvoiceItem.invoice_id == Invoice.id).filter(
        Invoice.tenant_id == user.tenant_id,
        Invoice.invoice_date >= start_date,
        Invoice.invoice_date < end_date,
        Invoice.is_deleted == False,
        InvoiceItem.is_deleted == False
    ).group_by(Product.id).order_by(func.sum(InvoiceItem.total_amount).desc()).all()
    
    return jsonify({
        "data": [{
            "product_name": r.product_name,
            "quantity_sold": int(r.qty_sold or 0),
            "sales_amount": float(r.sales_amount or 0),
            "gross_profit": float(r.gross_profit or 0),
            "margin_percent": round(float(r.gross_profit or 0) / float(r.sales_amount or 1) * 100, 2)
        } for r in result],
        "meta": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        "errors": None
    }), 200


# ============================================================
# GST REPORTS
# ============================================================

@reports_bp.route('/gst/summary', methods=['GET'])
@jwt_required()
def gst_summary():
    """GST summary report (GSTR-1 / GSTR-3B style)"""
    user = get_current_user()
    start_date, end_date = parse_date_params()
    
    result = db.session.query(
        func.sum(Invoice.cgst_amount).label('total_cgst'),
        func.sum(Invoice.sgst_amount).label('total_sgst'),
        func.sum(Invoice.igst_amount).label('total_igst'),
        func.sum(Invoice.net_amount).label('taxable_value'),
        func.count(Invoice.id).label('invoice_count')
    ).filter(
        Invoice.tenant_id == user.tenant_id,
        Invoice.invoice_date >= start_date,
        Invoice.invoice_date < end_date,
        Invoice.is_deleted == False
    ).first()
    
    return jsonify({
        "data": {
            "total_invoices": int(result.invoice_count or 0),
            "taxable_value": float(result.taxable_value or 0),
            "total_cgst": float(result.total_cgst or 0),
            "total_sgst": float(result.total_sgst or 0),
            "total_igst": float(result.total_igst or 0),
            "total_gst": float((result.total_cgst or 0) + (result.total_sgst or 0) + (result.total_igst or 0))
        },
        "meta": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        "errors": None
    }), 200


# ============================================================
# STOCK REPORTS
# ============================================================

@reports_bp.route('/stock/valuation', methods=['GET'])
@jwt_required()
def stock_valuation():
    """Current stock valuation"""
    user = get_current_user()
    
    products = Product.query.filter_by(tenant_id=user.tenant_id, is_deleted=False, is_active=True).all()
    
    total_value = 0
    items = []
    for p in products:
        value = (p.current_stock or 0) * float(p.purchase_price or 0)
        total_value += value
        items.append({
            "product_name": p.name,
            "sku": p.sku,
            "current_stock": p.current_stock,
            "purchase_price": float(p.purchase_price or 0),
            "stock_value": round(value, 2),
            "min_stock_level": p.min_stock_level,
            "status": "Low Stock" if (p.current_stock or 0) <= p.min_stock_level else "OK"
        })
    
    return jsonify({
        "data": {
            "total_items": len(items),
            "total_stock_value": round(total_value, 2),
            "low_stock_count": sum(1 for i in items if i['current_stock'] <= i['min_stock_level']),
            "items": items
        },
        "meta": None,
        "errors": None
    }), 200


@reports_bp.route('/stock/movement', methods=['GET'])
@jwt_required()
def stock_movement():
    """Stock movement report"""
    user = get_current_user()
    start_date, end_date = parse_date_params()
    product_id = request.args.get('product_id', type=int)
    
    query = StockLedger.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    if product_id:
        query = query.filter_by(product_id=product_id)
    
    query = query.filter(
        StockLedger.transaction_date >= start_date,
        StockLedger.transaction_date < end_date
    ).order_by(StockLedger.transaction_date.desc())
    
    items = query.all()
    
    return jsonify({
        "data": [{
            "id": s.id,
            "product_id": s.product_id,
            "quantity_delta": s.quantity_delta,
            "type": s.type,
            "reference_type": s.reference_type,
            "reference_id": s.reference_id,
            "rate": float(s.rate or 0),
            "transaction_date": s.transaction_date.isoformat(),
            "notes": s.notes
        } for s in items],
        "meta": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat(), "total": len(items)},
        "errors": None
    }), 200


# ============================================================
# FINANCIAL REPORTS
# ============================================================

@reports_bp.route('/finance/trial-balance', methods=['GET'])
@jwt_required()
def trial_balance():
    """Trial balance report"""
    user = get_current_user()
    
    accounts = ChartOfAccount.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    
    items = []
    total_debit = 0
    total_credit = 0
    
    for acc in accounts:
        # Get all journal entry lines for this account
        lines = JournalEntryLine.query.filter_by(account_id=acc.id, is_deleted=False).all()
        debit_total = sum(float(l.debit or 0) for l in lines)
        credit_total = sum(float(l.credit or 0) for l in lines)
        
        balance = debit_total - credit_total
        if balance > 0:
            debit = balance
            credit = 0
        else:
            debit = 0
            credit = abs(balance)
        
        total_debit += debit
        total_credit += credit
        
        items.append({
            "account_code": acc.account_code,
            "account_name": acc.account_name,
            "account_type": acc.account_type,
            "debit": round(debit, 2),
            "credit": round(credit, 2)
        })
    
    items.append({
        "account_code": "",
        "account_name": "TOTAL",
        "account_type": "",
        "debit": round(total_debit, 2),
        "credit": round(total_credit, 2)
    })
    
    return jsonify({
        "data": items,
        "meta": {"total_debit": round(total_debit, 2), "total_credit": round(total_credit, 2), "balanced": round(total_debit, 2) == round(total_credit, 2)},
        "errors": None
    }), 200


@reports_bp.route('/finance/profit-loss', methods=['GET'])
@jwt_required()
def profit_loss():
    """Profit & Loss statement"""
    user = get_current_user()
    start_date, end_date = parse_date_params()
    
    # Income accounts
    income_accounts = ChartOfAccount.query.filter_by(
        tenant_id=user.tenant_id, account_type='Income', is_deleted=False
    ).all()
    
    # Expense accounts
    expense_accounts = ChartOfAccount.query.filter_by(
        tenant_id=user.tenant_id, account_type='Expense', is_deleted=False
    ).all()
    
    # Calculate total income from invoices
    total_income_result = db.session.query(func.sum(Invoice.net_amount)).filter(
        Invoice.tenant_id == user.tenant_id,
        Invoice.is_deleted == False,
        Invoice.invoice_date >= start_date,
        Invoice.invoice_date < end_date
    ).scalar() or 0
    
    # Calculate total expenses
    total_expense_result = db.session.query(func.sum(Expense.amount)).filter(
        Expense.tenant_id == user.tenant_id,
        Expense.is_deleted == False,
        Expense.expense_date >= start_date,
        Expense.expense_date < end_date
    ).scalar() or 0
    
    net_profit = float(total_income_result) - float(total_expense_result)
    
    return jsonify({
        "data": {
            "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "total_income": round(float(total_income_result), 2),
            "total_expenses": round(float(total_expense_result), 2),
            "net_profit": round(net_profit, 2),
            "profit_margin_percent": round(net_profit / float(total_income_result) * 100 if float(total_income_result) > 0 else 0, 2)
        },
        "meta": None,
        "errors": None
    }), 200


@reports_bp.route('/finance/balance-sheet', methods=['GET'])
@jwt_required()
def balance_sheet():
    """Balance sheet summary"""
    user = get_current_user()
    
    # Asset accounts
    assets = ChartOfAccount.query.filter_by(
        tenant_id=user.tenant_id, account_type='Asset', is_deleted=False
    ).all()
    
    # Liability accounts
    liabilities = ChartOfAccount.query.filter_by(
        tenant_id=user.tenant_id, account_type='Liability', is_deleted=False
    ).all()
    
    # Equity accounts
    equities = ChartOfAccount.query.filter_by(
        tenant_id=user.tenant_id, account_type='Equity', is_deleted=False
    ).all()
    
    total_assets = sum(float(a.current_balance or 0) for a in assets)
    total_liabilities = sum(float(l.current_balance or 0) for l in liabilities)
    total_equity = sum(float(e.current_balance or 0) for e in equities)
    
    return jsonify({
        "data": {
            "total_assets": round(total_assets, 2),
            "total_liabilities": round(total_liabilities, 2),
            "total_equity": round(total_equity, 2),
            "liabilities_plus_equity": round(total_liabilities + total_equity, 2),
            "is_balanced": round(total_assets, 2) == round(total_liabilities + total_equity, 2)
        },
        "meta": None,
        "errors": None
    }), 200


@reports_bp.route('/finance/expenses', methods=['GET'])
@jwt_required()
def expense_breakdown():
    """Expense breakdown by category"""
    user = get_current_user()
    start_date, end_date = parse_date_params()
    
    result = db.session.query(
        ExpenseCategory.name.label('category'),
        func.count(Expense.id).label('count'),
        func.sum(Expense.amount).label('total')
    ).join(ExpenseCategory, Expense.category_id == ExpenseCategory.id, isouter=True).filter(
        Expense.tenant_id == user.tenant_id,
        Expense.expense_date >= start_date,
        Expense.expense_date < end_date,
        Expense.is_deleted == False
    ).group_by(ExpenseCategory.id).order_by(func.sum(Expense.amount).desc()).all()
    
    return jsonify({
        "data": [{
            "category": r.category or 'Uncategorized',
            "count": int(r.count),
            "total": float(r.total or 0)
        } for r in result],
        "meta": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        "errors": None
    }), 200


# ============================================================
# CUSTOMER REPORTS
# ============================================================

@reports_bp.route('/customers/outstanding', methods=['GET'])
@jwt_required()
def customer_outstanding():
    """Customer outstanding balances"""
    user = get_current_user()
    
    result = db.session.query(
        Customer.name,
        Customer.phone,
        Customer.credit_limit,
        func.sum(Invoice.outstanding_balance).label('total_outstanding'),
        func.count(Invoice.id).label('invoice_count')
    ).join(Invoice, Customer.id == Invoice.customer_id).filter(
        Invoice.tenant_id == user.tenant_id,
        Invoice.is_deleted == False,
        Invoice.payment_status.in_(['Unpaid', 'Partial']),
        Customer.is_deleted == False
    ).group_by(Customer.id).order_by(func.sum(Invoice.outstanding_balance).desc()).all()
    
    return jsonify({
        "data": [{
            "customer_name": r.name,
            "phone": r.phone,
            "credit_limit": float(r.credit_limit or 0),
            "total_outstanding": float(r.total_outstanding or 0),
            "invoice_count": int(r.invoice_count),
            "over_limit": float(r.total_outstanding or 0) > float(r.credit_limit or 0)
        } for r in result],
        "meta": {"total_outstanding": sum(float(r.total_outstanding or 0) for r in result)},
        "errors": None
    }), 200


# ============================================================
# RENTAL REPORTS
# ============================================================

@reports_bp.route('/rentals/revenue', methods=['GET'])
@jwt_required()
def rental_revenue():
    """Rental revenue report"""
    user = get_current_user()
    start_date, end_date = parse_date_params()
    
    result = db.session.query(
        Equipment.name.label('equipment_name'),
        Equipment.registration_number,
        func.count(RentalBooking.id).label('booking_count'),
        func.sum(RentalBooking.total_amount).label('total_revenue')
    ).join(RentalBooking, Equipment.id == RentalBooking.equipment_id).filter(
        RentalBooking.tenant_id == user.tenant_id,
        RentalBooking.start_date >= start_date,
        RentalBooking.start_date < end_date,
        RentalBooking.is_deleted == False,
        Equipment.is_deleted == False
    ).group_by(Equipment.id).order_by(func.sum(RentalBooking.total_amount).desc()).all()
    
    return jsonify({
        "data": [{
            "equipment_name": r.equipment_name,
            "registration_number": r.registration_number,
            "booking_count": int(r.booking_count),
            "total_revenue": float(r.total_revenue or 0)
        } for r in result],
        "meta": {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
        "errors": None
    }), 200


# ============================================================
# AMC REPORTS
# ============================================================

@reports_bp.route('/amc/revenue', methods=['GET'])
@jwt_required()
def amc_revenue():
    """AMC revenue report"""
    user = get_current_user()
    
    contracts = AMCContract.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    
    total_value = sum(float(c.amc_value or 0) for c in contracts)
    active = sum(1 for c in contracts if c.end_date > datetime.utcnow())
    expiring_soon = sum(1 for c in contracts if timedelta(0) < (c.end_date - datetime.utcnow()) < timedelta(days=30))
    
    return jsonify({
        "data": {
            "total_contracts": len(contracts),
            "active_contracts": active,
            "total_contract_value": round(total_value, 2),
            "expiring_in_30_days": expiring_soon,
            "contracts": [{
                "contract_title": c.contract_title,
                "customer_id": c.customer_id,
                "amc_value": float(c.amc_value or 0),
                "start_date": c.start_date.isoformat(),
                "end_date": c.end_date.isoformat(),
                "status": "Active" if c.end_date > datetime.utcnow() else "Expired"
            } for c in contracts]
        },
        "meta": None,
        "errors": None
    }), 200


# ============================================================
# DASHBOARD SUMMARY
# ============================================================

@reports_bp.route('/dashboard/summary', methods=['GET'])
@jwt_required()
def dashboard_summary():
    """Dashboard summary stats"""
    user = get_current_user()
    today = datetime.utcnow()
    month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Sales today
    today_sales = db.session.query(func.sum(Invoice.net_amount)).filter(
        Invoice.tenant_id == user.tenant_id,
        func.date(Invoice.invoice_date) == today.date(),
        Invoice.is_deleted == False
    ).scalar() or 0
    
    # Sales this month
    month_sales = db.session.query(func.sum(Invoice.net_amount)).filter(
        Invoice.tenant_id == user.tenant_id,
        Invoice.invoice_date >= month_start,
        Invoice.is_deleted == False
    ).scalar() or 0
    
    # Invoice counts
    today_invoices = Invoice.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).filter(
        func.date(Invoice.invoice_date) == today.date()
    ).count()
    
    total_invoices = Invoice.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).count()
    
    # Customer count
    customer_count = Customer.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).count()
    
    # Product count
    product_count = Product.query.filter_by(tenant_id=user.tenant_id, is_deleted=False, is_active=True).count()
    
    # Low stock alerts
    low_stock = Product.query.filter(
        Product.tenant_id == user.tenant_id,
        Product.is_deleted == False,
        Product.is_active == True,
        Product.current_stock <= Product.min_stock_level
    ).count()
    
    # Overdue invoices
    overdue_invoices = Invoice.query.filter(
        Invoice.tenant_id == user.tenant_id,
        Invoice.is_deleted == False,
        Invoice.payment_status.in_(['Unpaid', 'Partial']),
        Invoice.due_date < today
    ).count()
    
    # Pending rental returns
    pending_returns = RentalBooking.query.filter(
        RentalBooking.tenant_id == user.tenant_id,
        RentalBooking.is_deleted == False,
        RentalBooking.status == 'Active',
        RentalBooking.end_date < today + timedelta(days=3)
    ).count()
    
    return jsonify({
        "data": {
            "today_sales": round(float(today_sales), 2),
            "month_sales": round(float(month_sales), 2),
            "today_invoices": today_invoices,
            "total_invoices": total_invoices,
            "total_customers": customer_count,
            "total_products": product_count,
            "low_stock_alerts": low_stock,
            "overdue_invoices": overdue_invoices,
            "pending_returns": pending_returns
        },
        "meta": None,
        "errors": None
    }), 200



# ============================================================
# EXPORT ENDPOINTS (PDF & EXCEL)
# ============================================================

@reports_bp.route('/export/pdf', methods=['POST'])
@jwt_required()
def export_pdf():
    """
    Export report to PDF
    Expects: {"report_data": [...], "report_title": "..."}
    """
    from app.models.tenant import Company
    from app.routes.companies import get_company_logo_path
    
    data = request.get_json() or {}
    report_data = data.get('report_data', [])
    report_title = data.get('report_title', 'Report')
    
    if not report_data:
        return jsonify({"data": None, "errors": ["No data provided"]}), 400
    
    try:
        user = get_current_user()
        
        # Fetch company data with logo
        company = Company.query.filter_by(id=user.company_id, is_deleted=False).first()
        company_data = {}
        if company:
            logo_path = get_company_logo_path(company.id) if company.logo else None
            company_data = {
                'name': company.name,
                'address': company.address,
                'city': company.city,
                'state': company.state,
                'pincode': company.pincode,
                'gstin': company.gstin,
                'phone': company.phone,
                'email': company.email,
                'logo_path': logo_path
            }
        
        pdf_buffer = generate_report_pdf(report_data, report_title, company_data=company_data)
        filename = f"{report_title.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({"data": None, "errors": [f"PDF generation failed: {str(e)}"]}), 500


@reports_bp.route('/export/excel', methods=['POST'])
@jwt_required()
def export_excel():
    """
    Export report to Excel
    Expects: {"report_data": [...], "report_title": "...", "summary": {...}}
    """
    data = request.get_json() or {}
    report_data = data.get('report_data', [])
    report_title = data.get('report_title', 'Report')
    summary_data = data.get('summary', None)
    
    if not report_data:
        return jsonify({"data": None, "errors": ["No data provided"]}), 400
    
    try:
        excel_buffer = export_report_to_excel(report_data, report_title, summary_data)
        filename = f"{report_title.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return send_file(
            excel_buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({"data": None, "errors": [f"Excel generation failed: {str(e)}"]}), 500


@reports_bp.route('/export/template/<template_type>', methods=['GET'])
@jwt_required()
def download_template(template_type):
    """
    Download Excel import template
    Types: products, customers, suppliers, etc.
    """
    from app.utils.excel import create_excel_template
    
    templates = {
        'products': {
            'headers': ['Product Name', 'SKU', 'Category', 'HSN Code', 'GST Rate', 'Purchase Price', 'Selling Price', 'Min Stock'],
            'example': {
                'Product Name': 'Sample Product',
                'SKU': 'PRD001',
                'Category': 'Electronics',
                'HSN Code': '8517',
                'GST Rate': '18',
                'Purchase Price': '100.00',
                'Selling Price': '150.00',
                'Min Stock': '10'
            }
        },
        'customers': {
            'headers': ['Customer Name', 'Phone', 'Email', 'GST Number', 'Address', 'Credit Limit'],
            'example': {
                'Customer Name': 'Sample Customer',
                'Phone': '9876543210',
                'Email': 'customer@example.com',
                'GST Number': '27XXXXX1234X1Z5',
                'Address': '123 Main St, City',
                'Credit Limit': '50000.00'
            }
        },
        'suppliers': {
            'headers': ['Supplier Name', 'Phone', 'Email', 'GST Number', 'Address', 'Bank Account'],
            'example': {
                'Supplier Name': 'Sample Supplier',
                'Phone': '9876543210',
                'Email': 'supplier@example.com',
                'GST Number': '27XXXXX1234X1Z5',
                'Address': '456 Supplier Rd, City',
                'Bank Account': '1234567890'
            }
        }
    }
    
    if template_type not in templates:
        return jsonify({"data": None, "errors": ["Invalid template type"]}), 400
    
    try:
        template = templates[template_type]
        buffer = create_excel_template(
            headers=template['headers'],
            filename=f"{template_type}_import_template.xlsx",
            sheet_name=template_type.capitalize(),
            example_row=template.get('example')
        )
        
        return send_file(
            buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f"{template_type}_import_template.xlsx"
        )
    except Exception as e:
        return jsonify({"data": None, "errors": [f"Template generation failed: {str(e)}"]}), 500
