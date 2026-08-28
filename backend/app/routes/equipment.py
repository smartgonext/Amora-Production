from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.equipment import Equipment, RentalBooking, RentalExtension
from app.models.amc import AMCContract, AMCEquipment, AMCServiceSchedule
from app.models.product import Product
from datetime import datetime, timedelta
import uuid

equipment_bp = Blueprint('equipment_routes', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))

# ==================== EQUIPMENT REGISTRY ====================

@equipment_bp.route('', methods=['GET'])
@jwt_required()
def list_equipment():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    status = request.args.get('rental_status')
    query = Equipment.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    if status:
        query = query.filter_by(rental_status=status)
        
    items = query.all()
    return jsonify({
        "data": [item.to_dict() for item in items],
        "meta": {"count": len(items)},
        "errors": None
    }), 200

@equipment_bp.route('', methods=['POST'])
@jwt_required()
def create_equipment():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    if not data.get('name') or not data.get('type'):
        return jsonify({"data": None, "meta": None, "errors": ["Name and Type are required"]}), 400
        
    eq = Equipment(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        name=data.get('name'),
        type=data.get('type'),
        model_number=data.get('model_number'),
        ton_capacity=float(data.get('ton_capacity', 0.00)) if data.get('ton_capacity') else None,
        serial_number=data.get('serial_number') or f"EQ-{uuid.uuid4().hex[:6].upper()}",
        registration_number=data.get('registration_number'),
        rental_status='Available',
        purchase_date=datetime.utcnow(),
        min_hourly_rate=float(data.get('min_hourly_rate', 0.00)),
        min_daily_rate=float(data.get('min_daily_rate', 0.00)),
        min_weekly_rate=float(data.get('min_weekly_rate', 0.00)),
        min_monthly_rate=float(data.get('min_monthly_rate', 0.00)),
        is_active=True,
        custom_fields=data.get('custom_fields')
    )
    db.session.add(eq)
    db.session.commit()
    return jsonify({"data": eq.to_dict(), "meta": None, "errors": None}), 201


# ==================== RENTAL AGREEMENTS ====================

@equipment_bp.route('/rentals', methods=['GET'])
@jwt_required()
def list_rentals():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    bookings = RentalBooking.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({
        "data": [b.to_dict() for b in bookings],
        "meta": {"count": len(bookings)},
        "errors": None
    }), 200

@equipment_bp.route('/rentals', methods=['POST'])
@jwt_required()
def create_rental():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    eq_id = data.get('equipment_id')
    cust_id = data.get('customer_id')
    rate = data.get('rental_rate_applied')
    
    if not eq_id or not cust_id or not rate:
        return jsonify({"data": None, "meta": None, "errors": ["Equipment, Customer, and Rate are required"]}), 400
        
    # Check equipment availability
    eq = Equipment.query.filter_by(id=eq_id, tenant_id=user.tenant_id).first()
    if not eq or eq.rental_status != 'Available':
        return jsonify({"data": None, "meta": None, "errors": ["Equipment not available for rent"]}), 400
        
    from app.services.form_builder_service import extract_custom_fields
    custom_fields = extract_custom_fields('rental', data)
    if data.get('custom_fields'):
        custom_fields.update(data['custom_fields'])

    booking = RentalBooking(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        equipment_id=eq_id,
        customer_id=cust_id,
        booking_number=f"RENT-{uuid.uuid4().hex[:6].upper()}",
        start_date=datetime.strptime(data.get('start_date', datetime.utcnow().strftime('%Y-%m-%d')), '%Y-%m-%d') if isinstance(data.get('start_date'), str) else datetime.utcnow(),
        end_date=datetime.strptime(data.get('end_date', (datetime.utcnow() + timedelta(days=7)).strftime('%Y-%m-%d')), '%Y-%m-%d') if isinstance(data.get('end_date'), str) else (datetime.utcnow() + timedelta(days=7)),
        site_address=data.get('site_address'),
        rental_rate_applied=float(rate),
        rate_type=data.get('rate_type', 'Daily'),
        security_deposit=float(data.get('security_deposit', 0.00)),
        total_amount=float(rate) * 7.0, # default total estimate
        status='Active',
        billing_status='Unbilled',
        custom_fields=custom_fields
    )
    
    # Update equipment status to Rented
    eq.rental_status = 'Rented'
    
    db.session.add(booking)
    db.session.commit()
    return jsonify({"data": booking.to_dict(), "meta": None, "errors": None}), 201

