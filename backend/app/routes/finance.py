from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.finance import (
    ChartOfAccount, JournalEntry, JournalEntryLine, CashAccount, 
    BankAccount, Expense, ExpenseCategory, ContraEntry, PaymentOut
)
from datetime import datetime

finance_bp = Blueprint('finance', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))

# --- Chart of Accounts Endpoints ---
@finance_bp.route('/accounts', methods=['GET'])
@jwt_required()
def get_accounts():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    query = ChartOfAccount.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    account_type = request.args.get('type')
    if account_type:
        query = query.filter_by(account_type=account_type)
        
    accounts = query.all()
    return jsonify({"data": [a.to_dict() for a in accounts], "meta": {"count": len(accounts)}, "errors": None}), 200

@finance_bp.route('/accounts', methods=['POST'])
@jwt_required()
def create_account():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    if not data.get('account_name') or not data.get('account_type'):
        return jsonify({"data": None, "meta": None, "errors": ["Name and Type are required"]}), 400
        
    account = ChartOfAccount(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        account_code=data.get('account_code', 'ACC-NEW'),
        account_name=data.get('account_name'),
        account_type=data.get('account_type'),
        parent_id=data.get('parent_id'),
        opening_balance=data.get('opening_balance', 0.00),
        current_balance=data.get('opening_balance', 0.00),
        is_active=data.get('is_active', True)
    )
    db.session.add(account)
    db.session.commit()
    return jsonify({"data": account.to_dict(), "meta": None, "errors": None}), 201

# --- Cash Accounts Endpoints ---
@finance_bp.route('/cash-accounts', methods=['GET'])
@jwt_required()
def get_cash_accounts():
    user = get_current_user()
    accounts = CashAccount.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({"data": [a.to_dict() for a in accounts], "errors": None}), 200

@finance_bp.route('/cash-accounts', methods=['POST'])
@jwt_required()
def create_cash_account():
    user = get_current_user()
    data = request.get_json() or {}
    account = CashAccount(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        name=data.get('name'),
        opening_balance=data.get('opening_balance', 0.00),
        current_balance=data.get('opening_balance', 0.00)
    )
    db.session.add(account)
    db.session.commit()
    return jsonify({"data": account.to_dict(), "errors": None}), 201

# --- Bank Accounts Endpoints ---
@finance_bp.route('/bank-accounts', methods=['GET'])
@jwt_required()
def get_bank_accounts():
    user = get_current_user()
    accounts = BankAccount.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({"data": [a.to_dict() for a in accounts], "errors": None}), 200

@finance_bp.route('/bank-accounts', methods=['POST'])
@jwt_required()
def create_bank_account():
    user = get_current_user()
    data = request.get_json() or {}
    account = BankAccount(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        account_name=data.get('account_name'),
        bank_name=data.get('bank_name'),
        account_number=data.get('account_number'),
        ifsc_code=data.get('ifsc_code'),
        branch_name=data.get('branch_name'),
        opening_balance=data.get('opening_balance', 0.00),
        current_balance=data.get('opening_balance', 0.00)
    )
    db.session.add(account)
    db.session.commit()
    return jsonify({"data": account.to_dict(), "errors": None}), 201

# --- Journal Entries Endpoints ---
@finance_bp.route('/journal-entries', methods=['GET'])
@jwt_required()
def get_journal_entries():
    user = get_current_user()
    entries = JournalEntry.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(JournalEntry.entry_date.desc()).all()
    return jsonify({"data": [e.to_dict() for e in entries], "errors": None}), 200

@finance_bp.route('/journal-entries', methods=['POST'])
@jwt_required()
def create_journal_entry():
    user = get_current_user()
    data = request.get_json() or {}
    entry = JournalEntry(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        entry_number=f"JV-{int(datetime.utcnow().timestamp())}",
        entry_date=datetime.strptime(data.get('entry_date'), '%Y-%m-%d') if data.get('entry_date') else datetime.utcnow(),
        description=data.get('description'),
        total_debit=data.get('total_debit', 0.00),
        total_credit=data.get('total_credit', 0.00),
        status='Posted'
    )
    db.session.add(entry)
    db.session.flush()

    for line in data.get('lines', []):
        entry_line = JournalEntryLine(
            tenant_id=user.tenant_id,
            journal_entry_id=entry.id,
            account_id=line.get('account_id'),
            debit=line.get('debit', 0.00),
            credit=line.get('credit', 0.00),
            description=line.get('description')
        )
        db.session.add(entry_line)
        
    db.session.commit()
    return jsonify({"data": entry.to_dict(), "errors": None}), 201

