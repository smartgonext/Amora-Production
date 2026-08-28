"""
Ensure Demo Login Script
========================
Run this anytime to guarantee a demo superadmin user and rich sample data exist.

Usage:
    python ensure_demo_login.py
"""
import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.extensions import db
from app.models.tenant import Tenant, SubscriptionPlan, Subscription, Company, Branch
from app.models.user import User, Role
from app.database_setup import check_and_create_database

# Additional imports for seeding sample data
from app.models.product import ProductCategory, Product, Warehouse, Brand, Unit
from app.models.customer import Customer, Supplier
from app.models.equipment import Equipment, RentalBooking
from app.models.amc import AMCContract, AMCEquipment, AMCServiceSchedule
from app.models.manufacturing import (
    TenantManufacturingConfig, WorkCenter, Machine, BomHeader, BomItem,
    BomRoutingOperation, WorkOrder, WorkOrderOperation, ProductionMaterialIssue,
    MaterialRequirementPlan, JobWorkOrder, QualityInspection, SupplierItemMapping
)
from app.models.bakery import BakingPlan, BakingPlanItem, DeliveryRoute, DeliveryRouteStop, HaccpControlPoint
from app.models.sales import Invoice, InvoiceItem
from app.services.business_type_config import seed_business_type_config

DEMO_EMAIL = 'demo@smartgonext.com'
DEMO_PASSWORD = 'demo123'
DEMO_TENANT_SUBDOMAIN = 'demo'