@equipment_bp.route('/rentals/<int:booking_id>/return', methods=['POST'])
@jwt_required()
def return_rental(booking_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    booking = RentalBooking.query.filter_by(id=booking_id, tenant_id=user.tenant_id).first()
    if not booking or booking.status == 'Completed':
        return jsonify({"data": None, "meta": None, "errors": ["Active rental booking not found"]}), 404
        
    data = request.get_json() or {}
    
    booking.status = 'Completed'
    booking.return_date = datetime.utcnow()
    booking.return_condition_notes = data.get('return_condition_notes', 'Returned in good working condition.')
    booking.damage_charges = float(data.get('damage_charges', 0.00))
    
    # Reset equipment status to Available
    eq = Equipment.query.filter_by(id=booking.equipment_id, tenant_id=user.tenant_id).first()
    if eq:
        eq.rental_status = 'Available'
        
    db.session.commit()
    return jsonify({"data": booking.to_dict(), "meta": None, "errors": None}), 200


# ==================== ANNUAL MAINTENANCE CONTRACTS ====================

@equipment_bp.route('/amc', methods=['GET'])
@jwt_required()
def list_amcs():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    contracts = AMCContract.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    data = []
    for c in contracts:
        c_dict = c.to_dict()
        c_dict['schedules'] = [s.to_dict() for s in c.schedules]
        data.append(c_dict)
    return jsonify({
        "data": data,
        "meta": {"count": len(contracts)},
        "errors": None
    }), 200

@equipment_bp.route('/amc', methods=['POST'])
@jwt_required()
def create_amc():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    cust_id = data.get('customer_id')
    title = data.get('contract_title')
    val = data.get('amc_value')
    
    if not cust_id or not title or not val:
        return jsonify({"data": None, "meta": None, "errors": ["Customer, Contract Title, and Value are required"]}), 400
        
    start = datetime.strptime(data.get('start_date', datetime.utcnow().strftime('%Y-%m-%d')), '%Y-%m-%d')
    end = datetime.strptime(data.get('end_date', (datetime.utcnow() + timedelta(days=365)).strftime('%Y-%m-%d')), '%Y-%m-%d')
    interval = int(data.get('service_interval_days', 90))
    
    from app.services.form_builder_service import extract_custom_fields
    custom_fields = extract_custom_fields('amc', data)
    if data.get('custom_fields'):
        custom_fields.update(data['custom_fields'])

    contract = AMCContract(
        tenant_id=user.tenant_id,
        customer_id=cust_id,
        contract_title=title,
        start_date=start,
        end_date=end,
        amc_value=float(val),
        billing_frequency=data.get('billing_frequency', 'Annual'),
        service_interval_days=interval,
        custom_fields=custom_fields
    )
    db.session.add(contract)
    db.session.flush()
    
    # Auto-generate scheduled service visits
    curr = start + timedelta(days=interval)
    while curr < end:
        schedule = AMCServiceSchedule(
            tenant_id=user.tenant_id,
            amc_id=contract.id,
            scheduled_date=curr,
            status='Pending'
        )
        db.session.add(schedule)
        curr += timedelta(days=interval)
        
    # Add linked equipment if provided
    machine = data.get('machine_name')
    if machine:
        eq = AMCEquipment(
            tenant_id=user.tenant_id,
            amc_id=contract.id,
            machine_name=machine,
            machine_serial=data.get('machine_serial'),
            model=data.get('model'),
            capacity=data.get('capacity')
        )
        db.session.add(eq)
        
    db.session.commit()
    return jsonify({"data": contract.to_dict(), "meta": None, "errors": None}), 201

@equipment_bp.route('/amc/schedule/<int:schedule_id>/visit', methods=['POST'])
@jwt_required()
def log_amc_visit(schedule_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    sched = AMCServiceSchedule.query.filter_by(id=schedule_id, tenant_id=user.tenant_id).first()
    if not sched:
        return jsonify({"data": None, "meta": None, "errors": ["Schedule record not found"]}), 404
        
    data = request.get_json() or {}
    
    sched.status = 'Completed'
    sched.serviced_at = datetime.utcnow()
    sched.findings_report = data.get('findings_report', 'Regular maintenance check ok.')
    
    # Deduct products/spare parts if consumed
    consumed = data.get('parts_consumed') or [] # [{"product_id": x, "qty": y}]
    sched.parts_consumed_json = consumed
    
    for item in consumed:
        pid = item.get('product_id')
        qty = int(item.get('qty', 0))
        if pid and qty > 0:
            prod = Product.query.filter_by(id=pid, tenant_id=user.tenant_id).first()
            if prod:
                prod.current_stock = max(0, int(prod.current_stock or 0) - qty)
                
    db.session.commit()
    return jsonify({"data": sched.to_dict(), "meta": None, "errors": None}), 200
