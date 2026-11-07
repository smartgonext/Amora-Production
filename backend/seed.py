"""
SmartGoNext Universal ERP - Clean Master Seed Script
===================================================
Provisions:
1. Subscription Plans
2. Platform Superadmin User (superadmin@smartgonext.com / SuperAdmin@123)
3. Amora Bakery Tenant & Company (Bakery Business Vertical)
   - Tenant & Company: Amora Bakery & Patisserie
   - Admin User: admin@amorabakery.com / Amora@123
   - Automated Bakery Configuration:
     * Business type: Bakery (Module gating, UI features, Baker's % scaling)
     * Manufacturing profile: Process manufacturing (Recipe/Yield, Batch production, Expiry, FEFO, Freshness, HACCP)
     * Bakery storage warehouses (Raw store, Cold room, Bakehouse floor WIP, Retail display counter)
     * Bakery measurement units (kg, g, L, ml, pcs, box, tray, loaf)
     * Bakery ingredient categories & finished good categories
     * Core bakery raw materials & signature bakery products
     * Master BOM recipes (Sourdough Loaf, French Butter Croissants, Truffle Cake)
     * Active work orders, shift baking plan, HACCP CCP control points
     * Chart of Accounts, default suppliers & customers
"""
import os
import sys
import uuid
from datetime import datetime, timedelta, date
from decimal import Decimal

# Ensure backend directory is in python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.extensions import db
from app.database_setup import check_and_create_database
from app.models.tenant import (
    Tenant, SubscriptionPlan, Subscription, Company, License, Branch, CompanySetting
)
from app.models.user import User, Role
from app.models.customer import Customer, Supplier
from app.models.product import (
    ProductCategory, Product, Brand, Unit, Warehouse, StockLedger, ProductBatch
)
from app.models.manufacturing import (
    TenantManufacturingConfig, BomHeader, BomItem, BomByproduct,
    WorkCenter, BomRoutingOperation, WorkOrder, WorkOrderOperation,
    ProductionMaterialIssue, QualityInspection
)
from app.models.bakery import BakingPlan, BakingPlanItem, HaccpControlPoint
from app.models.finance import ChartOfAccount
from app.services.manufacturing_config import seed_manufacturing_config
from app.services.business_type_config import seed_business_type_config
from app.services.template_initializer import seed_default_templates


