from datetime import datetime, timedelta, date
from app import create_app
from app.extensions import db
from app.models.tenant import Tenant, SubscriptionPlan, Subscription, Company, License, Branch
from app.models.user import User, Role, Permission
from app.models.customer import Customer, Supplier
from app.models.product import ProductCategory, Product, Brand, Unit, Warehouse
from app.models.equipment import Equipment, RentalBooking
from app.models.amc import AMCContract, AMCEquipment
from app.models.hr import Employee
from app.models.project import Project
from app.models.document import Document
from app.models.finance import ChartOfAccount
from decimal import Decimal
from app.models.manufacturing import (
    TenantManufacturingConfig, BomHeader, BomItem, BomByproduct,
    WorkCenter, Machine, BomRoutingOperation, SupplierItemMapping,
    MaterialRequirementPlan, WorkOrder, WorkOrderOperation,
    ProductionMaterialIssue, QualityInspection, JobWorkOrder,
)
from app.database_setup import check_and_create_database
from app.services.template_initializer import seed_default_templates

def seed_database():
    # Create the Flask application context
    app = create_app('dev')
    
    with app.app_context():
        print("Creating all tables in database...")
        db.create_all()
        print("All tables created successfully.")
        
        # 1. Seed Subscription Plans
        plans_data = [
            {"name": "Free Trial", "price": 0.00, "billing_cycle": "monthly", "allowed_devices": 1, "max_users": 3, "max_storage_mb": 100, "description": "15-day free trial with limited features"},
            {"name": "Starter", "price": 999.00, "billing_cycle": "monthly", "allowed_devices": 1, "max_users": 5, "max_storage_mb": 500, "description": "For small businesses starting out"},
            {"name": "Growth", "price": 2999.00, "billing_cycle": "monthly", "allowed_devices": 2, "max_users": 15, "max_storage_mb": 2000, "description": "For growing businesses with multiple users"},
            {"name": "Enterprise", "price": 7999.00, "billing_cycle": "monthly", "allowed_devices": 5, "max_users": 50, "max_storage_mb": 10000, "description": "Full-featured for large organizations"},
            {"name": "Enterprise Annual", "price": 79990.00, "billing_cycle": "annual", "allowed_devices": 10, "max_users": 100, "max_storage_mb": 50000, "description": "Best value for enterprises (2 months free)"}
        ]
        
        print("Seeding Subscription Plans...")
        for p_data in plans_data:
            existing = SubscriptionPlan.query.filter_by(name=p_data['name']).first()
            if not existing:
                plan = SubscriptionPlan(**p_data)
                db.session.add(plan)
        
        # 2. Seed Default Permissions for all ERP modules
        modules = ['products', 'customers', 'suppliers', 'purchases', 'sales', 'inventory', 
                   'finance', 'hr', 'projects', 'documents', 'reports', 'settings',
                   'equipment', 'rentals', 'amc', 'repairs', 'pos', 'branches', 'users']
        actions = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'PRINT']
        
        print("Seeding Permissions...")
        for module in modules:
            for action in actions:
                name = f"{action}_{module.upper()}"
                existing = Permission.query.filter_by(name=name).first()
                if not existing:
                    perm = Permission(name=name, module=module, action=action)
                    db.session.add(perm)
                    
        db.session.commit()
        
        # 3. Seed Demo Tenant & Demo User for testing ERP
        print("Checking for Demo Tenant...")
        demo_tenant = Tenant.query.filter_by(subdomain='demo').first()
        if not demo_tenant:
            print("Seeding Demo Tenant and Admin User...")
            demo_tenant = Tenant(name="SmartGo ERP Demo", subdomain="demo", business_type="Universal ERP")
            db.session.add(demo_tenant)
            db.session.flush()
            
            # Sub Plan
            free_plan = SubscriptionPlan.query.filter_by(name='Free Trial').first()
            
            # Subscription
            sub = Subscription(
                tenant_id=demo_tenant.id,
                plan_id=free_plan.id,
                status='active',
                start_date=datetime.utcnow(),
                expiry_date=datetime.utcnow() + timedelta(days=365)
            )
            db.session.add(sub)
            db.session.flush()
            
            # Company
            company = Company(
                tenant_id=demo_tenant.id,
                name="SmartGo Universal Enterprise",
                email="info@smartgoservices.com",
                phone="9988776655",
                business_type="Universal ERP",
                is_head_office=True
            )
            db.session.add(company)
            db.session.flush()
            
            # Seed default visual templates & UI config
            seed_default_templates(demo_tenant.id, company.id, commit=False)
            from app.services.business_type_config import seed_business_type_config
            seed_business_type_config(demo_tenant.id, company.id, 'Universal ERP', commit=False)
            
            # Branches
            branches_data = [
                {"name": "Head Office", "code": "HO", "city": "Bangalore", "state": "Karnataka", "phone": "9988776601", "email": "ho@smartgo.com", "is_active": True},
                {"name": "Mumbai Branch", "code": "MUM", "city": "Mumbai", "state": "Maharashtra", "phone": "9988776602", "email": "mumbai@smartgo.com", "is_active": True},
                {"name": "Delhi Branch", "code": "DEL", "city": "New Delhi", "state": "Delhi", "phone": "9988776603", "email": "delhi@smartgo.com", "is_active": True},
            ]
            branch_map = {}
            for b_data in branches_data:
                branch = Branch(tenant_id=demo_tenant.id, company_id=company.id, **b_data)
                db.session.add(branch)
                db.session.flush()
                branch_map[b_data['name']] = branch
            
            # Default Roles
            roles_data = [
                {"name": "Admin", "description": "Full access to all operations and configuration"},
                {"name": "Manager", "description": "Manager role with access to rentals, repair and billing"},
                {"name": "Sales Person", "description": "Sales, quotations, and customer management"},
                {"name": "Accountant", "description": "Finance, invoicing, and reports access"},
                {"name": "Cashier", "description": "POS billing and payment collection"},
                {"name": "Operator", "description": "Equipment operator and field staff"}
            ]
            roles_map = {}
            for r_data in roles_data:
                role = Role(tenant_id=demo_tenant.id, name=r_data['name'], description=r_data['description'])
                db.session.add(role)
                db.session.flush()
                roles_map[r_data['name']] = role
                
            # Users
            users_data = [
                {"name": "Demo Admin", "email": "demo@smartgonext.com", "password": "demo123", "role": "Admin", "phone": "9876543210"},
                {"name": "Ravi Kumar", "email": "ravi@smartgo.com", "password": "ravi123", "role": "Manager", "phone": "9876543211"},
                {"name": "Anita Sharma", "email": "anita@smartgo.com", "password": "anita123", "role": "Accountant", "phone": "9876543212"},
                {"name": "Vijay Singh", "email": "vijay@smartgo.com", "password": "vijay123", "role": "Sales Person", "phone": "9876543213"},
                {"name": "Priya Mehta", "email": "priyam@smartgo.com", "password": "priya123", "role": "Cashier", "phone": "9876543214"},
                {"name": "Suresh Reddy", "email": "suresh@smartgo.com", "password": "suresh123", "role": "Operator", "phone": "9876543215"},
            ]
            for u_data in users_data:
                user = User(
                    tenant_id=demo_tenant.id,
                    company_id=company.id,
                    name=u_data['name'],
                    email=u_data['email'],
                    phone=u_data['phone'],
                    role_id=roles_map[u_data['role']].id,
                    is_active=True,
                    is_superadmin=(u_data['role'] == 'Admin')
                )
                user.set_password(u_data['password'])
                db.session.add(user)
            db.session.flush()
            
            # ===== PRODUCTS =====
            print("Seeding Products & Categories...")
            # Categories
            categories_data = [
                {"name": "Construction Equipment", "description": "Heavy machinery for construction"},
                {"name": "Spare Parts", "description": "Replacement parts and accessories"},
                {"name": "Safety Gear", "description": "Safety equipment and protective gear"},
                {"name": "Lubricants", "description": "Oils and lubricants"},
                {"name": "Tools", "description": "Hand and power tools"},
            ]
            cat_map = {}
            for c_data in categories_data:
                cat = ProductCategory(tenant_id=demo_tenant.id, name=c_data['name'], description=c_data['description'])
                db.session.add(cat)
                db.session.flush()
                cat_map[c_data['name']] = cat
            
            # Brands
            brands_data = [
                {"name": "Caterpillar", "description": "American construction equipment manufacturer"},
                {"name": "Komatsu", "description": "Japanese construction equipment manufacturer"},
                {"name": "JCB", "description": "British construction equipment manufacturer"},
                {"name": "Tata Hitachi", "description": "Indian construction equipment manufacturer"},
                {"name": "Bosch", "description": "German automotive parts manufacturer"},
            ]
            brand_map = {}
            for b_data in brands_data:
                brand = Brand(tenant_id=demo_tenant.id, name=b_data['name'])
                db.session.add(brand)
                db.session.flush()
                brand_map[b_data['name']] = brand
            
            # Units
            units_data = [
                {"name": "Pieces", "short_name": "Pcs"},
                {"name": "Kilograms", "short_name": "Kg"},
                {"name": "Liters", "short_name": "Ltr"},
                {"name": "Meters", "short_name": "Mtr"},
                {"name": "Box", "short_name": "Box"},
                {"name": "Pair", "short_name": "Pr"},
                {"name": "Set", "short_name": "Set"},
            ]
            unit_map = {}
            for u_data in units_data:
                unit = Unit(tenant_id=demo_tenant.id, name=u_data['name'], short_name=u_data['short_name'])
                db.session.add(unit)
                db.session.flush()
                unit_map[u_data['name']] = unit
            
            # Products
            products_data = [
                {"name": "Hydraulic Excavator Bucket", "sku": "HEB-001", "category": "Construction Equipment", "brand": "Caterpillar", "unit": "Pieces", "hsn_code": "8431", "purchase_price": 450000, "selling_price": 550000, "gst_rate": 18, "current_stock": 5, "min_stock_level": 2, "is_raw_material": False},
                {"name": "JCB 3DX Backhoe Loader", "sku": "JCB-3DX", "category": "Construction Equipment", "brand": "JCB", "unit": "Pieces", "hsn_code": "8429", "purchase_price": 2800000, "selling_price": 3500000, "gst_rate": 18, "current_stock": 3, "min_stock_level": 1, "is_raw_material": False},
                {"name": "Hydraulic Oil 20L", "sku": "HO-20L", "category": "Lubricants", "brand": "Bosch", "unit": "Liters", "hsn_code": "2710", "purchase_price": 3200, "selling_price": 4200, "gst_rate": 18, "current_stock": 50, "min_stock_level": 10, "is_raw_material": False},
                {"name": "Engine Oil 5L", "sku": "EO-5L", "category": "Lubricants", "brand": "Bosch", "unit": "Liters", "hsn_code": "2710", "purchase_price": 1200, "selling_price": 1600, "gst_rate": 18, "current_stock": 100, "min_stock_level": 20, "is_raw_material": False},
                {"name": "Safety Helmet", "sku": "SH-001", "category": "Safety Gear", "brand": "Bosch", "unit": "Pieces", "hsn_code": "6506", "purchase_price": 350, "selling_price": 550, "gst_rate": 12, "current_stock": 200, "min_stock_level": 50, "is_raw_material": False},
                {"name": "Safety Vest (High Visibility)", "sku": "SV-001", "category": "Safety Gear", "brand": "Bosch", "unit": "Pieces", "hsn_code": "6210", "purchase_price": 180, "selling_price": 299, "gst_rate": 12, "current_stock": 150, "min_stock_level": 30, "is_raw_material": False},
                {"name": "Steel-toe Boots", "sku": "STB-001", "category": "Safety Gear", "brand": "Bosch", "unit": "Pair", "hsn_code": "6403", "purchase_price": 1200, "selling_price": 1899, "gst_rate": 12, "current_stock": 80, "min_stock_level": 15, "is_raw_material": False},
                {"name": "Crane Hook 10 Ton", "sku": "CH-10T", "category": "Spare Parts", "brand": "Komatsu", "unit": "Pieces", "hsn_code": "8431", "purchase_price": 8500, "selling_price": 0, "gst_rate": 18, "current_stock": 15, "min_stock_level": 5, "is_raw_material": True},
                {"name": "Hydraulic Filter Kit", "sku": "HFK-001", "category": "Spare Parts", "brand": "Tata Hitachi", "unit": "Set", "hsn_code": "8421", "purchase_price": 2200, "selling_price": 0, "gst_rate": 18, "current_stock": 40, "min_stock_level": 10, "is_raw_material": True},
                {"name": "Welding Electrode 5kg Box", "sku": "WE-5KG", "category": "Tools", "brand": "Bosch", "unit": "Box", "hsn_code": "8311", "purchase_price": 650, "selling_price": 0, "gst_rate": 18, "current_stock": 60, "min_stock_level": 15, "is_raw_material": True},
            ]
            product_map = {}
            for p_data in products_data:
                prod = Product(
                    tenant_id=demo_tenant.id,
                    company_id=company.id,
                    category_id=cat_map[p_data['category']].id,
                    brand_id=brand_map[p_data['brand']].id,
                    unit_id=unit_map[p_data['unit']].id,
                    name=p_data['name'],
                    sku=p_data['sku'],
                    hsn_code=p_data['hsn_code'],
                    gst_rate=p_data['gst_rate'],
                    purchase_price=p_data['purchase_price'],
                    selling_price=p_data['selling_price'],
                    current_stock=p_data['current_stock'],
                    opening_stock=p_data['current_stock'],
                    min_stock_level=p_data['min_stock_level'],
                    is_raw_material=p_data.get('is_raw_material', False),
                    is_active=True
                )
                db.session.add(prod)
                db.session.flush()
                product_map[p_data['name']] = prod
            
            # Warehouses
            warehouses_data = [
                {"name": "Main Warehouse - Bangalore", "location": "Industrial Area, Bangalore", "branch": "Head Office"},
                {"name": "Mumbai Depot", "location": "Navi Mumbai, Maharashtra", "branch": "Mumbai Branch"},
                {"name": "Delhi Storage", "location": "Okhla, New Delhi", "branch": "Delhi Branch"},
            ]
            warehouse_map = {}
            for w_data in warehouses_data:
                w = Warehouse(
                    tenant_id=demo_tenant.id,
                    company_id=company.id,
                    branch_id=branch_map[w_data['branch']].id if w_data['branch'] else None,
                    name=w_data['name'],
                    location=w_data['location'],
                    is_active=True
                )
                db.session.add(w)
                db.session.flush()
                warehouse_map[w_data['name']] = w
            
            # ===== CUSTOMERS =====
            print("Seeding Customers...")
            customers_data = [
                {"name": "Aravind Kumar", "phone": "9876543201", "email": "aravind@gmail.com", "address": "Indiranagar, Bangalore", "city": "Bangalore", "state": "Karnataka", "gstin": "29ABCDE1234F1Z5", "credit_limit": 500000, "credit_period_days": 30},
                {"name": "Sneha Reddy", "phone": "9876543202", "email": "sneha@gmail.com", "address": "Jubilee Hills, Hyderabad", "city": "Hyderabad", "state": "Telangana", "gstin": "36FGHIJ5678K2L0", "credit_limit": 300000, "credit_period_days": 45},
                {"name": "Rohan Sharma", "phone": "9876543203", "email": "rohan@gmail.com", "address": "Saket, New Delhi", "city": "New Delhi", "state": "Delhi", "gstin": "07KLMNO9012P3Q4", "credit_limit": 750000, "credit_period_days": 60},
                {"name": "Priya Patel", "phone": "9876543204", "email": "priya@gmail.com", "address": "Bandra, Mumbai", "city": "Mumbai", "state": "Maharashtra", "gstin": "27PQRST3456U7V8", "credit_limit": 200000, "credit_period_days": 30},
                {"name": "Vikram Construction Co.", "phone": "9876543205", "email": "info@vikramconst.com", "address": "Whitefield, Bangalore", "city": "Bangalore", "state": "Karnataka", "gstin": "29WXYZA7890B1C2", "credit_limit": 1000000, "credit_period_days": 60},
                {"name": "Goyal Infrastructure", "phone": "9876543206", "email": "contact@goyalinfra.com", "address": "Andheri East, Mumbai", "city": "Mumbai", "state": "Maharashtra", "gstin": "27DEFGH1234I5J6", "credit_limit": 800000, "credit_period_days": 45},
            ]
            for c_data in customers_data:
                customer = Customer(
                    tenant_id=demo_tenant.id,
                    company_id=company.id,
                    **c_data
                )
                db.session.add(customer)
            
            # ===== SUPPLIERS =====
            print("Seeding Suppliers...")
            suppliers_data = [
                {"name": "Tata Motors Ltd", "phone": "9988776611", "email": "sales@tatamotors.com", "address": "Mumbai, Maharashtra", "city": "Mumbai", "state": "Maharashtra", "gstin": "27TATAMOTOR1Z5", "credit_limit": 2000000, "payment_terms": "45 days"},
                {"name": "JCB India Ltd", "phone": "9988776612", "email": "orders@jcb.com", "address": "Faridabad, Haryana", "city": "Faridabad", "state": "Haryana", "gstin": "06JCBLIMIT2X0", "credit_limit": 5000000, "payment_terms": "60 days"},
                {"name": "Bosch Auto Parts", "phone": "9988776613", "email": "parts@bosch.in", "address": "Bengaluru, Karnataka", "city": "Bengaluru", "state": "Karnataka", "gstin": "29BOSCHCORP3K4", "credit_limit": 1000000, "payment_terms": "30 days"},
                {"name": "Shell Lubricants", "phone": "9988776614", "email": "lubricants@shell.com", "address": "Gurugram, Haryana", "city": "Gurugram", "state": "Haryana", "gstin": "06SHELLOIL4P8", "credit_limit": 800000, "payment_terms": "45 days"},
                {"name": "Cummins India", "phone": "9988776615", "email": "info@cummins.com", "address": "Pune, Maharashtra", "city": "Pune", "state": "Maharashtra", "gstin": "27CUMMINSIN5R2", "credit_limit": 3000000, "payment_terms": "60 days"},
                {"name": "Precision Job Works & Fabricators", "phone": "9988776616", "email": "jobwork@precision.com", "address": "Chakan MIDC, Pune", "city": "Pune", "state": "Maharashtra", "gstin": "27PRECISION1Z5", "credit_limit": 500000, "payment_terms": "30 days", "is_job_work_vendor": True},
            ]
            for s_data in suppliers_data:
                supplier = Supplier(
                    tenant_id=demo_tenant.id,
                    company_id=company.id,
                    **s_data
                )
                db.session.add(supplier)
            
            # ===== EQUIPMENT =====
            print("Seeding Equipment...")
            equipment_data = [
                {"name": "Caterpillar 320 Excavator", "type": "Excavator", "model_number": "CAT-320-D2", "ton_capacity": 20, "serial_number": "CAT320D2-2024-001", "registration_number": "KA-01-EX-2024", "rental_status": "Available", "purchase_price": 8500000, "min_hourly_rate": 2500, "min_daily_rate": 18000, "min_weekly_rate": 100000, "min_monthly_rate": 350000, "insurance_expiry": datetime(2026, 12, 31), "fitness_expiry": datetime(2026, 6, 30)},
                {"name": "JCB 3DX Backhoe", "type": "Backhoe", "model_number": "JCB-3DX-2024", "ton_capacity": 3, "serial_number": "JCB3DX-2024-002", "registration_number": "KA-01-BH-2024", "rental_status": "Available", "purchase_price": 3200000, "min_hourly_rate": 1500, "min_daily_rate": 10000, "min_weekly_rate": 55000, "min_monthly_rate": 200000, "insurance_expiry": datetime(2026, 11, 30), "fitness_expiry": datetime(2026, 5, 31)},
                {"name": "Komatsu PC210 Excavator", "type": "Excavator", "model_number": "PC210-10", "ton_capacity": 21, "serial_number": "KMT-PC210-2024-003", "registration_number": "KA-01-EX-2025", "rental_status": "Available", "purchase_price": 7800000, "min_hourly_rate": 2200, "min_daily_rate": 16000, "min_weekly_rate": 90000, "min_monthly_rate": 320000, "insurance_expiry": datetime(2026, 10, 31), "fitness_expiry": datetime(2026, 4, 30)},
                {"name": "Tata Hitachi EX200", "type": "Excavator", "model_number": "EX200-5", "ton_capacity": 20, "serial_number": "THEX200-2024-004", "registration_number": "KA-01-EX-2026", "rental_status": "Rented", "purchase_price": 7200000, "min_hourly_rate": 2000, "min_daily_rate": 14000, "min_weekly_rate": 80000, "min_monthly_rate": 280000, "insurance_expiry": datetime(2026, 9, 30), "fitness_expiry": datetime(2026, 3, 31)},
                {"name": "Caterpillar D6 Dozer", "type": "Dozer", "model_number": "D6-XE", "ton_capacity": 25, "serial_number": "CATD6-2024-005", "registration_number": "KA-01-DZ-2024", "rental_status": "Available", "purchase_price": 12000000, "min_hourly_rate": 3500, "min_daily_rate": 25000, "min_weekly_rate": 140000, "min_monthly_rate": 500000, "insurance_expiry": datetime(2027, 1, 31), "fitness_expiry": datetime(2026, 7, 31)},
                {"name": "Crane 20 Ton", "type": "Crane", "model_number": "CR-20T-HYD", "ton_capacity": 20, "serial_number": "CRN-2024-006", "registration_number": "KA-01-CR-2024", "rental_status": "Maintenance", "purchase_price": 15000000, "min_hourly_rate": 5000, "min_daily_rate": 35000, "min_weekly_rate": 200000, "min_monthly_rate": 700000, "insurance_expiry": datetime(2026, 8, 31), "fitness_expiry": datetime(2026, 2, 28)},
            ]
            equipment_map = {}
            for e_data in equipment_data:
                equip = Equipment(
                    tenant_id=demo_tenant.id,
                    company_id=company.id,
                    **e_data
                )
                db.session.add(equip)
                db.session.flush()
                equipment_map[e_data['name']] = equip
            
            # ===== AMC CONTRACTS =====
            print("Seeding AMC Contracts...")
            # Get first customer for AMC reference
            first_customer = Customer.query.filter_by(tenant_id=demo_tenant.id).first()
            amc_data = [
                {"contract_title": "CAT 320 Annual Maintenance", "equipment_name": "Caterpillar 320 Excavator", "amc_value": 120000, "start_date": datetime(2026, 1, 1), "end_date": datetime(2026, 12, 31), "service_interval_days": 90},
                {"contract_title": "JCB 3DX Service Contract", "equipment_name": "JCB 3DX Backhoe", "amc_value": 85000, "start_date": datetime(2026, 3, 1), "end_date": datetime(2026, 9, 30), "service_interval_days": 60},
                {"contract_title": "Komatsu PC210 AMC", "equipment_name": "Komatsu PC210 Excavator", "amc_value": 150000, "start_date": datetime(2026, 6, 1), "end_date": datetime(2027, 5, 31), "service_interval_days": 90},
            ]
            for a_data in amc_data:
                amc = AMCContract(
                    tenant_id=demo_tenant.id,
                    customer_id=first_customer.id,
                    contract_title=a_data['contract_title'],
                    amc_value=a_data['amc_value'],
                    start_date=a_data['start_date'],
                    end_date=a_data['end_date'],
                    service_interval_days=a_data['service_interval_days'],
                )
                db.session.add(amc)
                db.session.flush()
                
                # Link equipment to AMC
                if a_data['equipment_name'] in equipment_map:
                    equip = equipment_map[a_data['equipment_name']]
                    amc_equip = AMCEquipment(
                        tenant_id=demo_tenant.id,
                        amc_id=amc.id,
                        machine_name=equip.name,
                        machine_serial=equip.serial_number,
                        model=equip.model_number,
                        capacity=f"{equip.ton_capacity} Ton" if equip.ton_capacity else None
                    )
                    db.session.add(amc_equip)
            
            # ===== EMPLOYEES / HR =====
            print("Seeding Employees...")
            employees_data = [
                {"name": "Rajesh Verma", "phone": "9988776621", "email": "rajesh@smartgo.com", "department": "Operations", "designation": "Operations Manager", "basic_salary": 85000, "gross_salary": 105000, "date_of_joining": date(2023, 6, 1)},
                {"name": "Sunita Yadav", "phone": "9988776622", "email": "sunita@smartgo.com", "department": "Finance", "designation": "Accountant", "basic_salary": 55000, "gross_salary": 70000, "date_of_joining": date(2023, 8, 15)},
                {"name": "Amit Joshi", "phone": "9988776623", "email": "amit@smartgo.com", "department": "Sales", "designation": "Sales Executive", "basic_salary": 40000, "gross_salary": 55000, "date_of_joining": date(2024, 1, 10)},
                {"name": "Deepak Kumar", "phone": "9988776624", "email": "deepak@smartgo.com", "department": "Operations", "designation": "Crane Operator", "basic_salary": 35000, "gross_salary": 45000, "date_of_joining": date(2024, 3, 20)},
                {"name": "Meena Devi", "phone": "9988776625", "email": "meena@smartgo.com", "department": "HR", "designation": "HR Executive", "basic_salary": 45000, "gross_salary": 58000, "date_of_joining": date(2024, 5, 1)},
                {"name": "Prakash Rao", "phone": "9988776626", "email": "prakash@smartgo.com", "department": "Operations", "designation": "Service Engineer", "basic_salary": 50000, "gross_salary": 65000, "date_of_joining": date(2024, 7, 15)},
            ]
            for i, emp_data in enumerate(employees_data):
                employee = Employee(
                    tenant_id=demo_tenant.id,
                    company_id=company.id,
                    employee_code=f"EMP-{2024+i:04d}",
                    name=emp_data['name'],
                    phone=emp_data['phone'],
                    email=emp_data['email'],
                    department=emp_data['department'],
                    designation=emp_data['designation'],
                    basic_salary=emp_data['basic_salary'],
                    gross_salary=emp_data['gross_salary'],
                    date_of_joining=emp_data['date_of_joining'],
                    is_active=True
                )
                db.session.add(employee)
            
            # ===== PROJECTS =====
            print("Seeding Projects...")
            projects_data = [
                {"name": "Metro Station Construction - Phase 2", "description": "Underground metro station at MG Road", "start_date": date(2026, 1, 15), "end_date": date(2027, 6, 30), "budget": 50000000, "status": "InProgress", "priority": "High"},
                {"name": "Flyover Bridge - Hebbal", "description": "6-lane flyover bridge construction at Hebbal junction", "start_date": date(2026, 3, 1), "end_date": date(2027, 8, 31), "budget": 35000000, "status": "InProgress", "priority": "High"},
                {"name": "Industrial Warehouse - Whitefield", "description": "50,000 sq ft warehouse construction", "start_date": date(2026, 5, 1), "end_date": date(2026, 12, 31), "budget": 15000000, "status": "Planned", "priority": "Medium"},
            ]
            for proj_data in projects_data:
                project = Project(
                    tenant_id=demo_tenant.id,
                    company_id=company.id,
                    name=proj_data['name'],
                    description=proj_data['description'],
                    start_date=proj_data['start_date'],
                    end_date=proj_data['end_date'],
                    budget=proj_data['budget'],
                    status=proj_data['status'],
                    priority=proj_data['priority']
                )
                db.session.add(project)
            
            # ===== DOCUMENTS =====
            print("Seeding Documents...")
            documents_data = [
                {"title": "Equipment Rental Agreement Template", "file_type": "PDF", "folder": "Templates", "file_name": "rental-agreement-template.pdf"},
                {"title": "Company GST Registration Certificate", "file_type": "PDF", "folder": "Legal", "file_name": "gst-certificate.pdf"},
                {"title": "Insurance Policy - Equipment Fleet", "file_type": "PDF", "folder": "Insurance", "file_name": "equipment-insurance.pdf"},
                {"title": "Employee Handbook 2026", "file_type": "PDF", "folder": "HR", "file_name": "employee-handbook-2026.pdf"},
                {"title": "Safety Compliance Manual", "file_type": "PDF", "folder": "Safety", "file_name": "safety-compliance-manual.pdf"},
            ]
            for doc_data in documents_data:
                doc = Document(
                    tenant_id=demo_tenant.id,
                    company_id=company.id,
                    title=doc_data['title'],
                    file_type=doc_data['file_type'],
                    folder=doc_data['folder'],
                    file_name=doc_data['file_name'],
                    file_url=f"/uploads/{doc_data['file_name']}",
                    is_public=False
                )
                db.session.add(doc)
            
            # ===== CHART OF ACCOUNTS (Finance) =====
            print("Seeding Chart of Accounts...")
            account_categories = [
                {"account_name": "Cash in Hand", "account_code": "1001", "account_type": "Asset", "description": "Physical cash in office"},
                {"account_name": "Bank Account - HDFC", "account_code": "1002", "account_type": "Asset", "description": "HDFC Current Account 12345"},
                {"account_name": "Accounts Receivable", "account_code": "1003", "account_type": "Asset", "description": "Money owed by customers"},
                {"account_name": "Equipment Inventory", "account_code": "1004", "account_type": "Asset", "description": "Equipment available for rent"},
                {"account_name": "Spare Parts Inventory", "account_code": "1005", "account_type": "Asset", "description": "Inventory of spare parts"},
                {"account_name": "Fixed Assets", "account_code": "1006", "account_type": "Asset", "description": "Office equipment, furniture etc."},
                {"account_name": "Accounts Payable", "account_code": "2001", "account_type": "Liability", "description": "Money owed to suppliers"},
                {"account_name": "GST Payable", "account_code": "2002", "account_type": "Liability", "description": "GST collected from customers"},
                {"account_name": "TDS Payable", "account_code": "2003", "account_type": "Liability", "description": "TDS deducted from payments"},
                {"account_name": "Bank Loan - HDFC", "account_code": "2004", "account_type": "Liability", "description": "Equipment purchase loan"},
                {"account_name": "Sales Revenue", "account_code": "3001", "account_type": "Income", "description": "Revenue from sales"},
                {"account_name": "Rental Income", "account_code": "3002", "account_type": "Income", "description": "Revenue from equipment rentals"},
                {"account_name": "Service Income", "account_code": "3003", "account_type": "Income", "description": "AMC and service revenue"},
                {"account_name": "Interest Income", "account_code": "3004", "account_type": "Income", "description": "Bank interest received"},
                {"account_name": "Purchases", "account_code": "4001", "account_type": "Expense", "description": "Cost of goods purchased"},
                {"account_name": "Salary & Wages", "account_code": "4002", "account_type": "Expense", "description": "Employee salaries"},
                {"account_name": "Rent Expense", "account_code": "4003", "account_type": "Expense", "description": "Office and warehouse rent"},
                {"account_name": "Electricity & Utilities", "account_code": "4004", "account_type": "Expense", "description": "Power and utility bills"},
                {"account_name": "Transportation & Logistics", "account_code": "4005", "account_type": "Expense", "description": "Equipment transport costs"},
                {"account_name": "Insurance Expense", "account_code": "4006", "account_type": "Expense", "description": "Insurance premiums"},
                {"account_name": "Maintenance & Repairs", "account_code": "4007", "account_type": "Expense", "description": "Equipment maintenance costs"},
                {"account_name": "Office Supplies", "account_code": "4008", "account_type": "Expense", "description": "Stationery and office consumables"},
                {"account_name": "Marketing & Advertising", "account_code": "4009", "account_type": "Expense", "description": "Promotional costs"},
                {"account_name": "Tax Expenses", "account_code": "4010", "account_type": "Expense", "description": "GST, TDS and other taxes"},
            ]
            for ac_data in account_categories:
                existing = ChartOfAccount.query.filter_by(account_code=ac_data['account_code'], tenant_id=demo_tenant.id).first()
                if not existing:
                    account = ChartOfAccount(
                        tenant_id=demo_tenant.id,
                        company_id=company.id,
                        account_name=ac_data['account_name'],
                        account_code=ac_data['account_code'],
                        account_type=ac_data['account_type'],
                        is_active=True
                    )
                    db.session.add(account)
            
            # ===== MANUFACTURING SEEDING =====
            print("Seeding Manufacturing Engine...")
            
            # 1. Config
            mfg_config = TenantManufacturingConfig.query.filter_by(tenant_id=demo_tenant.id).first()
            if not mfg_config:
                mfg_config = TenantManufacturingConfig(
                    tenant_id=demo_tenant.id,
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

            # 2. Work Centers & Machines
            wc1 = WorkCenter.query.filter_by(tenant_id=demo_tenant.id, name='Assembly Line 1').first()
            if not wc1:
                wc1 = WorkCenter(
                    tenant_id=demo_tenant.id,
                    name='Assembly Line 1',
                    hourly_labor_rate=Decimal('15.00'),
                    hourly_machine_rate=Decimal('25.00'),
                    capacity_limit=100,
                    is_active=True
                )
                db.session.add(wc1)
            
            wc2 = WorkCenter.query.filter_by(tenant_id=demo_tenant.id, name='Fabrication Shop').first()
            if not wc2:
                wc2 = WorkCenter(
                    tenant_id=demo_tenant.id,
                    name='Fabrication Shop',
                    hourly_labor_rate=Decimal('20.00'),
                    hourly_machine_rate=Decimal('30.00'),
                    capacity_limit=80,
                    is_active=True
                )
                db.session.add(wc2)
            db.session.flush()

            m1 = Machine.query.filter_by(tenant_id=demo_tenant.id, name='CNC Cutting Machine').first()
            if not m1:
                m1 = Machine(
                    tenant_id=demo_tenant.id,
                    work_center_id=wc2.id,
                    name='CNC Cutting Machine',
                    hourly_machine_rate=Decimal('35.00'),
                    is_active=True
                )
                db.session.add(m1)

            m2 = Machine.query.filter_by(tenant_id=demo_tenant.id, name='Rotary Assembly Jig').first()
            if not m2:
                m2 = Machine(
                    tenant_id=demo_tenant.id,
                    work_center_id=wc1.id,
                    name='Rotary Assembly Jig',
                    hourly_machine_rate=Decimal('20.00'),
                    is_active=True
                )
                db.session.add(m2)
            db.session.flush()

            # 3. BOM & Routing
            fg_prod = product_map.get("Hydraulic Excavator Bucket")
            comp1 = product_map.get("Crane Hook 10 Ton")
            comp2 = product_map.get("Hydraulic Filter Kit")
            comp3 = product_map.get("Welding Electrode 5kg Box")
            
            if fg_prod and comp1 and comp2 and comp3:
                bom = BomHeader.query.filter_by(tenant_id=demo_tenant.id, product_id=fg_prod.id).first()
                if not bom:
                    bom = BomHeader(
                        tenant_id=demo_tenant.id,
                        company_id=company.id,
                        product_id=fg_prod.id,
                        name="Excavator Bucket Standard BOM",
                        version="V1.0",
                        revision_no=0,
                        status="active",
                        standard_cost=Decimal('15000.00'),
                        overhead_cost=Decimal('1200.00'),
                        total_setup_time_mins=30,
                        notes="Standard fabrication and welding BOM for excavator bucket assembly."
                    )
                    db.session.add(bom)
                    db.session.flush()
                    
                    # Components
                    item1 = BomItem(bom_id=bom.id, item_id=comp1.id, qty_required=Decimal('1.00'), uom="Pcs", waste_pct=Decimal('0.00'))
                    item2 = BomItem(bom_id=bom.id, item_id=comp2.id, qty_required=Decimal('2.00'), uom="Set", waste_pct=Decimal('5.00'))
                    item3 = BomItem(bom_id=bom.id, item_id=comp3.id, qty_required=Decimal('1.00'), uom="Box", waste_pct=Decimal('10.00'))
                    db.session.add_all([item1, item2, item3])
                    
                    # Routing
                    op1 = BomRoutingOperation(
                        bom_id=bom.id, operation_sequence=10, operation_name="Metal Cutting & Shaping",
                        work_center_id=wc2.id, machine_id=m1.id, setup_time_mins=15,
                        processing_time_per_unit_mins=Decimal('20.00'), labor_hours_per_unit=Decimal('0.50')
                    )
                    op2 = BomRoutingOperation(
                        bom_id=bom.id, operation_sequence=20, operation_name="Welding & Structural Assembly",
                        work_center_id=wc2.id, machine_id=None, setup_time_mins=10,
                        processing_time_per_unit_mins=Decimal('45.00'), labor_hours_per_unit=Decimal('1.00')
                    )
                    op3 = BomRoutingOperation(
                        bom_id=bom.id, operation_sequence=30, operation_name="Final Assembly & Quality Check",
                        work_center_id=wc1.id, machine_id=m2.id, setup_time_mins=5,
                        processing_time_per_unit_mins=Decimal('15.00'), labor_hours_per_unit=Decimal('0.25')
                    )
                    db.session.add_all([op1, op2, op3])
                    db.session.flush()

                    # Supplier mappings
                    supplier = Supplier.query.filter_by(tenant_id=demo_tenant.id).first()
                    if supplier:
                        map1 = SupplierItemMapping(tenant_id=demo_tenant.id, supplier_id=supplier.id, item_id=comp1.id, lead_time_days=3, unit_cost=Decimal('8000.00'))
                        map2 = SupplierItemMapping(tenant_id=demo_tenant.id, supplier_id=supplier.id, item_id=comp2.id, lead_time_days=5, unit_cost=Decimal('2000.00'))
                        map3 = SupplierItemMapping(tenant_id=demo_tenant.id, supplier_id=supplier.id, item_id=comp3.id, lead_time_days=2, unit_cost=Decimal('600.00'))
                        db.session.add_all([map1, map2, map3])
                        db.session.flush()

                    # 4. Work Orders
                    wo1 = WorkOrder(
                        tenant_id=demo_tenant.id, company_id=company.id, bom_id=bom.id,
                        wo_number="WO-2026-001", planned_qty=Decimal('5.00'), produced_qty=Decimal('0.00'),
                        status="planned", start_date=date.today(), end_date=date.today() + timedelta(days=2)
                    )
                    wo2 = WorkOrder(
                        tenant_id=demo_tenant.id, company_id=company.id, bom_id=bom.id,
                        wo_number="WO-2026-002", planned_qty=Decimal('10.00'), produced_qty=Decimal('0.00'),
                        status="wip", start_date=date.today() - timedelta(days=1), end_date=date.today() + timedelta(days=1)
                    )
                    wo3 = WorkOrder(
                        tenant_id=demo_tenant.id, company_id=company.id, bom_id=bom.id,
                        wo_number="WO-2026-003", planned_qty=Decimal('3.00'), produced_qty=Decimal('3.00'),
                        status="qc_pending", start_date=date.today() - timedelta(days=2), end_date=date.today()
                    )
                    wo4 = WorkOrder(
                        tenant_id=demo_tenant.id, company_id=company.id, bom_id=bom.id,
                        wo_number="WO-2026-004", planned_qty=Decimal('2.00'), produced_qty=Decimal('2.00'),
                        status="completed", start_date=date.today() - timedelta(days=5), end_date=date.today() - timedelta(days=3)
                    )
                    db.session.add_all([wo1, wo2, wo3, wo4])
                    db.session.flush()

                    # Operations for WO-2026-002
                    wo_op1 = WorkOrderOperation(
                        work_order_id=wo2.id, operation_sequence=10, operation_name="Metal Cutting & Shaping",
                        work_center_id=wc2.id, machine_id=m1.id, planned_setup_time=15, planned_run_time=200,
                        actual_setup_time=15, actual_run_time=190, status="completed"
                    )
                    wo_op2 = WorkOrderOperation(
                        work_order_id=wo2.id, operation_sequence=20, operation_name="Welding & Structural Assembly",
                        work_center_id=wc2.id, machine_id=None, planned_setup_time=10, planned_run_time=450,
                        actual_setup_time=0, actual_run_time=0, status="in_progress"
                    )
                    wo_op3 = WorkOrderOperation(
                        work_order_id=wo2.id, operation_sequence=30, operation_name="Final Assembly & Quality Check",
                        work_center_id=wc1.id, machine_id=m2.id, planned_setup_time=5, planned_run_time=150,
                        actual_setup_time=0, actual_run_time=0, status="pending"
                    )
                    db.session.add_all([wo_op1, wo_op2, wo_op3])
                    db.session.flush()

                    # 5. MRP / Shortage
                    mrp1 = MaterialRequirementPlan(
                        tenant_id=demo_tenant.id, work_order_id=wo1.id,
                        raw_material_id=comp1.id, required_qty=Decimal('5.00'), current_stock_qty=Decimal('15.00'),
                        shortage_qty=Decimal('0.00'), status="draft"
                    )
                    mrp2 = MaterialRequirementPlan(
                        tenant_id=demo_tenant.id, work_order_id=wo1.id,
                        raw_material_id=comp2.id, required_qty=Decimal('10.50'), current_stock_qty=Decimal('5.00'),
                        shortage_qty=Decimal('5.50'), status="draft"
                    )
                    db.session.add_all([mrp1, mrp2])
                    db.session.flush()

                    # 6. Job Work
                    if supplier:
                        jw1 = JobWorkOrder(
                            tenant_id=demo_tenant.id, company_id=company.id, vendor_id=supplier.id,
                            work_order_id=wo2.id, issue_challan_no="JW-CH-2026-001",
                            status="sent", expected_return_date=date.today() + timedelta(days=7),
                            service_cost=Decimal('3500.00'),
                            materials_sent=[
                                {"item_id": comp1.id, "qty": 10, "uom": "Pcs"},
                                {"item_id": comp2.id, "qty": 20, "uom": "Set"}
                            ]
                        )
                        db.session.add(jw1)
                        db.session.flush()

                    # 7. Quality Control
                    qc1 = QualityInspection(
                        tenant_id=demo_tenant.id, company_id=company.id,
                        reference_type="work_order", reference_id=wo4.id,
                        inspection_date=datetime.now() - timedelta(days=3),
                        passed_qty=Decimal('2.00'), failed_qty=Decimal('0.00'),
                        qc_status="passed", remarks="All standard tolerances and weld penetrations checked and approved.",
                        check_parameters=[
                            {"name": "Dimension Check", "standard": "Width 1200mm +/- 5mm", "actual": "1202mm", "result": "pass"},
                            {"name": "Weld Quality", "standard": "Continuous bead, no cracks", "actual": "Excellent penetration", "result": "pass"}
                        ]
                    )
                    db.session.add(qc1)
                    db.session.flush()

            db.session.commit()
            print("Demo tenant & ERP comprehensive data seeded successfully for all modules, including Manufacturing!")
        
        print("Master database seeded successfully.")

if __name__ == '__main__':
    # Ensure database is checked and created first
    check_and_create_database()
    # Run seed
    seed_database()