def seed_demo_data(app, db, tenant, company, branch, user):
    print("Clearing and seeding demo sample data...")
    tenant_id = tenant.id
    
    # 1. Clean existing records for this tenant to ensure a clean state
    db.session.query(HaccpControlPoint).filter_by(tenant_id=tenant_id).delete()
    db.session.query(DeliveryRouteStop).filter(DeliveryRouteStop.route_id.in_(
        db.session.query(DeliveryRoute.id).filter_by(tenant_id=tenant_id)
    )).delete()
    db.session.query(DeliveryRoute).filter_by(tenant_id=tenant_id).delete()
    db.session.query(BakingPlanItem).filter(BakingPlanItem.plan_id.in_(
        db.session.query(BakingPlan.id).filter_by(tenant_id=tenant_id)
    )).delete()
    db.session.query(BakingPlan).filter_by(tenant_id=tenant_id).delete()

    db.session.query(MaterialRequirementPlan).filter_by(tenant_id=tenant_id).delete()
    db.session.query(JobWorkOrder).filter_by(tenant_id=tenant_id).delete()
    db.session.query(QualityInspection).filter_by(tenant_id=tenant_id).delete()
    db.session.query(SupplierItemMapping).filter_by(tenant_id=tenant_id).delete()
    db.session.query(ProductionMaterialIssue).filter_by(tenant_id=tenant_id).delete()
    db.session.query(WorkOrderOperation).filter(WorkOrderOperation.work_order_id.in_(
        db.session.query(WorkOrder.id).filter_by(tenant_id=tenant_id)
    )).delete()
    db.session.query(WorkOrder).filter_by(tenant_id=tenant_id).delete()
    db.session.query(BomRoutingOperation).filter(BomRoutingOperation.bom_id.in_(
        db.session.query(BomHeader.id).filter_by(tenant_id=tenant_id)
    )).delete()
    db.session.query(BomItem).filter(BomItem.bom_id.in_(
        db.session.query(BomHeader.id).filter_by(tenant_id=tenant_id)
    )).delete()
    db.session.query(BomHeader).filter_by(tenant_id=tenant_id).delete()
    db.session.query(Machine).filter_by(tenant_id=tenant_id).delete()
    db.session.query(WorkCenter).filter_by(tenant_id=tenant_id).delete()
    db.session.query(TenantManufacturingConfig).filter_by(tenant_id=tenant_id).delete()
    
    db.session.query(AMCServiceSchedule).filter_by(tenant_id=tenant_id).delete()
    db.session.query(AMCEquipment).filter_by(tenant_id=tenant_id).delete()
    db.session.query(AMCContract).filter_by(tenant_id=tenant_id).delete()
    
    db.session.query(RentalBooking).filter_by(tenant_id=tenant_id).delete()
    db.session.query(Equipment).filter_by(tenant_id=tenant_id).delete()
    
    db.session.query(InvoiceItem).filter_by(tenant_id=tenant_id).delete()
    db.session.query(Invoice).filter_by(tenant_id=tenant_id).delete()
    
    db.session.query(Product).filter_by(tenant_id=tenant_id).delete()
    db.session.query(ProductCategory).filter_by(tenant_id=tenant_id).delete()
    db.session.query(Warehouse).filter_by(tenant_id=tenant_id).delete()
    db.session.query(Brand).filter_by(tenant_id=tenant_id).delete()
    db.session.query(Unit).filter_by(tenant_id=tenant_id).delete()
    
    db.session.query(Customer).filter_by(tenant_id=tenant_id).delete()
    db.session.query(Supplier).filter_by(tenant_id=tenant_id).delete()
    
    db.session.flush()

    # 2. Units & Brands
    pcs = Unit(tenant_id=tenant_id, name='Pieces', short_name='Pcs')
    kg = Unit(tenant_id=tenant_id, name='Kilograms', short_name='Kg')
    liters = Unit(tenant_id=tenant_id, name='Liters', short_name='L')
    db.session.add_all([pcs, kg, liters])
    db.session.flush()
    
    brand = Brand(tenant_id=tenant_id, name='SmartGo Premium')
    db.session.add(brand)
    db.session.flush()

    # 3. Warehouses
    wh_main = Warehouse(tenant_id=tenant_id, company_id=company.id, branch_id=branch.id, name='Main Warehouse', location='Sector 4, Bangalore', is_active=True)
    wh_raw = Warehouse(tenant_id=tenant_id, company_id=company.id, branch_id=branch.id, name='Raw Materials Yard', location='Sector 4, Bangalore', is_active=True)
    db.session.add_all([wh_main, wh_raw])
    db.session.flush()

    # 4. Product Categories
    cat_eq = ProductCategory(tenant_id=tenant_id, name='Heavy Equipment', description='Cranes, forklifts, excavators for rental')
    cat_raw = ProductCategory(tenant_id=tenant_id, name='Raw Materials', description='Steel, hydraulics, motors')
    cat_fg = ProductCategory(tenant_id=tenant_id, name='Finished Goods', description='Manufactured pumps and generators')
    db.session.add_all([cat_eq, cat_raw, cat_fg])
    db.session.flush()

    # 5. Products
    crane_prod = Product(
        tenant_id=tenant_id, company_id=company.id, category_id=cat_eq.id, brand_id=brand.id, unit_id=pcs.id,
        name='Liebherr LTM 1050 Crane', sku='EQ-CRANE-001', hsn_code='84261100', gst_rate=Decimal('18.00'),
        purchase_price=Decimal('12000000.00'), selling_price=Decimal('15000000.00'), min_stock_level=1, current_stock=2,
        description='Heavy duty mobile crane, 50-ton capacity'
    )
    forklift_prod = Product(
        tenant_id=tenant_id, company_id=company.id, category_id=cat_eq.id, brand_id=brand.id, unit_id=pcs.id,
        name='Toyota 8FGU25 Forklift', sku='EQ-FORK-002', hsn_code='84272000', gst_rate=Decimal('18.00'),
        purchase_price=Decimal('85000.00'), selling_price=Decimal('110000.00'), min_stock_level=2, current_stock=5,
        description='Internal combustion pneumatic forklift, 2.5-ton capacity'
    )
    
    steel = Product(
        tenant_id=tenant_id, company_id=company.id, category_id=cat_raw.id, brand_id=brand.id, unit_id=kg.id,
        name='Steel Plate 10mm', sku='RM-STEEL-10MM', hsn_code='72085110', gst_rate=Decimal('18.00'),
        purchase_price=Decimal('85.00'), selling_price=Decimal('110.00'), min_stock_level=500, current_stock=2500,
        is_raw_material=True
    )
    cylinder = Product(
        tenant_id=tenant_id, company_id=company.id, category_id=cat_raw.id, brand_id=brand.id, unit_id=pcs.id,
        name='Hydraulic Cylinder H2', sku='RM-HYD-H2', hsn_code='84122100', gst_rate=Decimal('18.00'),
        purchase_price=Decimal('4500.00'), selling_price=Decimal('6000.00'), min_stock_level=20, current_stock=120,
        is_raw_material=True
    )
    motor = Product(
        tenant_id=tenant_id, company_id=company.id, category_id=cat_raw.id, brand_id=brand.id, unit_id=pcs.id,
        name='Electric Motor 5HP', sku='RM-MTR-5HP', hsn_code='85015220', gst_rate=Decimal('18.00'),
        purchase_price=Decimal('12500.00'), selling_price=Decimal('16000.00'), min_stock_level=10, current_stock=45,
        is_raw_material=True
    )
    
    pump = Product(
        tenant_id=tenant_id, company_id=company.id, category_id=cat_fg.id, brand_id=brand.id, unit_id=pcs.id,
        name='Finished Industrial Pump P100', sku='FG-PUMP-P100', hsn_code='84137010', gst_rate=Decimal('18.00'),
        purchase_price=Decimal('28000.00'), selling_price=Decimal('42000.00'), min_stock_level=5, current_stock=15,
        description='Heavy duty industrial fluid transfer pump'
    )
    
    db.session.add_all([crane_prod, forklift_prod, steel, cylinder, motor, pump])
    db.session.flush()

    # 6. Customers & Suppliers
    cust1 = Customer(tenant_id=tenant_id, name='Mega Builders Corp', email='mega@builders.com', phone='9876543210', address='Metro Project Site A, Mumbai')
    cust2 = Customer(tenant_id=tenant_id, name='Apex Infra Projects', email='apex@infra.com', phone='9876543211', address='Highway Expansion Site B, Bangalore')
    
    supp1 = Supplier(tenant_id=tenant_id, name='Global Steel Industries', email='sales@globalsteel.com', phone='8877665544', address='Industrial Area, Chennai')
    supp2 = Supplier(tenant_id=tenant_id, name='Rexroth Hydraulics', email='support@rexroth.com', phone='8877665545', address='Hydraulics Park, Pune')
    
    db.session.add_all([cust1, cust2, supp1, supp2])
    db.session.flush()

    # 7. Equipment
    eq_crane = Equipment(
        tenant_id=tenant_id, company_id=company.id, name='Liebherr LTM 1050 Crane', type='Crane',
        model_number='LTM-1050', ton_capacity=Decimal('50.00'), serial_number='LH-1050-9988',
        registration_number='MH-12-CR-1100', rental_status='Available', min_hourly_rate=Decimal('2500.00'),
        min_daily_rate=Decimal('12000.00'), purchase_price=Decimal('12000000.00'), purchase_date=datetime.utcnow() - timedelta(days=365)
    )
    eq_forklift = Equipment(
        tenant_id=tenant_id, company_id=company.id, name='Toyota 8FGU25 Forklift', type='Forklift',
        model_number='8FGU25', ton_capacity=Decimal('2.50'), serial_number='TY-25-8877',
        registration_number='KA-03-FL-4567', rental_status='Rented', min_hourly_rate=Decimal('800.00'),
        min_daily_rate=Decimal('4500.00'), purchase_price=Decimal('85000.00'), purchase_date=datetime.utcnow() - timedelta(days=180)
    )
    db.session.add_all([eq_crane, eq_forklift])
    db.session.flush()

    # 8. Rental booking
    booking = RentalBooking(
        tenant_id=tenant_id, company_id=company.id, equipment_id=eq_forklift.id, customer_id=cust1.id,
        booking_number='RB-2026-001', start_date=datetime.utcnow(), end_date=datetime.utcnow() + timedelta(days=10),
        rental_rate_applied=Decimal('4200.00'), rate_type='Daily', security_deposit=Decimal('15000.00'),
        site_address='Metro Project Site A, Mumbai', site_contact_person='Mr. Ramesh K.', site_contact_phone='9876543209',
        total_rental_amount=Decimal('42000.00'), total_amount=Decimal('42000.00'), billing_status='Unbilled', status='Active'
    )
    db.session.add(booking)
    db.session.flush()

    # 9. AMC contracts & scheduling
    amc = AMCContract(
        tenant_id=tenant_id, customer_id=cust1.id, contract_title='Quarterly Crane Maintenance AMC',
        start_date=datetime.utcnow() - timedelta(days=30), end_date=datetime.utcnow() + timedelta(days=335),
        amc_value=Decimal('150000.00'), billing_frequency='Quarterly', service_interval_days=90
    )
    db.session.add(amc)
    db.session.flush()

    amc_eq = AMCEquipment(
        tenant_id=tenant_id, amc_id=amc.id, machine_name='Liebherr LTM 1050 Crane',
        machine_serial='LH-1050-9988', model='LTM-1050', capacity='50-ton'
    )
    db.session.add(amc_eq)
    db.session.flush()

    schedule1 = AMCServiceSchedule(
        tenant_id=tenant_id, amc_id=amc.id, scheduled_date=datetime.utcnow() + timedelta(days=60),
        assigned_technician_id=user.id, status='Pending'
    )
    db.session.add(schedule1)
    db.session.flush()

    # 10. Manufacturing Config & Master Data (Hybrid: Discrete + Bakery/Process)
    mfg_config = TenantManufacturingConfig(
        tenant_id=tenant_id,
        mfg_type='hybrid',
        bom_label='BOM & Recipe',
        tracking_label='Serial / Batch Number',
        operation_label='Routing / Process Step',
        enabled_features=[
            'routing', 'mrp', 'work_orders', 'quality_control', 'job_work',
            'baker_pct_scaling', 'freshness', 'fefo', 'haccp', 'qc', 'batch_tracking',
            'subcontracting', 'baking_plan', 'fresh_returns', 'day_cost'
        ],
        is_active=True
    )
    db.session.add(mfg_config)
    db.session.flush()

    wc_assembly = WorkCenter(
        tenant_id=tenant_id, name='Assembly Line A', hourly_labor_rate=Decimal('150.00'),
        hourly_machine_rate=Decimal('250.00'), capacity_limit=8, description='Main assembly line for industrial pump P100'
    )
    wc_welding = WorkCenter(
        tenant_id=tenant_id, name='Welding Shop', hourly_labor_rate=Decimal('200.00'),
        hourly_machine_rate=Decimal('300.00'), capacity_limit=4, description='Welding shop for structures and frames'
    )
    db.session.add_all([wc_assembly, wc_welding])
    db.session.flush()

    # BOM Header
    bom = BomHeader(
        tenant_id=tenant_id, company_id=company.id, product_id=pump.id, version='V1.0',
        name='BOM for Finished Industrial Pump P100', status='active', standard_cost=Decimal('21500.00'),
        overhead_cost=Decimal('5000.00'), total_setup_time_mins=30, notes='Primary production recipe'
    )
    db.session.add(bom)
    db.session.flush()

    # BOM Items
    item1 = BomItem(bom_id=bom.id, item_id=motor.id, qty_required=Decimal('1.0000'), uom='Pcs')
    item2 = BomItem(bom_id=bom.id, item_id=cylinder.id, qty_required=Decimal('2.0000'), uom='Pcs')
    item3 = BomItem(bom_id=bom.id, item_id=steel.id, qty_required=Decimal('4.0000'), uom='Kg')
    db.session.add_all([item1, item2, item3])
    db.session.flush()

    # Routing Operations
    op10 = BomRoutingOperation(
        bom_id=bom.id, operation_sequence=10, operation_name='Welding Frame',
        work_center_id=wc_welding.id, setup_time_mins=15, processing_time_per_unit_mins=Decimal('30.0000'),
        labor_hours_per_unit=Decimal('0.5000')
    )
    op20 = BomRoutingOperation(
        bom_id=bom.id, operation_sequence=20, operation_name='Final Assembly',
        work_center_id=wc_assembly.id, setup_time_mins=15, processing_time_per_unit_mins=Decimal('45.0000'),
        labor_hours_per_unit=Decimal('0.7500')
    )
    db.session.add_all([op10, op20])
    db.session.flush()

    # 11. Work Orders & WIP
    wo = WorkOrder(
        tenant_id=tenant_id, company_id=company.id, bom_id=bom.id, wo_number='WO-2026-P100-001',
        planned_qty=Decimal('10.0000'), produced_qty=Decimal('4.0000'), start_date=datetime.utcnow() - timedelta(days=2),
        due_date=datetime.utcnow() + timedelta(days=5), status='wip', notes='Urgent shipment for customer Mega Builders Corp'
    )
    db.session.add(wo)
    db.session.flush()

    # Work Order Operations
    wo_op10 = WorkOrderOperation(
        work_order_id=wo.id, operation_sequence=10, operation_name='Welding Frame',
        work_center_id=wc_welding.id, status='completed', started_at=datetime.utcnow() - timedelta(days=2),
        completed_at=datetime.utcnow() - timedelta(days=1), actual_setup_time=15, actual_run_time=32,
        operator_user_id=user.id
    )
    wo_op20 = WorkOrderOperation(
        work_order_id=wo.id, operation_sequence=20, operation_name='Final Assembly',
        work_center_id=wc_assembly.id, status='in_progress', started_at=datetime.utcnow() - timedelta(days=1),
        actual_setup_time=15, actual_run_time=45, operator_user_id=user.id
    )
    db.session.add_all([wo_op10, wo_op20])
    db.session.flush()

    # Production Material Issues (planned vs issued/consumed)
    pmi1 = ProductionMaterialIssue(
        tenant_id=tenant_id, work_order_id=wo.id, item_id=motor.id, warehouse_id=wh_raw.id,
        qty_planned=Decimal('10.0000'), qty_issued=Decimal('10.0000'), qty_consumed=Decimal('4.0000'),
        qty_returned=Decimal('0.0000'), variance=Decimal('0.0000')
    )
    pmi2 = ProductionMaterialIssue(
        tenant_id=tenant_id, work_order_id=wo.id, item_id=cylinder.id, warehouse_id=wh_raw.id,
        qty_planned=Decimal('20.0000'), qty_issued=Decimal('20.0000'), qty_consumed=Decimal('8.0000'),
        qty_returned=Decimal('0.0000'), variance=Decimal('0.0000')
    )
    pmi3 = ProductionMaterialIssue(
        tenant_id=tenant_id, work_order_id=wo.id, item_id=steel.id, warehouse_id=wh_raw.id,
        qty_planned=Decimal('40.0000'), qty_issued=Decimal('40.0000'), qty_consumed=Decimal('16.0000'),
        qty_returned=Decimal('0.0000'), variance=Decimal('0.0000')
    )
    db.session.add_all([pmi1, pmi2, pmi3])
    db.session.flush()

    # 12. Invoices
    inv = Invoice(
        tenant_id=tenant_id, company_id=company.id, branch_id=branch.id, customer_id=cust1.id,
        invoice_number='INV-2026-001', invoice_date=datetime.utcnow() - timedelta(days=3),
        due_date=datetime.utcnow() + timedelta(days=27), type='Rental', subtotal=Decimal('42000.00'),
        cgst_amount=Decimal('3780.00'), sgst_amount=Decimal('3780.00'), total_amount=Decimal('49560.00'),
        net_amount=Decimal('49560.00'), payment_method='BankTransfer', payment_status='Paid', outstanding_balance=Decimal('0.00'),
        notes='Billing for rental of Toyota Forklift'
    )
    db.session.add(inv)
    db.session.flush()

    inv_item = InvoiceItem(
        tenant_id=tenant_id, invoice_id=inv.id, product_id=forklift_prod.id,
        description='Toyota 8FGU25 Forklift Rental - 10 Days', quantity=10, rate=Decimal('4200.00'),
        gst_rate=Decimal('18.00'), cgst_amount=Decimal('3780.00'), sgst_amount=Decimal('3780.00'), total_amount=Decimal('49560.00')
    )
    db.session.add(inv_item)
    db.session.flush()


    # 13. Bakery Production Planning & HACCP Data
    bread_prod = Product(
        tenant_id=tenant_id, company_id=company.id, category_id=cat_fg.id, brand_id=brand.id, unit_id=pcs.id,
        name='Artisanal Sourdough Bread 500g', sku='BAK-BREAD-001', hsn_code='1905', gst_rate=Decimal('5.00'),
        purchase_price=Decimal('40.00'), selling_price=Decimal('120.00'), min_stock_level=20, current_stock=150,
        description='Freshly baked sourdough loaf', shelf_life_days=3
    )
    db.session.add(bread_prod)
    db.session.flush()

    bake_plan = BakingPlan(
        tenant_id=tenant_id, company_id=company.id,
        plan_date=datetime.utcnow().date(), shift='Morning', status='in_progress'
    )
    db.session.add(bake_plan)
    db.session.flush()

    bake_item = BakingPlanItem(
        plan_id=bake_plan.id, tenant_id=tenant_id, product_id=bread_prod.id,
        order_demand=50, forecast_qty=80, planned_qty=130, batch_size=25, num_batches=6,
        oven='Deck Oven 1', status='baking', notes='High demand weekend bake'
    )
    db.session.add(bake_item)
    db.session.flush()

    route = DeliveryRoute(
        tenant_id=tenant_id, company_id=company.id,
        route_date=datetime.utcnow().date(), vehicle_no='KA-01-BK-2026', driver='Ramesh Bakery Express',
        status='in_transit', notes='Morning fresh delivery route'
    )
    db.session.add(route)
    db.session.flush()

    stop = DeliveryRouteStop(
        route_id=route.id, tenant_id=tenant_id, customer_id=cust1.id, sequence=1, status='delivered',
        notes='50 loaves delivered'
    )
    db.session.add(stop)
    db.session.flush()

    haccp = HaccpControlPoint(
        tenant_id=tenant_id, company_id=company.id, bake_plan_item_id=bake_item.id,
        checkpoint_name='Oven Temperature Check', recorded_value='230C', spec_min=Decimal('220.00'),
        spec_max=Decimal('240.00'), unit='C', is_pass=True, checked_by=user.id,
        checked_at=datetime.utcnow(), notes='Optimal crust formation'
    )
    db.session.add(haccp)
    db.session.flush()