def seed_database(app=None):
    if not app:
        app = create_app('dev')

    with app.app_context():
        print("Ensuring all database tables exist...")
        db.create_all()

        # -------------------------------------------------------------
        # 1. SUBSCRIPTION PLANS
        # -------------------------------------------------------------
        print("1/8. Seeding Subscription Plans...")
        plans_data = [
            {"name": "Free Trial", "price": 0.00, "billing_cycle": "monthly", "allowed_devices": 1, "max_users": 3, "max_storage_mb": 100, "description": "15-day free trial with standard bakery features"},
            {"name": "Starter", "price": 999.00, "billing_cycle": "monthly", "allowed_devices": 1, "max_users": 5, "max_storage_mb": 500, "description": "For artisanal bakeries starting out"},
            {"name": "Growth", "price": 2999.00, "billing_cycle": "monthly", "allowed_devices": 3, "max_users": 15, "max_storage_mb": 2000, "description": "For growing bakeries & multi-outlet cafes"},
            {"name": "Enterprise", "price": 7999.00, "billing_cycle": "monthly", "allowed_devices": 10, "max_users": 50, "max_storage_mb": 10000, "description": "Full-featured for commercial bakery production units"},
            {"name": "Enterprise Annual", "price": 79990.00, "billing_cycle": "annual", "allowed_devices": 20, "max_users": 100, "max_storage_mb": 50000, "description": "Best value for commercial production bakeries (2 months free)"}
        ]
        plans_map = {}
        for p_data in plans_data:
            existing = SubscriptionPlan.query.filter_by(name=p_data['name']).first()
            if not existing:
                plan = SubscriptionPlan(
                    name=p_data['name'],
                    price=Decimal(str(p_data['price'])),
                    billing_cycle=p_data['billing_cycle'],
                    allowed_devices=p_data['allowed_devices'],
                    max_users=p_data['max_users'],
                    max_storage_mb=p_data['max_storage_mb'],
                    description=p_data['description'],
                    is_active=True
                )
                db.session.add(plan)
                db.session.flush()
                plans_map[p_data['name']] = plan
            else:
                plans_map[p_data['name']] = existing

        # -------------------------------------------------------------
        # 2. PLATFORM SUPERADMIN USER
        # -------------------------------------------------------------
        print("2/8. Creating Platform Superadmin...")
        superadmin = User.query.filter_by(email="superadmin@smartgonext.com").first()
        if not superadmin:
            superadmin = User(
                name="System Superadmin",
                email="superadmin@smartgonext.com",
                phone="+91 90000 00001",
                is_active=True,
                is_superadmin=True,
                theme_preference="dark"
            )
            superadmin.set_password("SuperAdmin@123")
            db.session.add(superadmin)
            db.session.flush()
            print("   -> Superadmin created: superadmin@smartgonext.com / SuperAdmin@123")
        else:
            superadmin.is_superadmin = True
            superadmin.set_password("SuperAdmin@123")
            db.session.flush()

        # -------------------------------------------------------------
        # 3. AMORA BAKERY TENANT & COMPANY
        # -------------------------------------------------------------
        print("3/8. Provisioning Amora Bakery Tenant & Company...")
        amora_tenant = Tenant.query.filter_by(subdomain="amora").first()
        if not amora_tenant:
            amora_tenant = Tenant(
                name="Amora Bakery",
                subdomain="amora",
                business_type="Bakery",
                contact_email="admin@amorabakery.com",
                contact_phone="+91 98765 43210",
                is_active=True
            )
            db.session.add(amora_tenant)
            db.session.flush()

        # Subscription for Amora (Enterprise Plan)
        sub = Subscription.query.filter_by(tenant_id=amora_tenant.id).first()
        if not sub:
            enterprise_plan = plans_map.get("Enterprise") or SubscriptionPlan.query.first()
            sub = Subscription(
                tenant_id=amora_tenant.id,
                plan_id=enterprise_plan.id,
                status="active",
                start_date=datetime.utcnow(),
                expiry_date=datetime.utcnow() + timedelta(days=365)
            )
            db.session.add(sub)
            db.session.flush()

        # Company Profile
        amora_company = Company.query.filter_by(tenant_id=amora_tenant.id).first()
        if not amora_company:
            amora_company = Company(
                tenant_id=amora_tenant.id,
                name="Amora Bakery & Patisserie",
                legal_name="Amora Artisanal Bakes Pvt Ltd",
                business_type="Bakery",
                email="admin@amorabakery.com",
                phone="+91 98765 43210",
                address="Plot 42, Artisan Lane, Khader Nawaz Khan Road, Nungambakkam",
                city="Chennai",
                state="Tamil Nadu",
                country="India",
                pincode="600034",
                currency="INR",
                gstin="33AAAAA0000A1Z5",
                pan="AAAAA0000A",
                is_head_office=True,
                is_active=True
            )
            db.session.add(amora_company)
            db.session.flush()

        # Main Branch: Amora Central Bakehouse
        amora_branch = Branch.query.filter_by(tenant_id=amora_tenant.id).first()
        if not amora_branch:
            amora_branch = Branch(
                tenant_id=amora_tenant.id,
                company_id=amora_company.id,
                name="Amora Central Bakehouse",
                code="AMR-01",
                address="Plot 42, Artisan Lane, Khader Nawaz Khan Road, Nungambakkam",
                city="Chennai",
                state="Tamil Nadu",
                pincode="600034",
                phone="+91 98765 43210",
                email="bakehouse@amorabakery.com",
                is_main=True,
                is_active=True
            )
            db.session.add(amora_branch)
            db.session.flush()

        # Roles for Amora Tenant
        roles_def = [
            ("Admin", "Full operational & financial access to Amora Bakery"),
            ("Manager", "Bakehouse floor & retail store manager"),
            ("Head Baker", "Recipe scaling, batch management & kitchen operations"),
            ("Cashier", "Retail front counter billing and POS payments"),
            ("Accountant", "Bakery expenses, invoices and financial reports")
        ]
        roles_map = {}
        for r_name, r_desc in roles_def:
            role = Role.query.filter_by(tenant_id=amora_tenant.id, name=r_name).first()
            if not role:
                role = Role(tenant_id=amora_tenant.id, name=r_name, description=r_desc, is_system_role=(r_name == "Admin"))
                db.session.add(role)
                db.session.flush()
            roles_map[r_name] = role

        # Admin User for Amora Bakery
        amora_admin = User.query.filter_by(email="admin@amorabakery.com").first()
        if not amora_admin:
            amora_admin = User(
                tenant_id=amora_tenant.id,
                company_id=amora_company.id,
                branch_id=amora_branch.id,
                name="Amora Admin",
                email="admin@amorabakery.com",
                phone="+91 98765 43210",
                role_id=roles_map["Admin"].id,
                is_active=True,
                is_superadmin=False,
                theme_preference="light"
            )
            amora_admin.set_password("Amora@123")
            db.session.add(amora_admin)
            db.session.flush()
            print("   -> Amora Admin user created: admin@amorabakery.com / Amora@123")
        else:
            amora_admin.company_id = amora_company.id
            amora_admin.branch_id = amora_branch.id
            amora_admin.role_id = roles_map["Admin"].id
            amora_admin.set_password("Amora@123")
            db.session.flush()

        # Additional Bakery Staff Users
        staff_data = [
            ("Chef Pierre", "chef@amorabakery.com", "Chef@123", "Head Baker"),
            ("Ananya Retail", "pos@amorabakery.com", "Pos@123", "Cashier")
        ]
        for s_name, s_email, s_pwd, s_role in staff_data:
            if not User.query.filter_by(email=s_email).first():
                staff_user = User(
                    tenant_id=amora_tenant.id,
                    company_id=amora_company.id,
                    branch_id=amora_branch.id,
                    name=s_name,
                    email=s_email,
                    role_id=roles_map[s_role].id,
                    is_active=True,
                    is_superadmin=False
                )
                staff_user.set_password(s_pwd)
                db.session.add(staff_user)
                db.session.flush()

        # License for Amora
        lic = License.query.filter_by(tenant_id=amora_tenant.id).first()
        if not lic:
            lic = License(
                license_key=str(uuid.uuid4()).replace('-', '').upper(),
                tenant_id=amora_tenant.id,
                company_id=amora_company.id,
                subscription_id=sub.id,
                plan_id=sub.plan_id,
                modules_json=[
                    "dashboard", "products", "billing", "sales", "purchases",
                    "inventory", "customers", "suppliers", "hr", "documents",
                    "finance", "reports", "manufacturing"
                ],
                max_bills=0,
                issued_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(days=365),
                status="active",
                is_trial=False
            )
            db.session.add(lic)
            db.session.flush()

        # -------------------------------------------------------------
        # 4. AUTOMATED BAKERY CONFIGURATION & MODULE GATING
        # -------------------------------------------------------------
        print("4/8. Configuring Bakery Automation, UI Gating & Templates...")
        # A. Manufacturing Profile
        seed_manufacturing_config(amora_tenant.id, "Bakery", commit=False)

        # B. UI Module & Feature Gating
        seed_business_type_config(amora_tenant.id, amora_company.id, "Bakery", commit=False)

        # C. Default Document Templates (Invoices, Receipts, Challans)
        seed_default_templates(amora_tenant.id, amora_company.id, commit=False)

        # -------------------------------------------------------------
        # 5. BAKERY UNITS, WAREHOUSES & CATEGORIES
        # -------------------------------------------------------------
        print("5/8. Seeding Bakery Units, Warehouses & Categories...")
        # Units
        units_data = [
            {"name": "Kilogram", "short_name": "kg"},
            {"name": "Gram", "short_name": "g"},
            {"name": "Liter", "short_name": "L"},
            {"name": "Milliliter", "short_name": "ml"},
            {"name": "Piece", "short_name": "pcs"},
            {"name": "Loaf", "short_name": "loaf"},
            {"name": "Baking Tray", "short_name": "tray"},
            {"name": "Box", "short_name": "box"},
            {"name": "Dozen", "short_name": "dozen"}
        ]
        unit_map = {}
        for u in units_data:
            existing_unit = Unit.query.filter_by(tenant_id=amora_tenant.id, short_name=u['short_name']).first()
            if not existing_unit:
                unit = Unit(
                    tenant_id=amora_tenant.id,
                    name=u['name'],
                    short_name=u['short_name']
                )
                db.session.add(unit)
                db.session.flush()
                unit_map[u['short_name']] = unit
            else:
                unit_map[u['short_name']] = existing_unit

        # Warehouses
        warehouses_data = [
            ("Central Pantry & Raw Material Store", "Ground Floor Ambient Pantry", amora_branch.id),
            ("Cold Chiller & Dairy Room", "Cold Room (2°C - 4°C)", amora_branch.id),
            ("Bakehouse Floor & WIP", "Baking Production Floor", amora_branch.id),
            ("Front Display & Retail Counter", "Retail Counter & POS Till", amora_branch.id)
        ]
        wh_map = {}
        for wh_name, wh_loc, wh_br in warehouses_data:
            wh = Warehouse.query.filter_by(tenant_id=amora_tenant.id, name=wh_name).first()
            if not wh:
                wh = Warehouse(
                    tenant_id=amora_tenant.id,
                    company_id=amora_company.id,
                    branch_id=wh_br,
                    name=wh_name,
                    location=wh_loc,
                    is_active=True
                )
                db.session.add(wh)
                db.session.flush()
            wh_map[wh_name] = wh

        # Product Categories
        categories_data = [
            # Raw Materials
            ("Flours & Grains", "Premium baking flours, semolina, whole grains, and starches"),
            ("Dairy & Fats", "European butter, heavy cream, milk, cream cheese, and edible fats"),
            ("Sugars & Sweeteners", "Granulated sugar, brown sugar, castor sugar, honey, and syrups"),
            ("Yeast & Leaveners", "Instant dry yeast, active dry yeast, baking powder, sourdough starters"),
            ("Chocolates & Cocoa", "Couverture chocolate, cocoa powder, cocoa butter, chocolate chips"),
            ("Flavorings & Extracts", "Bourbon vanilla, citrus oils, cinnamon, spices, edible floral waters"),
            ("Bakery Packaging", "Eco-friendly bread sleeves, cake boxes, pastry bags, and cupcake liners"),
            # Finished Goods
            ("Artisan Breads", "Freshly baked sourdoughs, baguettes, multigrain loaves, focaccia"),
            ("Croissants & Viennoiserie", "Flaky butter croissants, pain au chocolat, danishes, and brioche"),
            ("Cakes & Patisserie", "Signature celebration cakes, tarts, mousses, and cheesecakes"),
            ("Cookies & Dry Bakes", "Artisan cookies, almond biscotti, macarons, and butter biscuits"),
            ("Savory Bakes", "Quiches, savory puff pastries, garlic knots, and gourmet buns")
        ]
        cat_map = {}
        for c_name, c_desc in categories_data:
            cat = ProductCategory.query.filter_by(tenant_id=amora_tenant.id, name=c_name).first()
            if not cat:
                cat = ProductCategory(
                    tenant_id=amora_tenant.id,
                    name=c_name,
                    description=c_desc
                )
                db.session.add(cat)
                db.session.flush()
            cat_map[c_name] = cat

        # -------------------------------------------------------------
        # 6. BAKERY RAW MATERIALS & FINISHED PRODUCTS
        # -------------------------------------------------------------
        print("6/8. Creating Bakery Raw Materials & Finished Goods...")
        # Raw materials list
        raw_items_data = [
            {
                "name": "French T55 Bread Flour",
                "cat": "Flours & Grains",
                "unit": "kg",
                "cost": 48.00,
                "hsn": "1101",
                "gst": 0.0,
                "allergens": ["Gluten"]
            },
            {
                "name": "European Unsalted Butter 82%",
                "cat": "Dairy & Fats",
                "unit": "kg",
                "cost": 480.00,
                "hsn": "0405",
                "gst": 12.0,
                "allergens": ["Dairy"]
            },
            {
                "name": "Fine Castor Sugar",
                "cat": "Sugars & Sweeteners",
                "unit": "kg",
                "cost": 52.00,
                "hsn": "1701",
                "gst": 5.0,
                "allergens": []
            },
            {
                "name": "Fresh Whole Milk",
                "cat": "Dairy & Fats",
                "unit": "L",
                "cost": 60.00,
                "hsn": "0401",
                "gst": 0.0,
                "allergens": ["Dairy"]
            },
            {
                "name": "Instant Dry Baker's Yeast",
                "cat": "Yeast & Leaveners",
                "unit": "kg",
                "cost": 450.00,
                "hsn": "2102",
                "gst": 18.0,
                "allergens": []
            },
            {
                "name": "Belgian Dark Couverture 54%",
                "cat": "Chocolates & Cocoa",
                "unit": "kg",
                "cost": 850.00,
                "hsn": "1806",
                "gst": 18.0,
                "allergens": ["Dairy", "Soy"]
            },
            {
                "name": "Bourbon Vanilla Extract",
                "cat": "Flavorings & Extracts",
                "unit": "ml",
                "cost": 1.80,
                "hsn": "3302",
                "gst": 18.0,
                "allergens": []
            },
            {
                "name": "Natural Sea Salt",
                "cat": "Flavorings & Extracts",
                "unit": "kg",
                "cost": 25.00,
                "hsn": "2501",
                "gst": 0.0,
                "allergens": []
            },
            {
                "name": "Farm Fresh Eggs",
                "cat": "Dairy & Fats",
                "unit": "pcs",
                "cost": 7.50,
                "hsn": "0407",
                "gst": 0.0,
                "allergens": ["Eggs"]
            }
        ]

        products_map = {}
        for r in raw_items_data:
            prod = Product.query.filter_by(tenant_id=amora_tenant.id, name=r['name']).first()
            if not prod:
                prod = Product(
                    tenant_id=amora_tenant.id,
                    company_id=amora_company.id,
                    category_id=cat_map[r['cat']].id,
                    unit_id=unit_map[r['unit']].id,
                    name=r['name'],
                    sku=f"RM-{r['name'][:4].upper()}-{r['unit'].upper()}",
                    hsn_code=r['hsn'],
                    gst_rate=Decimal(str(r['gst'])),
                    purchase_price=Decimal(str(r['cost'])),
                    selling_price=Decimal(str(r['cost'] * 1.2)),
                    is_raw_material=True,
                    is_batch_tracked=True,
                    current_stock=100,
                    min_stock_level=10,
                    allergens=r['allergens'],
                    is_active=True
                )
                db.session.add(prod)
                db.session.flush()
            products_map[r['name']] = prod

        # Finished Goods list
        finished_items_data = [
            {
                "name": "Artisanal Sourdough Country Loaf",
                "cat": "Artisan Breads",
                "unit": "loaf",
                "cost": 45.00,
                "retail": 180.00,
                "shelf_life": 3,
                "allergens": ["Gluten"]
            },
            {
                "name": "Classic French Butter Croissant",
                "cat": "Croissants & Viennoiserie",
                "unit": "pcs",
                "cost": 38.00,
                "retail": 120.00,
                "shelf_life": 2,
                "allergens": ["Gluten", "Dairy"]
            },
            {
                "name": "Signature Dark Truffle Cake 1kg",
                "cat": "Cakes & Patisserie",
                "unit": "pcs",
                "cost": 280.00,
                "retail": 950.00,
                "shelf_life": 4,
                "allergens": ["Gluten", "Dairy", "Eggs"]
            },
            {
                "name": "Blueberry Danish Pastry",
                "cat": "Croissants & Viennoiserie",
                "unit": "pcs",
                "cost": 42.00,
                "retail": 140.00,
                "shelf_life": 2,
                "allergens": ["Gluten", "Dairy"]
            },
            {
                "name": "Dark Chocolate Chunk Cookies (Pack of 6)",
                "cat": "Cookies & Dry Bakes",
                "unit": "box",
                "cost": 95.00,
                "retail": 260.00,
                "shelf_life": 21,
                "allergens": ["Gluten", "Dairy", "Eggs"]
            }
        ]

        for fg in finished_items_data:
            prod = Product.query.filter_by(tenant_id=amora_tenant.id, name=fg['name']).first()
            if not prod:
                prod = Product(
                    tenant_id=amora_tenant.id,
                    company_id=amora_company.id,
                    category_id=cat_map[fg['cat']].id,
                    unit_id=unit_map[fg['unit']].id,
                    name=fg['name'],
                    sku=f"FG-{fg['name'][:4].upper()}-{fg['unit'].upper()}",
                    hsn_code="1905",
                    gst_rate=Decimal("5.0"),
                    purchase_price=Decimal(str(fg['cost'])),
                    selling_price=Decimal(str(fg['retail'])),
                    retail_price=Decimal(str(fg['retail'])),
                    wholesale_price=Decimal(str(fg['retail'] * 0.75)),
                    is_raw_material=False,
                    is_batch_tracked=True,
                    is_fresh=True,
                    shelf_life_days=fg['shelf_life'],
                    best_before_days=fg['shelf_life'],
                    allergens=fg['allergens'],
                    current_stock=25,
                    is_active=True
                )
                db.session.add(prod)
                db.session.flush()
            products_map[fg['name']] = prod

        # -------------------------------------------------------------
        # 7. MASTER RECIPES (BOMs), WORK ORDERS & HACCP
        # -------------------------------------------------------------
        print("7/8. Provisioning Master Recipes, Work Orders & HACCP Control Points...")
        # Work Centers
        wc1 = WorkCenter.query.filter_by(tenant_id=amora_tenant.id, name="Dough Prep & Fermentation Zone").first()
        if not wc1:
            wc1 = WorkCenter(
                tenant_id=amora_tenant.id,
                name="Dough Prep & Fermentation Zone",
                description="Spiral mixer and climate-controlled proving chamber",
                capacity_limit=100,
                hourly_labor_rate=Decimal("250.0"),
                hourly_machine_rate=Decimal("150.0"),
                is_active=True
            )
            db.session.add(wc1)
            db.session.flush()

        wc2 = WorkCenter.query.filter_by(tenant_id=amora_tenant.id, name="Stone Hearth Deck Ovens").first()
        if not wc2:
            wc2 = WorkCenter(
                tenant_id=amora_tenant.id,
                name="Stone Hearth Deck Ovens",
                description="Artisan Italian multi-deck stone hearth baking deck with steam injection",
                capacity_limit=80,
                hourly_labor_rate=Decimal("300.0"),
                hourly_machine_rate=Decimal("400.0"),
                is_active=True
            )
            db.session.add(wc2)
            db.session.flush()

        # Recipe 1: Artisanal Sourdough Country Loaf (Yield: 1 Loaf)
        sourdough_prod = products_map["Artisanal Sourdough Country Loaf"]
        bom_sourdough = BomHeader.query.filter_by(tenant_id=amora_tenant.id, product_id=sourdough_prod.id).first()
        if not bom_sourdough:
            bom_sourdough = BomHeader(
                tenant_id=amora_tenant.id,
                company_id=amora_company.id,
                product_id=sourdough_prod.id,
                name="Master Sourdough Loaf Formula",
                version="V1.0",
                status="active",
                base_quantity=Decimal("1.0"),
                hydration_pct=Decimal("72.0"),
                dough_yield_pct=Decimal("174.0"),
                bake_loss_pct=Decimal("14.5"),
                notes="Long slow cold fermentation (18 hrs at 4°C). Hearth baked at 240°C with steam."
            )
            db.session.add(bom_sourdough)
            db.session.flush()

            # Ingredients with Baker's % (Flour is reference 100%)
            items_sourdough = [
                (products_map["French T55 Bread Flour"], Decimal("0.550"), "kg", Decimal("100.0")),
                (products_map["Natural Sea Salt"], Decimal("0.011"), "kg", Decimal("2.0")),
                (products_map["Instant Dry Baker's Yeast"], Decimal("0.003"), "kg", Decimal("0.5")),
            ]
            for itm, qty, uom_str, b_pct in items_sourdough:
                bi = BomItem(
                    bom_id=bom_sourdough.id,
                    item_id=itm.id,
                    qty_required=qty,
                    uom=uom_str,
                    baker_pct=b_pct,
                    waste_pct=Decimal("1.0")
                )
                db.session.add(bi)
            db.session.flush()

        # Recipe 2: Classic French Butter Croissant (Yield: 10 Croissants)
        croissant_prod = products_map["Classic French Butter Croissant"]
        bom_croissant = BomHeader.query.filter_by(tenant_id=amora_tenant.id, product_id=croissant_prod.id).first()
        if not bom_croissant:
            bom_croissant = BomHeader(
                tenant_id=amora_tenant.id,
                company_id=amora_company.id,
                product_id=croissant_prod.id,
                name="French Laminated Croissant Formula (10 Pcs)",
                version="V1.0",
                status="active",
                base_quantity=Decimal("10.0"),
                hydration_pct=Decimal("56.0"),
                dough_yield_pct=Decimal("165.0"),
                bake_loss_pct=Decimal("12.0"),
                notes="Laminated with 3-single folds using 82% European butter."
            )
            db.session.add(bom_croissant)
            db.session.flush()

            items_croissant = [
                (products_map["French T55 Bread Flour"], Decimal("0.500"), "kg", Decimal("100.0")),
                (products_map["European Unsalted Butter 82%"], Decimal("0.250"), "kg", Decimal("50.0")),
                (products_map["Fine Castor Sugar"], Decimal("0.050"), "kg", Decimal("10.0")),
                (products_map["Fresh Whole Milk"], Decimal("0.180"), "L", Decimal("36.0")),
                (products_map["Instant Dry Baker's Yeast"], Decimal("0.010"), "kg", Decimal("2.0")),
                (products_map["Natural Sea Salt"], Decimal("0.010"), "kg", Decimal("2.0"))
            ]
            for itm, qty, uom_str, b_pct in items_croissant:
                bi = BomItem(
                    bom_id=bom_croissant.id,
                    item_id=itm.id,
                    qty_required=qty,
                    uom=uom_str,
                    baker_pct=b_pct,
                    waste_pct=Decimal("2.0")
                )
                db.session.add(bi)
            db.session.flush()

        # Work Orders
        wo1 = WorkOrder.query.filter_by(tenant_id=amora_tenant.id, wo_number="WO-AMR-202610-01").first()
        if not wo1 and bom_sourdough:
            wo1 = WorkOrder(
                tenant_id=amora_tenant.id,
                company_id=amora_company.id,
                bom_id=bom_sourdough.id,
                wo_number="WO-AMR-202610-01",
                planned_qty=Decimal("50.0"),
                produced_qty=Decimal("25.0"),
                start_date=datetime.utcnow() - timedelta(hours=4),
                due_date=datetime.utcnow() + timedelta(hours=2),
                status="wip",
                notes="Morning Artisan Hearth Batch #01"
            )
            db.session.add(wo1)
            db.session.flush()

        wo2 = WorkOrder.query.filter_by(tenant_id=amora_tenant.id, wo_number="WO-AMR-202610-02").first()
        if not wo2 and bom_croissant:
            wo2 = WorkOrder(
                tenant_id=amora_tenant.id,
                company_id=amora_company.id,
                bom_id=bom_croissant.id,
                wo_number="WO-AMR-202610-02",
                planned_qty=Decimal("100.0"),
                produced_qty=Decimal("100.0"),
                start_date=datetime.utcnow() - timedelta(hours=8),
                due_date=datetime.utcnow() - timedelta(hours=2),
                status="completed",
                notes="Breakfast Viennoiserie Morning Batch"
            )
            db.session.add(wo2)
            db.session.flush()

        # Shift / Baking Plan
        bp = BakingPlan.query.filter_by(tenant_id=amora_tenant.id, plan_date=date.today()).first()
        if not bp:
            bp = BakingPlan(
                tenant_id=amora_tenant.id,
                company_id=amora_company.id,
                plan_date=date.today(),
                shift="Morning",
                status="in_progress"
            )
            db.session.add(bp)
            db.session.flush()

            bpi1 = BakingPlanItem(
                plan_id=bp.id,
                tenant_id=amora_tenant.id,
                product_id=sourdough_prod.id,
                order_demand=30,
                forecast_qty=20,
                planned_qty=50,
                batch_size=25,
                num_batches=2,
                oven="Stone Hearth Deck 1",
                status="baking",
                notes="First 25 loaves pulled, second batch fermenting"
            )
            bpi2 = BakingPlanItem(
                plan_id=bp.id,
                tenant_id=amora_tenant.id,
                product_id=croissant_prod.id,
                order_demand=60,
                forecast_qty=40,
                planned_qty=100,
                batch_size=50,
                num_batches=2,
                oven="Convection Deck 2",
                status="done",
                notes="Ready in front display counter"
            )
            db.session.add(bpi1)
            db.session.add(bpi2)
            db.session.flush()

        # HACCP Critical Control Points (CCP)
        chef_user = User.query.filter_by(email="chef@amorabakery.com").first()
        chef_id = chef_user.id if chef_user else amora_admin.id
        admin_id = amora_admin.id

        haccp_points = [
            {
                "checkpoint_name": "CCP-1: Oven Core Crumb Temperature",
                "recorded_value": "96.5",
                "spec_min": "94.0",
                "spec_max": "100.0",
                "unit": "°C",
                "is_pass": True,
                "corrective_action": "Extend bake by 5 mins if crumb < 94°C",
                "checked_by": chef_id,
                "checked_at": datetime.utcnow() - timedelta(hours=1),
                "notes": "Verified with calibrated center core digital probe on Hearth Deck 1"
            },
            {
                "checkpoint_name": "CCP-2: Dairy & Cream Chiller Temperature",
                "recorded_value": "3.2",
                "spec_min": "1.0",
                "spec_max": "4.0",
                "unit": "°C",
                "is_pass": True,
                "corrective_action": "Check chiller evaporator seal and move stock to backup cold zone",
                "checked_by": admin_id,
                "checked_at": datetime.utcnow() - timedelta(hours=2),
                "notes": "Butter and whole milk cold storage room within safe limits"
            },
            {
                "checkpoint_name": "CCP-3: Flour & Dry Ingredients Sifting & Magnet Trap",
                "recorded_value": "Passed - 0 contaminants",
                "spec_min": "0",
                "spec_max": "0",
                "unit": "particles",
                "is_pass": True,
                "corrective_action": "Quarantine flour sack batch and alert mill supplier",
                "checked_by": chef_id,
                "checked_at": datetime.utcnow() - timedelta(hours=4),
                "notes": "100% of T55 flour passed through 30-mesh stainless steel sieve"
            }
        ]
        for hp in haccp_points:
            existing_ccp = HaccpControlPoint.query.filter_by(tenant_id=amora_tenant.id, checkpoint_name=hp['checkpoint_name']).first()
            if not existing_ccp:
                ccp_obj = HaccpControlPoint(
                    tenant_id=amora_tenant.id,
                    company_id=amora_company.id,
                    checkpoint_name=hp['checkpoint_name'],
                    recorded_value=hp['recorded_value'],
                    spec_min=hp['spec_min'],
                    spec_max=hp['spec_max'],
                    unit=hp['unit'],
                    is_pass=hp['is_pass'],
                    corrective_action=hp['corrective_action'],
                    checked_by=hp['checked_by'],
                    checked_at=hp['checked_at'],
                    notes=hp['notes']
                )
                db.session.add(ccp_obj)
        db.session.flush()

        # -------------------------------------------------------------
        # 8. FINANCE & MASTER RELATIONS (COA, CUSTOMERS, SUPPLIERS)
        # -------------------------------------------------------------
        print("8/8. Setting up Chart of Accounts, Customers & Suppliers...")
        coa_data = [
            ("1010", "Cash in Till (Retail POS Counter)", "asset", Decimal("15000.00")),
            ("1020", "HDFC Current Account (Amora Operations)", "asset", Decimal("250000.00")),
            ("1030", "Bakery Raw Materials Inventory", "asset", Decimal("85000.00")),
            ("1040", "Finished Baked Goods Inventory", "asset", Decimal("45000.00")),
            ("2010", "Accounts Payable (Ingredient Suppliers)", "liability", Decimal("32000.00")),
            ("2020", "GST Output Tax Payable", "liability", Decimal("6500.00")),
            ("3010", "Owner's Capital - Amora Bakes", "equity", Decimal("500000.00")),
            ("4010", "Retail Counter POS Sales", "revenue", Decimal("0.00")),
            ("4020", "Wholesale Cafe & B2B Bakery Revenue", "revenue", Decimal("0.00")),
            ("5010", "Cost of Goods Sold - Baking Ingredients", "expense", Decimal("0.00")),
            ("6010", "Bakehouse Staff Salaries & Wages", "expense", Decimal("0.00")),
            ("6020", "Baking Oven Power, Gas & Electricity", "expense", Decimal("0.00")),
            ("6030", "Bakery Rent & Maintenance", "expense", Decimal("0.00"))
        ]
        for code, name, acct_type, op_bal in coa_data:
            existing_acct = ChartOfAccount.query.filter_by(tenant_id=amora_tenant.id, account_code=code).first()
            if not existing_acct:
                acct = ChartOfAccount(
                    tenant_id=amora_tenant.id,
                    company_id=amora_company.id,
                    account_code=code,
                    account_name=name,
                    account_type=acct_type,
                    opening_balance=op_bal,
                    current_balance=op_bal,
                    is_active=True
                )
                db.session.add(acct)

        # Suppliers
        suppliers_data = [
            ("Royal Flour Mills & Agro", "sales@royalflour.com", "+91 98401 11223", "Rajesh Sharma"),
            ("Heritage Fresh Dairy Ltd", "orders@heritagedairy.com", "+91 98402 33445", "Suresh Kumar"),
            ("Belgian Fine Cocoa Importers", "info@belgiancocoa.com", "+91 98403 55667", "Marc Dubois")
        ]
        for s_name, s_email, s_phone, s_person in suppliers_data:
            if not Supplier.query.filter_by(tenant_id=amora_tenant.id, name=s_name).first():
                supp = Supplier(
                    tenant_id=amora_tenant.id,
                    company_id=amora_company.id,
                    name=s_name,
                    email=s_email,
                    phone=s_phone,
                    contact_person=s_person,
                    city="Chennai",
                    state="Tamil Nadu",
                    payment_terms="Net 15",
                    is_active=True
                )
                db.session.add(supp)

        # Customers
        customers_data = [
            ("The Urban Cafe & Roastery", "manager@urbancafe.in", "+91 99401 77889", "B2B daily delivery client (sourdough loaves & croissants)"),
            ("Walk-in Retail Customer", "counter@amorabakery.com", "+91 98765 43210", "Front counter retail sales")
        ]
        for c_name, c_email, c_phone, c_notes in customers_data:
            if not Customer.query.filter_by(tenant_id=amora_tenant.id, name=c_name).first():
                cust = Customer(
                    tenant_id=amora_tenant.id,
                    company_id=amora_company.id,
                    name=c_name,
                    email=c_email,
                    phone=c_phone,
                    city="Chennai",
                    state="Tamil Nadu",
                    notes=c_notes,
                    is_active=True
                )
                db.session.add(cust)

        db.session.commit()
        print("\n" + "=" * 70)
        print("AMORA BAKERY & SUPERADMIN SETUP COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print("SUPERADMIN CREDENTIALS:")
        print("  Email:    superadmin@smartgonext.com")
        print("  Password: SuperAdmin@123")
        print("  Access:   Full SaaS Platform Admin (/admin)")
        print("-" * 70)
        print("AMORA BAKERY CLIENT CREDENTIALS:")
        print("  Email:    admin@amorabakery.com")
        print("  Password: Amora@123")
        print("  Company:  Amora Bakery & Patisserie")
        print("  Vertical: Bakery (Bake Planner, Recipe Scaler, HACCP QC, Batch WO)")
        print("=" * 70 + "\n")


if __name__ == '__main__':
    check_and_create_database()
    seed_database()
