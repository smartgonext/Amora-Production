from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.hr import Employee, Attendance, PayrollRun, PayrollItem
from datetime import datetime
import uuid

hr_bp = Blueprint('hr', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))

@hr_bp.route('/employees', methods=['GET'])
@jwt_required()
def get_employees():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    query = Employee.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    
    search = request.args.get('search')
    if search:
        query = query.filter(Employee.name.like(f"%{search}%") | Employee.employee_code.like(f"%{search}%"))
        
    employees = query.all()
    return jsonify({
        "data": [emp.to_dict() for emp in employees],
        "meta": {"count": len(employees)},
        "errors": None
    }), 200

@hr_bp.route('/employees', methods=['POST'])
@jwt_required()
def create_employee():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    if not data.get('name'):
        return jsonify({"data": None, "meta": None, "errors": ["Name is required"]}), 400
        
    code = data.get('employee_code') or f"EMP-{uuid.uuid4().hex[:6].upper()}"
    
    emp = Employee(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        employee_code=code,
        name=data.get('name'),
        phone=data.get('phone'),
        email=data.get('email'),
        department=data.get('department'),
        designation=data.get('designation'),
        basic_salary=float(data.get('basic_salary', 0.00)),
        hra=float(data.get('hra', 0.00)),
        gross_salary=float(data.get('gross_salary', 0.00)),
        bank_name=data.get('bank_name'),
        bank_account_no=data.get('bank_account_no'),
        bank_ifsc=data.get('bank_ifsc'),
        is_active=True
    )
    
    db.session.add(emp)
    db.session.commit()
    
    return jsonify({"data": emp.to_dict(), "meta": None, "errors": None}), 201

@hr_bp.route('/attendance', methods=['GET'])
@jwt_required()
def get_attendance():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    records = Attendance.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({
        "data": [r.to_dict() for r in records],
        "meta": {"count": len(records)},
        "errors": None
    }), 200

@hr_bp.route('/attendance', methods=['POST'])
@jwt_required()
def log_attendance():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    emp_id = data.get('employee_id')
    if not emp_id:
        return jsonify({"data": None, "meta": None, "errors": ["Employee is required"]}), 400
        
    att = Attendance(
        tenant_id=user.tenant_id,
        employee_id=emp_id,
        attendance_date=datetime.utcnow().date(),
        check_in=datetime.utcnow(),
        status=data.get('status', 'Present'),
        notes=data.get('notes')
    )
    db.session.add(att)
    db.session.commit()
    
    return jsonify({"data": att.to_dict(), "meta": None, "errors": None}), 201

@hr_bp.route('/payroll', methods=['GET'])
@jwt_required()
def get_payroll_runs():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    runs = PayrollRun.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({
        "data": [r.to_dict() for r in runs],
        "meta": {"count": len(runs)},
        "errors": None
    }), 200

@hr_bp.route('/payroll', methods=['POST'])
@jwt_required()
def run_payroll():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    run_name = data.get('run_name') or f"Payroll for {datetime.utcnow().strftime('%B %Y')}"
    
    # Process payroll items for all active employees
    employees = Employee.query.filter_by(tenant_id=user.tenant_id, is_active=True, is_deleted=False).all()
    
    total_gross = 0.00
    total_net = 0.00
    
    payroll_run = PayrollRun(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        run_name=run_name,
        period_start=datetime.utcnow().date().replace(day=1),
        period_end=datetime.utcnow().date(),
        run_date=datetime.utcnow(),
        status='Processed'
    )
    
    db.session.add(payroll_run)
    db.session.flush()
    
    for emp in employees:
        gross = float(emp.gross_salary or 0.00)
        net = gross # simple assumption for default settings
        total_gross += gross
        total_net += net
        
        item = PayrollItem(
            tenant_id=user.tenant_id,
            payroll_run_id=payroll_run.id,
            employee_id=emp.id,
            gross_pay=gross,
            deductions=0.00,
            net_pay=net,
            payment_status='Paid'
        )
        db.session.add(item)
        
    payroll_run.total_gross = total_gross
    payroll_run.total_net = total_net
    db.session.commit()
    
    return jsonify({"data": payroll_run.to_dict(), "meta": None, "errors": None}), 201
