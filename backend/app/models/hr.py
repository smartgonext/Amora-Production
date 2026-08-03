from app.extensions import db
from app.models.base import BaseModel


class Employee(BaseModel):
    __tablename__ = 'employees'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    branch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('branches.id'), nullable=True)
    user_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    employee_code = db.Column(db.String(20), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(100), nullable=True)
    department = db.Column(db.String(50), nullable=True)
    designation = db.Column(db.String(50), nullable=True)
    date_of_joining = db.Column(db.Date, nullable=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    gender = db.Column(db.String(10), nullable=True)
    address = db.Column(db.Text, nullable=True)
    bank_name = db.Column(db.String(100), nullable=True)
    bank_account_no = db.Column(db.String(50), nullable=True)
    bank_ifsc = db.Column(db.String(20), nullable=True)
    pan = db.Column(db.String(10), nullable=True)
    uan = db.Column(db.String(20), nullable=True)  # PF account
    basic_salary = db.Column(db.Numeric(10, 2), default=0.00)
    hra = db.Column(db.Numeric(10, 2), default=0.00)
    conveyance = db.Column(db.Numeric(10, 2), default=0.00)
    medical = db.Column(db.Numeric(10, 2), default=0.00)
    special_allowance = db.Column(db.Numeric(10, 2), default=0.00)
    gross_salary = db.Column(db.Numeric(10, 2), default=0.00)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    
    attendance = db.relationship('Attendance', backref='employee', lazy='dynamic', cascade="all, delete-orphan")
    leave_requests = db.relationship('LeaveRequest', backref='employee', lazy='dynamic', cascade="all, delete-orphan")


class Attendance(BaseModel):
    __tablename__ = 'attendance'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    employee_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('employees.id'), nullable=False)
    attendance_date = db.Column(db.Date, nullable=False)
    check_in = db.Column(db.DateTime, nullable=True)
    check_out = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='Present')  # Present, Absent, Half-Day, Leave, Holiday, Weekly-Off
    notes = db.Column(db.Text, nullable=True)


class LeaveType(BaseModel):
    __tablename__ = 'leave_types'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    days_allowed = db.Column(db.Integer, default=0)
    is_paid = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)


class LeaveRequest(BaseModel):
    __tablename__ = 'leave_requests'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    employee_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('employees.id'), nullable=False)
    leave_type_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('leave_types.id'), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    total_days = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='Pending', index=True)  # Pending, Approved, Rejected, Cancelled
    approved_by = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)


class PayrollRun(BaseModel):
    __tablename__ = 'payroll_runs'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    run_name = db.Column(db.String(50), nullable=False)  # e.g., "March 2026 Payroll"
    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)
    run_date = db.Column(db.DateTime, nullable=False)
    total_gross = db.Column(db.Numeric(12, 2), default=0.00)
    total_deductions = db.Column(db.Numeric(12, 2), default=0.00)
    total_net = db.Column(db.Numeric(12, 2), default=0.00)
    status = db.Column(db.String(20), default='Draft')  # Draft, Processed, Paid, Cancelled
    
    items = db.relationship('PayrollItem', backref='payroll_run', lazy='dynamic', cascade="all, delete-orphan")


class PayrollItem(BaseModel):
    __tablename__ = 'payroll_items'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    payroll_run_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('payroll_runs.id'), nullable=False)
    employee_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('employees.id'), nullable=False)
    gross_pay = db.Column(db.Numeric(10, 2), default=0.00)
    deductions = db.Column(db.Numeric(10, 2), default=0.00)
    net_pay = db.Column(db.Numeric(10, 2), default=0.00)
    payment_status = db.Column(db.String(20), default='Pending')  # Pending, Paid


class Shift(BaseModel):
    __tablename__ = 'shifts'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    name = db.Column(db.String(50), nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    is_active = db.Column(db.Boolean, default=True)


class Holiday(BaseModel):
    __tablename__ = 'holidays'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    holiday_date = db.Column(db.Date, nullable=False)
    is_optional = db.Column(db.Boolean, default=False)