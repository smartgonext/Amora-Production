from app.extensions import db
from app.models.base import BaseModel


class ChartOfAccount(BaseModel):
    """Chart of accounts - standard accounting structure"""
    __tablename__ = 'chart_of_accounts'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    account_code = db.Column(db.String(20), nullable=False)
    account_name = db.Column(db.String(100), nullable=False)
    account_type = db.Column(db.String(30), nullable=False)  # Asset, Liability, Income, Expense, Equity
    parent_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    opening_balance = db.Column(db.Numeric(12, 2), default=0.00)
    current_balance = db.Column(db.Numeric(12, 2), default=0.00)


class JournalEntry(BaseModel):
    """Journal entry - double entry accounting"""
    __tablename__ = 'journal_entries'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    entry_number = db.Column(db.String(50), nullable=False, index=True)
    entry_date = db.Column(db.DateTime, nullable=False)
    reference_type = db.Column(db.String(30), nullable=True)  # invoice, payment, receipt, contra, expense
    reference_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    description = db.Column(db.Text, nullable=True)
    total_debit = db.Column(db.Numeric(12, 2), default=0.00)
    total_credit = db.Column(db.Numeric(12, 2), default=0.00)
    status = db.Column(db.String(20), default='Posted')  # Draft, Posted, Reversed
    
    lines = db.relationship('JournalEntryLine', backref='journal_entry', lazy='dynamic', cascade="all, delete-orphan")


class JournalEntryLine(BaseModel):
    __tablename__ = 'journal_entry_lines'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    journal_entry_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('journal_entries.id'), nullable=False)
    account_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('chart_of_accounts.id'), nullable=False)
    debit = db.Column(db.Numeric(12, 2), default=0.00)
    credit = db.Column(db.Numeric(12, 2), default=0.00)
    description = db.Column(db.String(255), nullable=True)


class CashAccount(BaseModel):
    __tablename__ = 'cash_accounts'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    branch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('branches.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    opening_balance = db.Column(db.Numeric(10, 2), default=0.00)
    current_balance = db.Column(db.Numeric(10, 2), default=0.00)
    is_active = db.Column(db.Boolean, default=True)


class BankAccount(BaseModel):
    __tablename__ = 'bank_accounts'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    account_name = db.Column(db.String(100), nullable=False)
    bank_name = db.Column(db.String(100), nullable=False)
    account_number = db.Column(db.String(50), nullable=False)
    ifsc_code = db.Column(db.String(20), nullable=True)
    branch_name = db.Column(db.String(100), nullable=True)
    opening_balance = db.Column(db.Numeric(10, 2), default=0.00)
    current_balance = db.Column(db.Numeric(10, 2), default=0.00)
    is_active = db.Column(db.Boolean, default=True)


class Expense(BaseModel):
    __tablename__ = 'expenses'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    branch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('branches.id'), nullable=True)
    category_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('expense_categories.id'), nullable=True)
    expense_number = db.Column(db.String(50), nullable=False, index=True)
    expense_date = db.Column(db.DateTime, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    gst_amount = db.Column(db.Numeric(10, 2), default=0.00)
    payment_method = db.Column(db.String(30), default='Cash')
    paid_to = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    bill_reference = db.Column(db.String(50), nullable=True)
    status = db.Column(db.String(20), default='Paid')  # Paid, Unpaid, Pending


class ExpenseCategory(BaseModel):
    __tablename__ = 'expense_categories'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)


class ContraEntry(BaseModel):
    """Cash to bank transfer or vice versa"""
    __tablename__ = 'contra_entries'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    contra_number = db.Column(db.String(50), nullable=False, index=True)
    contra_date = db.Column(db.DateTime, nullable=False)
    from_account_type = db.Column(db.String(20), nullable=False)  # Cash, Bank
    from_account_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=False)
    to_account_type = db.Column(db.String(20), nullable=False)  # Cash, Bank
    to_account_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='Completed')  # Draft, Completed, Cancelled


class PaymentOut(BaseModel):
    """Payment made to suppliers or other parties"""
    __tablename__ = 'payments_out'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    supplier_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('suppliers.id'), nullable=True)
    payment_number = db.Column(db.String(50), nullable=False, index=True)
    payment_date = db.Column(db.DateTime, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_method = db.Column(db.String(30), default='BankTransfer')
    reference_no = db.Column(db.String(50), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='Completed')  # Draft, Completed, Cancelled