def ensure_schema_updates(db):
    columns_to_add = [
        ("products", "shelf_life_days", "INT NULL"),
        ("products", "best_before_days", "INT NULL"),
        ("products", "is_fresh", "TINYINT(1) NOT NULL DEFAULT 0"),
        ("products", "allergens", "JSON NULL"),
        ("products", "nutrition", "JSON NULL"),
        ("bom_headers", "hydration_pct", "DECIMAL(8, 4) DEFAULT 0.0000"),
        ("bom_headers", "dough_yield_pct", "DECIMAL(8, 4) DEFAULT 0.0000"),
        ("bom_headers", "bake_loss_pct", "DECIMAL(8, 4) DEFAULT 0.0000"),
        ("bom_items", "baker_pct", "DECIMAL(8, 4) NULL"),
    ]
    for table, col, col_type in columns_to_add:
        try:
            db.session.execute(db.text(f"ALTER TABLE `{table}` ADD COLUMN `{col}` {col_type}"))
            db.session.commit()
        except Exception:
            db.session.rollback()


def ensure_demo_login():
    # Make sure the database exists
    check_and_create_database()

    app = create_app('dev')

    with app.app_context():
        # Ensure tables exist
        db.create_all()
        ensure_schema_updates(db)

        # 1. Ensure a demo tenant exists
        demo_tenant = Tenant.query.filter_by(subdomain=DEMO_TENANT_SUBDOMAIN).first()
        if not demo_tenant:
            print("Creating demo tenant...")
            demo_tenant = Tenant(
                name='SmartGo ERP Demo',
                subdomain=DEMO_TENANT_SUBDOMAIN,
                business_type='Universal ERP'
            )
            db.session.add(demo_tenant)
            db.session.flush()

            # Make sure a Free Trial plan exists
            free_plan = SubscriptionPlan.query.filter_by(name='Free Trial').first()
            if not free_plan:
                free_plan = SubscriptionPlan(
                    name='Free Trial',
                    price=0.00,
                    billing_cycle='monthly',
                    allowed_devices=1,
                    max_users=3,
                    max_storage_mb=100,
                    description='15-day free trial with limited features'
                )
                db.session.add(free_plan)
                db.session.flush()

            subscription = Subscription(
                tenant_id=demo_tenant.id,
                plan_id=free_plan.id,
                status='active',
                start_date=datetime.utcnow(),
                expiry_date=datetime.utcnow() + timedelta(days=365)
            )
            db.session.add(subscription)
            db.session.flush()

            # Company
            company = Company(
                tenant_id=demo_tenant.id,
                name='SmartGo Universal Enterprise',
                email='info@smartgoservices.com',
                phone='9988776655',
                business_type='Universal ERP',
                is_head_office=True
            )
            db.session.add(company)
            db.session.flush()

            # Branch
            branch = Branch(
                tenant_id=demo_tenant.id,
                company_id=company.id,
                name='Head Office',
                code='HO',
                city='Bangalore',
                state='Karnataka',
                phone='9988776601',
                email='ho@smartgo.com',
                is_main=True,
                is_active=True
            )
            db.session.add(branch)
            db.session.flush()

            # Admin role
            admin_role = Role(
                tenant_id=demo_tenant.id,
                name='Admin',
                description='Full access to all operations and configuration'
            )
            db.session.add(admin_role)
            db.session.flush()
        else:
            demo_tenant.business_type = 'Universal ERP'
            db.session.add(demo_tenant)
            company = Company.query.filter_by(tenant_id=demo_tenant.id).first()
            if company:
                company.business_type = 'Universal ERP'
                db.session.add(company)
            branch = Branch.query.filter_by(tenant_id=demo_tenant.id).first()
            admin_role = Role.query.filter_by(tenant_id=demo_tenant.id, name='Admin').first()
            if not admin_role:
                admin_role = Role(
                    tenant_id=demo_tenant.id,
                    name='Admin',
                    description='Full access to all operations and configuration'
                )
                db.session.add(admin_role)
                db.session.flush()

        # 2. Ensure the demo admin user exists and has superadmin powers
        user = User.query.filter_by(email=DEMO_EMAIL).first()
        if not user:
            print("Creating demo admin user...")
            user = User(
                tenant_id=demo_tenant.id,
                company_id=company.id if company else None,
                branch_id=branch.id if branch else None,
                name='Demo Admin',
                email=DEMO_EMAIL,
                phone='9876543210',
                role_id=admin_role.id,
                is_active=True,
                is_superadmin=True
            )
            user.set_password(DEMO_PASSWORD)
            db.session.add(user)
            db.session.flush()
        else:
            user.is_superadmin = True
            user.is_active = True
            user.role_id = admin_role.id
            user.set_password(DEMO_PASSWORD)
            db.session.add(user)
            db.session.flush()

        # 3. Seed/Re-seed demo data
        seed_demo_data(app, db, demo_tenant, company, branch, user)

        # 4. Seed full business type config so demo admin has access to ALL modules (Rentals, Manufacturing, Bakery, HR, POS, etc.)
        if company:
            seed_business_type_config(demo_tenant.id, company.id, 'Universal ERP', commit=False)
        
        db.session.commit()

        print("\n========================================")
        print("  Demo database & sample data seeded successfully!")
        print("========================================")
        print(f"  Email   : {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
        print("========================================\n")


if __name__ == '__main__':
    ensure_demo_login()