# --- Contra Entries Endpoints ---
@finance_bp.route('/contra-entries', methods=['GET'])
@jwt_required()
def get_contra_entries():
    user = get_current_user()
    entries = ContraEntry.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(ContraEntry.contra_date.desc()).all()
    return jsonify({"data": [e.to_dict() for e in entries], "errors": None}), 200

@finance_bp.route('/contra-entries', methods=['POST'])
@jwt_required()
def create_contra_entry():
    user = get_current_user()
    data = request.get_json() or {}
    entry = ContraEntry(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        contra_number=f"CN-{int(datetime.utcnow().timestamp())}",
        contra_date=datetime.strptime(data.get('contra_date'), '%Y-%m-%d') if data.get('contra_date') else datetime.utcnow(),
        from_account_type=data.get('from_account_type'),
        from_account_id=data.get('from_account_id'),
        to_account_type=data.get('to_account_type'),
        to_account_id=data.get('to_account_id'),
        amount=data.get('amount', 0.00),
        notes=data.get('notes'),
        status='Completed'
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify({"data": entry.to_dict(), "errors": None}), 201

# --- Expense Endpoints ---
@finance_bp.route('/expenses', methods=['GET'])
@jwt_required()
def get_expenses():
    user = get_current_user()
    expenses = Expense.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(Expense.expense_date.desc()).all()
    return jsonify({"data": [e.to_dict() for e in expenses], "errors": None}), 200

@finance_bp.route('/expenses', methods=['POST'])
@jwt_required()
def create_expense():
    user = get_current_user()
    data = request.get_json() or {}
    expense = Expense(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        category_id=data.get('category_id'),
        expense_number=f"EXP-{int(datetime.utcnow().timestamp())}",
        expense_date=datetime.strptime(data.get('expense_date'), '%Y-%m-%d') if data.get('expense_date') else datetime.utcnow(),
        amount=data.get('amount', 0.00),
        gst_amount=data.get('gst_amount', 0.00),
        payment_method=data.get('payment_method', 'Cash'),
        paid_to=data.get('paid_to'),
        notes=data.get('notes'),
        bill_reference=data.get('bill_reference'),
        status='Paid'
    )
    db.session.add(expense)
    db.session.commit()
    return jsonify({"data": expense.to_dict(), "errors": None}), 201

# --- Expense Categories Endpoints ---
@finance_bp.route('/expense-categories', methods=['GET'])
@jwt_required()
def get_expense_categories():
    user = get_current_user()
    cats = ExpenseCategory.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({"data": [c.to_dict() for c in cats], "errors": None}), 200

@finance_bp.route('/expense-categories', methods=['POST'])
@jwt_required()
def create_expense_category():
    user = get_current_user()
    data = request.get_json() or {}
    cat = ExpenseCategory(
        tenant_id=user.tenant_id,
        name=data.get('name'),
        description=data.get('description'),
        is_active=True
    )
    db.session.add(cat)
    db.session.commit()
    return jsonify({"data": cat.to_dict(), "errors": None}), 201

# --- Payments Out Endpoints ---
@finance_bp.route('/payments', methods=['GET'])
@jwt_required()
def get_payments():
    user = get_current_user()
    payments = PaymentOut.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).order_by(PaymentOut.payment_date.desc()).all()
    return jsonify({"data": [p.to_dict() for p in payments], "errors": None}), 200

@finance_bp.route('/payments', methods=['POST'])
@jwt_required()
def create_payment():
    user = get_current_user()
    data = request.get_json() or {}
    payment = PaymentOut(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        supplier_id=data.get('supplier_id'),
        payment_number=f"PAY-{int(datetime.utcnow().timestamp())}",
        payment_date=datetime.strptime(data.get('payment_date'), '%Y-%m-%d') if data.get('payment_date') else datetime.utcnow(),
        amount=data.get('amount', 0.00),
        payment_method=data.get('payment_method', 'BankTransfer'),
        reference_no=data.get('reference_no'),
        notes=data.get('notes'),
        status='Completed'
    )
    db.session.add(payment)
    db.session.commit()
    return jsonify({"data": payment.to_dict(), "errors": None}), 201
