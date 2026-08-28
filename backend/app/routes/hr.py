from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.hr import Employee, Attendance, PayrollRun, PayrollItem
from datetime import datetime, date, timedelta
import calendar
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

@hr_bp.route('/attendance/monthly', methods=['GET'])
@jwt_required()
def get_monthly_attendance():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    year = request.args.get('year', type=int) or datetime.utcnow().year
    month = request.args.get('month', type=int) or datetime.utcnow().month
    dept = request.args.get('department')
    
    num_days = calendar.monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, num_days)
    
    emp_query = Employee.query.filter_by(tenant_id=user.tenant_id, is_active=True, is_deleted=False)
    if dept:
        emp_query = emp_query.filter_by(department=dept)
    employees = emp_query.order_by(Employee.name).all()
    
    att_records = Attendance.query.filter(
        Attendance.tenant_id == user.tenant_id,
        Attendance.attendance_date >= start_date,
        Attendance.attendance_date <= end_date,
        Attendance.is_deleted == False
    ).all()
    
    att_map = {}
    for r in att_records:
        if r.employee_id not in att_map:
            att_map[r.employee_id] = {}
        att_map[r.employee_id][r.attendance_date.day] = r.status
        
    days = []
    for d in range(1, num_days + 1):
        dt = date(year, month, d)
        days.append({
            "day": d,
            "date": dt.strftime("%Y-%m-%d"),
            "weekday": dt.strftime("%a"),
            "is_weekend": dt.weekday() in (5, 6)
        })
        
    result_employees = []
    for emp in employees:
        emp_att = att_map.get(emp.id, {})
        att_dict = {}
        summary = {"Present": 0, "Absent": 0, "Half-Day": 0, "Leave": 0, "Weekly-Off": 0, "Holiday": 0, "Not-Set": 0}
        
        for d in range(1, num_days + 1):
            dt = date(year, month, d)
            status = emp_att.get(d)
            if not status:
                status = "Weekly-Off" if dt.weekday() == 6 else "Not-Set"
            att_dict[str(d)] = status
            if status in summary:
                summary[status] += 1
            else:
                summary[status] = 1
                
        result_employees.append({
            "id": emp.id,
            "employee_code": emp.employee_code,
            "name": emp.name,
            "department": emp.department,
            "designation": emp.designation,
            "attendance": att_dict,
            "summary": summary
        })
        
    return jsonify({
        "data": {
            "year": year,
            "month": month,
            "days_in_month": num_days,
            "days": days,
            "employees": result_employees
        },
        "meta": {"employee_count": len(employees)},
        "errors": None
    }), 200

@hr_bp.route('/attendance/bulk', methods=['POST'])
@jwt_required()
def bulk_attendance():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    att_date_str = data.get('date')
    status = data.get('status', 'Present')
    notes = data.get('notes', 'Bulk marked')
    employee_ids = data.get('employee_ids')
    
    if not att_date_str:
        att_date = datetime.utcnow().date()
    else:
        try:
            att_date = datetime.strptime(att_date_str, "%Y-%m-%d").date()
        except ValueError:
            att_date = datetime.utcnow().date()
            
    emp_query = Employee.query.filter_by(tenant_id=user.tenant_id, is_active=True, is_deleted=False)
    if employee_ids and isinstance(employee_ids, list):
        emp_query = emp_query.filter(Employee.id.in_(employee_ids))
    employees = emp_query.all()
    
    count = 0
    for emp in employees:
        existing = Attendance.query.filter_by(
            tenant_id=user.tenant_id,
            employee_id=emp.id,
            attendance_date=att_date,
            is_deleted=False
        ).first()
        
        if existing:
            existing.status = status
            existing.notes = notes
        else:
            new_att = Attendance(
                tenant_id=user.tenant_id,
                employee_id=emp.id,
                attendance_date=att_date,
                status=status,
                notes=notes
            )
            db.session.add(new_att)
        count += 1
        
    db.session.commit()
    return jsonify({
        "data": {"updated_count": count, "date": att_date.strftime("%Y-%m-%d"), "status": status},
        "meta": None,
        "errors": None
    }), 200

@hr_bp.route('/attendance/bulk-month', methods=['POST'])
@jwt_required()
def bulk_month_attendance():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    year = data.get('year', datetime.utcnow().year)
    month = data.get('month', datetime.utcnow().month)
    status = data.get('status', 'Present')
    include_weekends = data.get('include_weekends', False)
    
    num_days = calendar.monthrange(year, month)[1]
    employees = Employee.query.filter_by(tenant_id=user.tenant_id, is_active=True, is_deleted=False).all()
    
    count = 0
    for d in range(1, num_days + 1):
        dt = date(year, month, d)
        is_sunday = (dt.weekday() == 6)
        day_status = "Weekly-Off" if (is_sunday and not include_weekends) else status
        
        for emp in employees:
            existing = Attendance.query.filter_by(
                tenant_id=user.tenant_id,
                employee_id=emp.id,
                attendance_date=dt,
                is_deleted=False
            ).first()
            
            if existing:
                existing.status = day_status
            else:
                new_att = Attendance(
                    tenant_id=user.tenant_id,
                    employee_id=emp.id,
                    attendance_date=dt,
                    status=day_status,
                    notes="Bulk Month Entry"
                )
                db.session.add(new_att)
            count += 1
            
    db.session.commit()
    return jsonify({
        "data": {"records_processed": count, "month": f"{year}-{month:02d}", "status": status},
        "meta": None,
        "errors": None
    }), 200

@hr_bp.route('/attendance/cell', methods=['PUT'])
@jwt_required()
def update_attendance_cell():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    emp_id = data.get('employee_id')
    att_date_str = data.get('attendance_date')
    status = data.get('status', 'Present')
    
    if not emp_id or not att_date_str:
        return jsonify({"data": None, "meta": None, "errors": ["employee_id and attendance_date are required"]}), 400
        
    try:
        att_date = datetime.strptime(att_date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"data": None, "meta": None, "errors": ["Invalid date format"]}), 400
        
    existing = Attendance.query.filter_by(
        tenant_id=user.tenant_id,
        employee_id=emp_id,
        attendance_date=att_date,
        is_deleted=False
    ).first()
    
    if existing:
        existing.status = status
    else:
        existing = Attendance(
            tenant_id=user.tenant_id,
            employee_id=emp_id,
            attendance_date=att_date,
            status=status,
            notes="Grid Edit"
        )
        db.session.add(existing)
        
    db.session.commit()
    return jsonify({"data": existing.to_dict(), "meta": None, "errors": None}), 200

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
