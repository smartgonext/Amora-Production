"""
Comprehensive Ice Cream Demo Seeder
===================================
Seeds rich, coherent, production-grade demo data for an Ice Cream Manufacturing,
Creamery & Parlour business ("Frosty Delights Artisanal Creamery").

Covers:
- Tenant & Company & 3 Branches (Creamery Plant, Scoop Parlour, Mumbai Cold Hub)
- Cold Storage & Ambient Warehouses
- Units, Brands & Product Categories
- Raw Ingredients (Milk, Cream, Sugar, Vanilla, Cocoa, Mango Pulp, Nuts, Stabilizers)
- Packaging (Bio Tubs, Cups, Waffle Cones, Cartons)
- Finished Ice Cream Tubs, Bulk Parlour Tubs, Popsicles (with HSN, GST, Allergens, Nutrition, FEFO)
- Product Batches with Expiry Dates & Stock Ledgers
- B2B Wholesale Customers & Retail Parlour Walk-in Customers
- Dairy & Ingredient Suppliers
- Freezers, Pasteurizers, Reefer Trucks, Soft Serve Machines
- Equipment Rental Booking & Cold Storage AMC Contract + Service Schedule
- Manufacturing Config (Process type, Recipe, Expiry, Routing, MRP, QC)
- Work Centers & Machines (Pasteurization Deck, Churn-Freezing Line, Tub Packaging)
- Bills of Materials (BOMs & Routing Operations)
- Work Orders (Completed with Batch, In-Progress, Planned)
- Quality Control Inspections (Fat %, Overrun %, Hardening Temp, Sensory)
- Material Requirement Planning (MRP) calculations & shortages
- Job Work / Subcontracting (Cocoa nibs roasting)
- Daily Ice Cream Production Shift Plan & HACCP Critical Control Point
- Refrigerated Van Delivery Route & Completed Stops
- POS Billing & Wholesale Tax Invoices with GST & Batch Allocation
- Supplier Purchase Orders & Material Receipts
- HR Employees (Master Gelatiere, Dairy Chemist, Cold Chain Engineer, Parlour Lead, etc.)
- Complete Chart of Accounts tailored for Dairy & Cold Chain
- Growth Projects & Food Safety Documents
"""
import os
import sys
from datetime import datetime, timedelta, date
from decimal import Decimal
import json

from app.extensions import db
from app.models.tenant import Tenant, SubscriptionPlan, Subscription, Company, Branch, CompanySetting
from app.models.user import User, Role, Permission
from app.models.product import (
    ProductCategory, Product, Warehouse, Brand, Unit, ProductBatch, StockLedger,
    PurchaseOrder, PurchaseItem, GoodsReceiptNote, GRNItem, PurchaseReturn, PurchaseReturnItem
)
from app.models.customer import Customer, Supplier
from app.models.equipment import Equipment, RentalBooking
from app.models.amc import AMCContract, AMCEquipment, AMCServiceSchedule
from app.models.manufacturing import (
    TenantManufacturingConfig, WorkCenter, Machine, BomHeader, BomItem,
    BomRoutingOperation, WorkOrder, WorkOrderOperation, ProductionMaterialIssue,
    MaterialRequirementPlan, JobWorkOrder, QualityInspection, SupplierItemMapping
)
from app.models.bakery import (
    BakingPlan, BakingPlanItem, DeliveryRoute, DeliveryRouteStop, HaccpControlPoint
)
from app.models.sales import Invoice, InvoiceItem, Quotation, QuotationItem, SalesOrder, SalesOrderItem
from app.models.hr import Employee
from app.models.finance import ChartOfAccount
from app.models.project import Project
from app.models.document import Document
from app.models.repair import RepairJobCard
from app.services.business_type_config import seed_business_type_config
from app.services.template_initializer import seed_default_templates


def seed_ice_cream_demo(app, db, tenant, company, branch, user):
    """Seed comprehensive, realistic Ice Cream Creamery data for the given tenant."""
    tenant_id = tenant.id
    company_id = company.id
    now = datetime.utcnow()
    today = date.today()

    print(f"[{tenant.name}] Cleaning previous sample records for fresh Ice Cream seed...")

    # Clean existing data for this tenant
    for model in [
        RepairJobCard, Document, Project, Employee, HaccpControlPoint,
        DeliveryRouteStop, DeliveryRoute, BakingPlanItem, BakingPlan,
        MaterialRequirementPlan, JobWorkOrder, QualityInspection,
        SupplierItemMapping, ProductionMaterialIssue, WorkOrderOperation,
        WorkOrder, BomRoutingOperation, BomItem, BomHeader, Machine,
        WorkCenter, TenantManufacturingConfig, AMCServiceSchedule,
        AMCEquipment, AMCContract, RentalBooking, Equipment,
        InvoiceItem, Invoice, QuotationItem, Quotation, StockLedger,
        ProductBatch, Product, ProductCategory, Warehouse, Brand, Unit,
        Customer, Supplier
    ]:
        try:
            db.session.query(model).filter_by(tenant_id=tenant_id).delete()
        except Exception:
            pass
    db.session.flush()

    print(f"[{tenant.name}] Seeding Branches, Units, Brands, and Warehouses...")

    # 1. Ensure Additional Branches
    parlour_branch = Branch.query.filter_by(tenant_id=tenant_id, code='IND-SCOOP').first()
    if not parlour_branch:
        parlour_branch = Branch(
            tenant_id=tenant_id, company_id=company_id,
            name='Indiranagar Scoop Parlour & Cafe', code='IND-SCOOP',
            city='Bangalore', state='Karnataka', phone='9876543202',
            email='indiranagar@frostydelights.com', is_active=True
        )
        db.session.add(parlour_branch)

    mumbai_branch = Branch.query.filter_by(tenant_id=tenant_id, code='MUM-HUB').first()
    if not mumbai_branch:
        mumbai_branch = Branch(
            tenant_id=tenant_id, company_id=company_id,
            name='Mumbai Distribution Cold Hub', code='MUM-HUB',
            city='Mumbai', state='Maharashtra', phone='9876543203',
            email='mumbai@frostydelights.com', is_active=True
        )
        db.session.add(mumbai_branch)
    db.session.flush()

    # 2. Units
    u_ltr = Unit(tenant_id=tenant_id, name='Liters', short_name='Ltr')
    u_kg = Unit(tenant_id=tenant_id, name='Kilograms', short_name='Kg')
    u_g = Unit(tenant_id=tenant_id, name='Grams', short_name='g')
    u_pcs = Unit(tenant_id=tenant_id, name='Pieces', short_name='Pcs')
    u_tub = Unit(tenant_id=tenant_id, name='Tub', short_name='Tub')
    u_box = Unit(tenant_id=tenant_id, name='Box', short_name='Box')
    u_cone = Unit(tenant_id=tenant_id, name='Cone', short_name='Cone')
    db.session.add_all([u_ltr, u_kg, u_g, u_pcs, u_tub, u_box, u_cone])
    db.session.flush()

    # 3. Brands
    b_frosty = Brand(tenant_id=tenant_id, name='Frosty Delights Artisanal')
    b_amul = Brand(tenant_id=tenant_id, name='Amul Dairy Cooperative')
    b_callebaut = Brand(tenant_id=tenant_id, name='Barry Callebaut Belgium')
    b_monin = Brand(tenant_id=tenant_id, name='Monin Gourmet Extracts')
    b_ecopack = Brand(tenant_id=tenant_id, name='EcoPack Cold Solutions')
    db.session.add_all([b_frosty, b_amul, b_callebaut, b_monin, b_ecopack])
    db.session.flush()

    # 4. Warehouses
    wh_deep_freeze = Warehouse(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
        name='Main Blast & Deep Freeze Store (-25°C)',
        location='Creamery Plant Zone A, Whitefield, Bangalore', is_active=True
    )
    wh_ambient_raw = Warehouse(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
        name='Dairy & Ambient Ingredients Store (+4°C)',
        location='Creamery Plant Zone B, Whitefield, Bangalore', is_active=True
    )
    wh_parlour_dip = Warehouse(
        tenant_id=tenant_id, company_id=company_id, branch_id=parlour_branch.id,
        name='Parlour Display & Dip Freezers (-18°C)',
        location='100 Feet Road, Indiranagar, Bangalore', is_active=True
    )
    db.session.add_all([wh_deep_freeze, wh_ambient_raw, wh_parlour_dip])
    db.session.flush()

    print(f"[{tenant.name}] Seeding Product Categories & Ice Cream Products...")

    # 5. Product Categories
    cat_dairy_rm = ProductCategory(tenant_id=tenant_id, name='Dairy Raw Materials', description='Fresh whole milk, heavy dairy cream 40%, skimmed milk powder')
    cat_flavor_rm = ProductCategory(tenant_id=tenant_id, name='Flavor Bases & Sweeteners', description='Bourbon vanilla extract, Belgian cocoa, mango pulp, cane sugar')
    cat_mixins = ProductCategory(tenant_id=tenant_id, name='Mix-ins & Confectionery', description='Roasted almond nibs, choco chips, wafer crunch, fruit swirls')
    cat_pack = ProductCategory(tenant_id=tenant_id, name='Packaging & Disposables', description='Bio tubs & lids, single scoop cups, waffle cones, shipping cartons')
    cat_fg_retail = ProductCategory(tenant_id=tenant_id, name='Finished Ice Cream Tubs (Retail)', description='500ml premium retail tubs for supermarkets and parlours')
    cat_fg_bulk = ProductCategory(tenant_id=tenant_id, name='Bulk Gelato Tubs (Foodservice)', description='5 Liter bulk stainless/plastic tubs for scoop shops and cafes')
    cat_fg_novelty = ProductCategory(tenant_id=tenant_id, name='Popsicles & Novelties', description='Single serve impulse sticks, kulfis and choco bars')
    db.session.add_all([cat_dairy_rm, cat_flavor_rm, cat_mixins, cat_pack, cat_fg_retail, cat_fg_bulk, cat_fg_novelty])
    db.session.flush()

    # 6. Products
    # Raw Materials
    p_milk = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_dairy_rm.id,
        brand_id=b_amul.id, unit_id=u_ltr.id,
        name='Farm Fresh Whole Milk 3.5% Fat', sku='RM-MILK-01',
        hsn_code='0401', gst_rate=Decimal('5.00'), purchase_price=Decimal('45.00'),
        selling_price=Decimal('55.00'), min_stock_level=500, current_stock=2400,
        is_raw_material=True, is_batch_tracked=True, shelf_life_days=4, is_fresh=True,
        allergens=['Milk'], nutrition={'fat': '3.5%', 'snf': '8.5%'},
        description='Standardized pasteurized farm milk for ice cream base blend'
    )
    p_cream = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_dairy_rm.id,
        brand_id=b_amul.id, unit_id=u_kg.id,
        name='Heavy Dairy Cream 40% Fat', sku='RM-CREAM-02',
        hsn_code='0402', gst_rate=Decimal('12.00'), purchase_price=Decimal('260.00'),
        selling_price=Decimal('310.00'), min_stock_level=100, current_stock=650,
        is_raw_material=True, is_batch_tracked=True, shelf_life_days=14, is_fresh=True,
        allergens=['Milk'], nutrition={'fat': '40.0%'},
        description='Fresh chilled dairy cream essential for smooth creamy texture'
    )
    p_sugar = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_flavor_rm.id,
        brand_id=b_frosty.id, unit_id=u_kg.id,
        name='Refined Pure Cane Sugar', sku='RM-SUGAR-03',
        hsn_code='1701', gst_rate=Decimal('5.00'), purchase_price=Decimal('42.00'),
        selling_price=Decimal('50.00'), min_stock_level=200, current_stock=1500,
        is_raw_material=True, shelf_life_days=365,
        description='Pharma-grade double refined cane sugar for freezing point balance'
    )
    p_smp = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_dairy_rm.id,
        brand_id=b_amul.id, unit_id=u_kg.id,
        name='Skimmed Milk Powder (SMP Extra Grade)', sku='RM-SMP-04',
        hsn_code='0402', gst_rate=Decimal('5.00'), purchase_price=Decimal('280.00'),
        selling_price=Decimal('330.00'), min_stock_level=50, current_stock=350,
        is_raw_material=True, is_batch_tracked=True, shelf_life_days=180,
        allergens=['Milk'], description='Spray-dried SMP providing solid serum proteins'
    )
    p_vanilla = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_flavor_rm.id,
        brand_id=b_monin.id, unit_id=u_ltr.id,
        name='Madagascar Bourbon Pure Vanilla Extract', sku='RM-VANILLA-05',
        hsn_code='3302', gst_rate=Decimal('18.00'), purchase_price=Decimal('2400.00'),
        selling_price=Decimal('3000.00'), min_stock_level=10, current_stock=45,
        is_raw_material=True, is_batch_tracked=True, shelf_life_days=365,
        description='Double-fold cold-pressed pure Bourbon vanilla with real bean seeds'
    )
    p_cocoa = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_flavor_rm.id,
        brand_id=b_callebaut.id, unit_id=u_kg.id,
        name='Belgian Dark Cocoa Powder 70%', sku='RM-COCOA-06',
        hsn_code='1805', gst_rate=Decimal('18.00'), purchase_price=Decimal('650.00'),
        selling_price=Decimal('820.00'), min_stock_level=30, current_stock=180,
        is_raw_material=True, is_batch_tracked=True, shelf_life_days=365,
        description='Dutch-processed high butterfat dark cocoa powder'
    )
    p_mango_pulp = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_flavor_rm.id,
        brand_id=b_frosty.id, unit_id=u_kg.id,
        name='Ratnagiri Alphonso Mango Pulp (Natural)', sku='RM-MANGO-07',
        hsn_code='2007', gst_rate=Decimal('12.00'), purchase_price=Decimal('180.00'),
        selling_price=Decimal('230.00'), min_stock_level=50, current_stock=400,
        is_raw_material=True, is_batch_tracked=True, shelf_life_days=180,
        description='100% pure Alphonso mango puree with natural sweetness'
    )
    p_almond = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_mixins.id,
        brand_id=b_frosty.id, unit_id=u_kg.id,
        name='Dry-Roasted California Almond Nibs', sku='RM-ALMOND-08',
        hsn_code='0802', gst_rate=Decimal('12.00'), purchase_price=Decimal('750.00'),
        selling_price=Decimal('920.00'), min_stock_level=20, current_stock=110,
        is_raw_material=True, is_batch_tracked=True, shelf_life_days=180,
        allergens=['Tree Nuts'], description='Golden roasted diced almonds for crunch'
    )
    p_chips = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_mixins.id,
        brand_id=b_callebaut.id, unit_id=u_kg.id,
        name='Belgian Semi-Sweet Dark Choco Chips', sku='RM-CHIP-09',
        hsn_code='1806', gst_rate=Decimal('18.00'), purchase_price=Decimal('480.00'),
        selling_price=Decimal('620.00'), min_stock_level=25, current_stock=140,
        is_raw_material=True, is_batch_tracked=True, shelf_life_days=270,
        allergens=['Soy', 'Milk'], description='54% dark chocolate chips retaining bite in freezing'
    )
    p_stabilizer = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_dairy_rm.id,
        brand_id=b_frosty.id, unit_id=u_kg.id,
        name='Vegetable Ice Cream Stabilizer & Emulsifier Blend', sku='RM-STAB-10',
        hsn_code='1302', gst_rate=Decimal('18.00'), purchase_price=Decimal('850.00'),
        selling_price=Decimal('1100.00'), min_stock_level=15, current_stock=60,
        is_raw_material=True, shelf_life_days=365,
        description='Guar gum, locust bean gum and sunflower lecithin blend preventing ice crystals'
    )

    # Packaging Products
    p_tub500 = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_pack.id,
        brand_id=b_ecopack.id, unit_id=u_pcs.id,
        name='500ml Bio-Insulated Paper Tub & Lid', sku='PM-TUB-500',
        hsn_code='4819', gst_rate=Decimal('18.00'), purchase_price=Decimal('12.00'),
        selling_price=Decimal('16.00'), min_stock_level=500, current_stock=3500,
        is_raw_material=True, description='Freezer-safe insulated compostable paper tub with printed lid'
    )
    p_waffle_cone = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_pack.id,
        brand_id=b_ecopack.id, unit_id=u_cone.id,
        name='Crisp Artisan Waffle Cones (Vanilla Scented)', sku='PM-CONE-WAF',
        hsn_code='1905', gst_rate=Decimal('5.00'), purchase_price=Decimal('4.50'),
        selling_price=Decimal('15.00'), min_stock_level=200, current_stock=1800,
        description='Freshly rolled crisp vanilla waffle cones for scoop parlour'
    )
    p_cup100 = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_pack.id,
        brand_id=b_ecopack.id, unit_id=u_pcs.id,
        name='100ml Single Scoop Bio Cup with Wooden Spoon', sku='PM-CUP-100',
        hsn_code='4819', gst_rate=Decimal('18.00'), purchase_price=Decimal('3.50'),
        selling_price=Decimal('8.00'), min_stock_level=300, current_stock=2200,
        description='Quick-serve retail scoop cups with embedded biodegradable spoon'
    )

    # Finished Goods (Retail Tubs)
    p_fg_vanilla = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_fg_retail.id,
        brand_id=b_frosty.id, unit_id=u_pcs.id,
        name='Royal Bourbon Vanilla Bean 500ml Tub', sku='FG-VAN-500',
        hsn_code='21050000', gst_rate=Decimal('18.00'), purchase_price=Decimal('110.00'),
        selling_price=Decimal('249.00'), min_stock_level=50, current_stock=450,
        is_batch_tracked=True, shelf_life_days=180, best_before_days=180,
        allergens=['Milk'],
        nutrition={'calories': 210, 'fat_g': 12, 'carbs_g': 22, 'sugar_g': 19, 'protein_g': 4},
        description='Slow-churned velvety whole dairy ice cream speckled with genuine Madagascar vanilla beans'
    )
    p_fg_chocolate = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_fg_retail.id,
        brand_id=b_frosty.id, unit_id=u_pcs.id,
        name='Belgian Dark Chocolate Ganache 500ml Tub', sku='FG-CHOC-500',
        hsn_code='21050000', gst_rate=Decimal('18.00'), purchase_price=Decimal('135.00'),
        selling_price=Decimal('289.00'), min_stock_level=40, current_stock=380,
        is_batch_tracked=True, shelf_life_days=180, best_before_days=180,
        allergens=['Milk', 'Soy'],
        nutrition={'calories': 250, 'fat_g': 14, 'carbs_g': 26, 'sugar_g': 21, 'protein_g': 5},
        description='Intense 70% Belgian chocolate ice cream folded with soft chocolate ganache chips'
    )
    p_fg_mango = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_fg_retail.id,
        brand_id=b_frosty.id, unit_id=u_pcs.id,
        name='Alphonso Mango Gold Cream 500ml Tub', sku='FG-MANGO-500',
        hsn_code='21050000', gst_rate=Decimal('18.00'), purchase_price=Decimal('125.00'),
        selling_price=Decimal('269.00'), min_stock_level=40, current_stock=290,
        is_batch_tracked=True, shelf_life_days=150, best_before_days=150,
        allergens=['Milk'],
        nutrition={'calories': 190, 'fat_g': 9, 'carbs_g': 25, 'sugar_g': 23, 'protein_g': 3},
        description='Seasonal Ratnagiri Alphonso mango blend with rich country cream swirl'
    )

    # Bulk & Novelty Finished Goods
    p_fg_pistachio_bulk = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_fg_bulk.id,
        brand_id=b_frosty.id, unit_id=u_tub.id,
        name='Sicilian Roasted Pistachio Gelato 5L Bulk Tub', sku='FG-PIST-5L',
        hsn_code='21050000', gst_rate=Decimal('18.00'), purchase_price=Decimal('850.00'),
        selling_price=Decimal('1950.00'), min_stock_level=10, current_stock=35,
        is_batch_tracked=True, shelf_life_days=120, best_before_days=120,
        allergens=['Milk', 'Tree Nuts'],
        nutrition={'calories': 230, 'fat_g': 13, 'carbs_g': 24, 'sugar_g': 18, 'protein_g': 6},
        description='Authentic Italian style slow-churned pistachio gelato for scoop parlour dipping cabinets'
    )
    p_fg_kulfi = Product(
        tenant_id=tenant_id, company_id=company_id, category_id=cat_fg_novelty.id,
        brand_id=b_frosty.id, unit_id=u_pcs.id,
        name='Royal Malai Kulfi on Bamboo Stick', sku='FG-KULFI-01',
        hsn_code='21050000', gst_rate=Decimal('18.00'), purchase_price=Decimal('25.00'),
        selling_price=Decimal('60.00'), min_stock_level=100, current_stock=600,
        is_batch_tracked=True, shelf_life_days=180, best_before_days=180,
        allergens=['Milk', 'Nuts'],
        nutrition={'calories': 160, 'fat_g': 8, 'carbs_g': 18, 'sugar_g': 16, 'protein_g': 4},
        description='Traditional slow-reduced caramelized milk kulfi with saffron and crushed cardamom'
    )

    all_products = [
        p_milk, p_cream, p_sugar, p_smp, p_vanilla, p_cocoa, p_mango_pulp,
        p_almond, p_chips, p_stabilizer, p_tub500, p_waffle_cone, p_cup100,
        p_fg_vanilla, p_fg_chocolate, p_fg_mango, p_fg_pistachio_bulk, p_fg_kulfi
    ]
    db.session.add_all(all_products)
    db.session.flush()

    print(f"[{tenant.name}] Seeding Product Batches & Expiry (FEFO)...")

    # 7. Batches
    b1_vanilla = ProductBatch(
        tenant_id=tenant_id, product_id=p_fg_vanilla.id,
        batch_no='BATCH-VAN-2026-001', mfg_date=today - timedelta(days=5),
        expiry_date=today + timedelta(days=175), quantity=450,
        purchase_price=Decimal('110.00')
    )
    b2_choc = ProductBatch(
        tenant_id=tenant_id, product_id=p_fg_chocolate.id,
        batch_no='BATCH-CHOC-2026-002', mfg_date=today - timedelta(days=3),
        expiry_date=today + timedelta(days=177), quantity=380,
        purchase_price=Decimal('135.00')
    )
    b3_mango = ProductBatch(
        tenant_id=tenant_id, product_id=p_fg_mango.id,
        batch_no='BATCH-MANGO-2026-003', mfg_date=today - timedelta(days=2),
        expiry_date=today + timedelta(days=148), quantity=290,
        purchase_price=Decimal('125.00')
    )
    b4_milk = ProductBatch(
        tenant_id=tenant_id, product_id=p_milk.id,
        batch_no='BATCH-MILK-AMUL-99', mfg_date=today,
        expiry_date=today + timedelta(days=4), quantity=2400,
        purchase_price=Decimal('45.00')
    )
    b5_cream = ProductBatch(
        tenant_id=tenant_id, product_id=p_cream.id,
        batch_no='BATCH-CREAM-AMUL-88', mfg_date=today - timedelta(days=1),
        expiry_date=today + timedelta(days=13), quantity=650,
        purchase_price=Decimal('260.00')
    )
    db.session.add_all([b1_vanilla, b2_choc, b3_mango, b4_milk, b5_cream])
    db.session.flush()

    # Stock Ledgers for traceability
    sl1 = StockLedger(
        tenant_id=tenant_id, company_id=company_id, warehouse_id=wh_deep_freeze.id,
        product_id=p_fg_vanilla.id, batch_id=b1_vanilla.id,
        type='Purchase', quantity_delta=500, running_balance=500,
        rate=Decimal('110.00'), reference_type='WorkOrder',
        notes='Fresh batch production receipt', transaction_date=now - timedelta(days=5)
    )
    sl2 = StockLedger(
        tenant_id=tenant_id, company_id=company_id, warehouse_id=wh_deep_freeze.id,
        product_id=p_fg_vanilla.id, batch_id=b1_vanilla.id,
        type='Sale', quantity_delta=-50, running_balance=450,
        rate=Decimal('249.00'), reference_type='Invoice',
        notes='B2B dispatch to Nature Basket Supermarket', transaction_date=now - timedelta(days=2)
    )
    db.session.add_all([sl1, sl2])
    db.session.flush()

    print(f"[{tenant.name}] Seeding Customers & Dairy Suppliers...")

    # 8. Customers
    cust_supermarket = Customer(
        tenant_id=tenant_id, company_id=company_id,
        name="Nature's Basket Gourmet Supermarkets",
        email='procurement@naturesbasket.in', phone='9876543101',
        address='Orion Mall Gourmet Wing, Brigade Gateway, Bangalore',
        city='Bangalore', state='Karnataka', gstin='29AAACN1234P1Z8',
        credit_limit=Decimal('500000.00'), credit_period_days=30
    )
    cust_cafe = Customer(
        tenant_id=tenant_id, company_id=company_id,
        name='Cafe Mocha & Artisan Desserts',
        email='orders@cafemocha.in', phone='9876543102',
        address='12th Main, HAL 2nd Stage, Indiranagar, Bangalore',
        city='Bangalore', state='Karnataka', gstin='29AABCC5678M1Z2',
        credit_limit=Decimal('250000.00'), credit_period_days=15
    )
    cust_banquet = Customer(
        tenant_id=tenant_id, company_id=company_id,
        name='The Oberoi Luxury Banquets & Events',
        email='banquets@oberoihotels.com', phone='9876543103',
        address='37-39 MG Road, Bangalore',
        city='Bangalore', state='Karnataka', gstin='29AAATO9012K1Z4',
        credit_limit=Decimal('1000000.00'), credit_period_days=45
    )
    cust_franchise = Customer(
        tenant_id=tenant_id, company_id=company_id,
        name='Sweet Tooth Parlour Franchise #104',
        email='franchise104@sweettooth.in', phone='9876543104',
        address='Koramangala 4th Block, Bangalore',
        city='Bangalore', state='Karnataka', gstin='29AABCS3456F1Z9',
        credit_limit=Decimal('300000.00'), credit_period_days=30
    )
    cust_walkin = Customer(
        tenant_id=tenant_id, company_id=company_id,
        name='Aarav Sharma (Walk-in Guest)',
        email='aarav.sharma@gmail.com', phone='9876543299',
        address='Indiranagar, Bangalore',
        city='Bangalore', state='Karnataka', gstin='',
        credit_limit=Decimal('10000.00'), credit_period_days=0
    )
    db.session.add_all([cust_supermarket, cust_cafe, cust_banquet, cust_franchise, cust_walkin])
    db.session.flush()

    # 9. Suppliers
    supp_amul = Supplier(
        tenant_id=tenant_id, company_id=company_id,
        name='Amul Dairy Cooperative Federation Ltd',
        email='bulkorders@amul.coop', phone='9988771101',
        address='Anand Dairy Plant Road, Gujarat & Bangalore Depot',
        city='Bangalore', state='Karnataka', gstin='24AAACA1234A1Z1',
        credit_limit=Decimal('2500000.00'), payment_terms='Net 30'
    )
    supp_callebaut = Supplier(
        tenant_id=tenant_id, company_id=company_id,
        name='Barry Callebaut Cocoa & Confectionery Ltd',
        email='india.sales@barry-callebaut.com', phone='9988771102',
        address='MIDC Baramati, Pune, Maharashtra',
        city='Pune', state='Maharashtra', gstin='27AAACB5678B1Z2',
        credit_limit=Decimal('1500000.00'), payment_terms='Net 45',
        is_job_work_vendor=True
    )
    supp_sugar = Supplier(
        tenant_id=tenant_id, company_id=company_id,
        name='Dhampur Sugar Mills Ltd',
        email='orders@dhampur.com', phone='9988771103',
        address='Dhampur, Bijnor, Uttar Pradesh',
        city='Dhampur', state='Uttar Pradesh', gstin='09AAACD9012D1Z3',
        credit_limit=Decimal('800000.00'), payment_terms='Net 30'
    )
    supp_mango = Supplier(
        tenant_id=tenant_id, company_id=company_id,
        name='Ratnagiri Alphonso Farmers Collective',
        email='supply@ratnagirialphonso.org', phone='9988771104',
        address='Devgad & Ratnagiri Agro Hub, Maharashtra',
        city='Ratnagiri', state='Maharashtra', gstin='27AAACR3456R1Z5',
        credit_limit=Decimal('1200000.00'), payment_terms='Net 30'
    )
    supp_pack = Supplier(
        tenant_id=tenant_id, company_id=company_id,
        name='EcoPack Cold Packaging Solutions Pvt Ltd',
        email='sales@ecopackcold.com', phone='9988771105',
        address='Peenya Industrial Area Stage 2, Bangalore',
        city='Bangalore', state='Karnataka', gstin='29AAACE7890E1Z6',
        credit_limit=Decimal('500000.00'), payment_terms='Net 30'
    )
    supp_coldtech = Supplier(
        tenant_id=tenant_id, company_id=company_id,
        name='ColdTech Industrial Refrigeration & Spares',
        email='service@coldtechfreezers.in', phone='9988771106',
        address='Hosur Road Industrial Corridor, Bangalore',
        city='Bangalore', state='Karnataka', gstin='29AAACC1122C1Z7',
        credit_limit=Decimal('400000.00'), payment_terms='Net 15'
    )
    db.session.add_all([supp_amul, supp_callebaut, supp_sugar, supp_mango, supp_pack, supp_coldtech])
    db.session.flush()

    print(f"[{tenant.name}] Seeding Creamery Equipment, Rentals & Freezing AMC...")

    # 10. Equipment
    eq_batch_freezer = Equipment(
        tenant_id=tenant_id, company_id=company_id,
        name='Continuous Gelato & Ice Cream Batch Freezer 100L/hr',
        type='Freezer', model_number='GEL-BF-100', ton_capacity=Decimal('1.50'),
        serial_number='BF-2024-901', registration_number='PLANT-BF-01',
        rental_status='Available', purchase_price=Decimal('1850000.00'),
        min_hourly_rate=Decimal('600.00'), min_daily_rate=Decimal('4000.00'),
        min_weekly_rate=Decimal('22000.00'), min_monthly_rate=Decimal('75000.00'),
        purchase_date=now - timedelta(days=300)
    )
    eq_pasteurizer = Equipment(
        tenant_id=tenant_id, company_id=company_id,
        name='High-Pressure Homogenizer & Pasteurizer Tank 500L',
        type='Pasteurizer', model_number='PAST-500-SS', ton_capacity=Decimal('2.00'),
        serial_number='HP-2024-502', registration_number='PLANT-HP-02',
        rental_status='Available', purchase_price=Decimal('2400000.00'),
        min_hourly_rate=Decimal('800.00'), min_daily_rate=Decimal('5500.00'),
        purchase_date=now - timedelta(days=365)
    )
    eq_blast_room = Equipment(
        tenant_id=tenant_id, company_id=company_id,
        name='Walk-in Deep Freeze Hardening Room (-40°C)',
        type='ColdRoom', model_number='BLAST-FRZ-40', ton_capacity=Decimal('10.00'),
        serial_number='WF-2024-103', registration_number='PLANT-CR-03',
        rental_status='Available', purchase_price=Decimal('3500000.00'),
        min_daily_rate=Decimal('8000.00'), purchase_date=now - timedelta(days=400)
    )
    eq_reefer_van = Equipment(
        tenant_id=tenant_id, company_id=company_id,
        name='Reefer Cold-Delivery Van (-20°C Temp Controlled)',
        type='Vehicle', model_number='TATA-407-COLD', ton_capacity=Decimal('3.50'),
        serial_number='RV-2024-804', registration_number='KA-01-IC-2026',
        rental_status='Available', purchase_price=Decimal('2200000.00'),
        min_daily_rate=Decimal('6000.00'), purchase_date=now - timedelta(days=200)
    )
    eq_softserve = Equipment(
        tenant_id=tenant_id, company_id=company_id,
        name='Italian Soft Serve Twin-Twist Commercial Dispenser',
        type='Dispenser', model_number='CARP-TWIST-2', ton_capacity=Decimal('0.40'),
        serial_number='SS-2024-305', registration_number='EVT-SS-05',
        rental_status='Rented', purchase_price=Decimal('450000.00'),
        min_hourly_rate=Decimal('500.00'), min_daily_rate=Decimal('3500.00'),
        min_weekly_rate=Decimal('18000.00'), purchase_date=now - timedelta(days=120)
    )
    eq_dip_freezer = Equipment(
        tenant_id=tenant_id, company_id=company_id,
        name='Glass-Top Scoop Parlour Display Freezer (12 Tub)',
        type='DisplayCabinet', model_number='SCOOP-DISP-12', ton_capacity=Decimal('0.50'),
        serial_number='SD-2024-406', registration_number='SCOOP-DF-06',
        rental_status='Available', purchase_price=Decimal('220000.00'),
        min_daily_rate=Decimal('1800.00'), purchase_date=now - timedelta(days=150)
    )
    db.session.add_all([eq_batch_freezer, eq_pasteurizer, eq_blast_room, eq_reefer_van, eq_softserve, eq_dip_freezer])
    db.session.flush()

    # 11. Rental Booking: Soft Serve rented to Oberoi Banquets
    booking = RentalBooking(
        tenant_id=tenant_id, company_id=company_id, equipment_id=eq_softserve.id,
        customer_id=cust_banquet.id, booking_number='RB-2026-ICE-001',
        start_date=now - timedelta(days=1), end_date=now + timedelta(days=3),
        rental_rate_applied=Decimal('3500.00'), rate_type='Daily',
        security_deposit=Decimal('15000.00'), site_address='The Oberoi Lawns, MG Road, Bangalore',
        site_contact_person='Mr. Vikram Oberoi', site_contact_phone='9876543103',
        total_rental_amount=Decimal('14000.00'), total_amount=Decimal('16520.00'),
        billing_status='Billed', status='Active'
    )
    db.session.add(booking)
    db.session.flush()

    # 12. AMC Contract: Annual Maintenance on Blast Freezer & Pasteurizer
    amc = AMCContract(
        tenant_id=tenant_id, customer_id=cust_supermarket.id,
        contract_title='Walk-in Blast Freezer & Pasteurizer Comprehensive AMC',
        start_date=now - timedelta(days=60), end_date=now + timedelta(days=305),
        amc_value=Decimal('85000.00'), billing_frequency='Quarterly',
        service_interval_days=90
    )
    db.session.add(amc)
    db.session.flush()

    amc_eq1 = AMCEquipment(
        tenant_id=tenant_id, amc_id=amc.id, machine_name=eq_blast_room.name,
        machine_serial=eq_blast_room.serial_number, model=eq_blast_room.model_number,
        capacity='10-Ton Hardening'
    )
    amc_eq2 = AMCEquipment(
        tenant_id=tenant_id, amc_id=amc.id, machine_name=eq_pasteurizer.name,
        machine_serial=eq_pasteurizer.serial_number, model=eq_pasteurizer.model_number,
        capacity='500L/Batch'
    )
    db.session.add_all([amc_eq1, amc_eq2])
    db.session.flush()

    amc_sched = AMCServiceSchedule(
        tenant_id=tenant_id, amc_id=amc.id, scheduled_date=now + timedelta(days=30),
        assigned_technician_id=user.id, status='Pending',
        notes='Quarterly refrigerant gas check and compressor oil analysis'
    )
    db.session.add(amc_sched)
    db.session.flush()

    print(f"[{tenant.name}] Seeding Manufacturing Engine (Work Centers, BOMs, Work Orders, QC)...")

    # 13. Tenant Manufacturing Config (Process / Dairy / Bakery profile)
    mfg_config = TenantManufacturingConfig(
        tenant_id=tenant_id,
        mfg_type='process',
        bom_label='Recipe / Batch Formula',
        tracking_label='Batch + Expiry (FEFO)',
        operation_label='Pasteurization / Churning',
        enabled_features=[
            'routing', 'mrp', 'work_orders', 'quality_control', 'job_work',
            'baker_pct_scaling', 'freshness', 'fefo', 'haccp', 'qc', 'batch_tracking',
            'subcontracting', 'baking_plan', 'fresh_returns', 'day_cost'
        ],
        is_active=True
    )
    db.session.add(mfg_config)
    db.session.flush()

    # 14. Work Centers & Machines
    wc_mixing = WorkCenter(
        tenant_id=tenant_id, name='Dairy Mix & Pasteurization Deck',
        hourly_labor_rate=Decimal('200.00'), hourly_machine_rate=Decimal('400.00'),
        capacity_limit=500, description='Stainless steel jacketed tanks for mixing milk, cream, sugar, and HTST pasteurization'
    )
    wc_churning = WorkCenter(
        tenant_id=tenant_id, name='Continuous Freezing & Churn Line',
        hourly_labor_rate=Decimal('250.00'), hourly_machine_rate=Decimal('550.00'),
        capacity_limit=200, description='Rapid continuous freezing barrel incorporating controlled overrun air'
    )
    wc_packing = WorkCenter(
        tenant_id=tenant_id, name='Tub Filling & Blast Hardening Chamber',
        hourly_labor_rate=Decimal('180.00'), hourly_machine_rate=Decimal('350.00'),
        capacity_limit=1000, description='Rotary tub filler, safety heat-sealing, and transfer to -40°C blast tunnel'
    )
    db.session.add_all([wc_mixing, wc_churning, wc_packing])
    db.session.flush()

    m_past = Machine(
        tenant_id=tenant_id, work_center_id=wc_mixing.id,
        name='Homogenizer & Pasteurizer Unit 500L', hourly_machine_rate=Decimal('400.00'),
        is_active=True
    )
    m_freezer = Machine(
        tenant_id=tenant_id, work_center_id=wc_churning.id,
        name='Continuous Ice Cream Freezer Barrel', hourly_machine_rate=Decimal('550.00'),
        is_active=True
    )
    m_filler = Machine(
        tenant_id=tenant_id, work_center_id=wc_packing.id,
        name='Automatic Rotary Tub Filler & Foil Sealer', hourly_machine_rate=Decimal('350.00'),
        is_active=True
    )
    db.session.add_all([m_past, m_freezer, m_filler])
    db.session.flush()

    # 15. BOM 1: Royal Bourbon Vanilla 500ml Tub (Batch of 500 Tubs / 250 Liters)
    bom_vanilla = BomHeader(
        tenant_id=tenant_id, company_id=company_id, product_id=p_fg_vanilla.id,
        name='Commercial Batch Formula - Royal Bourbon Vanilla 500ml', version='V1.0',
        status='active', standard_cost=Decimal('55000.00'), overhead_cost=Decimal('6500.00'),
        total_setup_time_mins=45,
        notes='Formula produces exactly 500 Tubs (250 Liters liquid mix at 80% overrun)'
    )
    db.session.add(bom_vanilla)
    db.session.flush()

    # BOM Items
    b_items_vanilla = [
        BomItem(bom_id=bom_vanilla.id, item_id=p_milk.id, qty_required=Decimal('150.0000'), uom='Ltr', waste_pct=Decimal('1.00')),
        BomItem(bom_id=bom_vanilla.id, item_id=p_cream.id, qty_required=Decimal('60.0000'), uom='Kg', waste_pct=Decimal('1.00')),
        BomItem(bom_id=bom_vanilla.id, item_id=p_sugar.id, qty_required=Decimal('35.0000'), uom='Kg', waste_pct=Decimal('0.50')),
        BomItem(bom_id=bom_vanilla.id, item_id=p_smp.id, qty_required=Decimal('10.0000'), uom='Kg', waste_pct=Decimal('0.50')),
        BomItem(bom_id=bom_vanilla.id, item_id=p_vanilla.id, qty_required=Decimal('2.5000'), uom='Ltr', waste_pct=Decimal('0.00')),
        BomItem(bom_id=bom_vanilla.id, item_id=p_stabilizer.id, qty_required=Decimal('1.2000'), uom='Kg', waste_pct=Decimal('0.00')),
        BomItem(bom_id=bom_vanilla.id, item_id=p_tub500.id, qty_required=Decimal('510.0000'), uom='Pcs', waste_pct=Decimal('2.00')),
    ]
    db.session.add_all(b_items_vanilla)

    # Routing Operations
    op1 = BomRoutingOperation(
        bom_id=bom_vanilla.id, operation_sequence=10,
        operation_name='Batch Mixing, Homogenization & Pasteurization (85°C)',
        work_center_id=wc_mixing.id, machine_id=m_past.id, setup_time_mins=20,
        processing_time_per_unit_mins=Decimal('0.1000'), labor_hours_per_unit=Decimal('0.0500')
    )
    op2 = BomRoutingOperation(
        bom_id=bom_vanilla.id, operation_sequence=20,
        operation_name='Continuous Churn-Freezing (-5°C) & Overrun Aeration',
        work_center_id=wc_churning.id, machine_id=m_freezer.id, setup_time_mins=15,
        processing_time_per_unit_mins=Decimal('0.1500'), labor_hours_per_unit=Decimal('0.0800')
    )
    op3 = BomRoutingOperation(
        bom_id=bom_vanilla.id, operation_sequence=30,
        operation_name='Tub Filling, Foil Heat-Sealing & Blast Hardening (-40°C)',
        work_center_id=wc_packing.id, machine_id=m_filler.id, setup_time_mins=10,
        processing_time_per_unit_mins=Decimal('0.0800'), labor_hours_per_unit=Decimal('0.0400')
    )
    db.session.add_all([op1, op2, op3])
    db.session.flush()

    # 16. BOM 2: Belgian Dark Chocolate 500ml Tub
    bom_choc = BomHeader(
        tenant_id=tenant_id, company_id=company_id, product_id=p_fg_chocolate.id,
        name='Commercial Batch Formula - Belgian Dark Chocolate 500ml', version='V1.0',
        status='active', standard_cost=Decimal('67500.00'), overhead_cost=Decimal('7200.00'),
        total_setup_time_mins=45,
        notes='500-tub batch enriched with 70% dark cocoa and real chocolate ganache pieces'
    )
    db.session.add(bom_choc)
    db.session.flush()

    b_items_choc = [
        BomItem(bom_id=bom_choc.id, item_id=p_milk.id, qty_required=Decimal('140.0000'), uom='Ltr', waste_pct=Decimal('1.00')),
        BomItem(bom_id=bom_choc.id, item_id=p_cream.id, qty_required=Decimal('65.0000'), uom='Kg', waste_pct=Decimal('1.00')),
        BomItem(bom_id=bom_choc.id, item_id=p_sugar.id, qty_required=Decimal('35.0000'), uom='Kg', waste_pct=Decimal('0.50')),
        BomItem(bom_id=bom_choc.id, item_id=p_smp.id, qty_required=Decimal('8.0000'), uom='Kg', waste_pct=Decimal('0.50')),
        BomItem(bom_id=bom_choc.id, item_id=p_cocoa.id, qty_required=Decimal('15.0000'), uom='Kg', waste_pct=Decimal('0.50')),
        BomItem(bom_id=bom_choc.id, item_id=p_chips.id, qty_required=Decimal('10.0000'), uom='Kg', waste_pct=Decimal('0.00')),
        BomItem(bom_id=bom_choc.id, item_id=p_stabilizer.id, qty_required=Decimal('1.2000'), uom='Kg', waste_pct=Decimal('0.00')),
        BomItem(bom_id=bom_choc.id, item_id=p_tub500.id, qty_required=Decimal('510.0000'), uom='Pcs', waste_pct=Decimal('2.00')),
    ]
    db.session.add_all(b_items_choc)
    db.session.flush()

    # Supplier Item Mappings
    sm1 = SupplierItemMapping(tenant_id=tenant_id, supplier_id=supp_amul.id, item_id=p_milk.id, lead_time_days=1, unit_cost=Decimal('45.00'))
    sm2 = SupplierItemMapping(tenant_id=tenant_id, supplier_id=supp_amul.id, item_id=p_cream.id, lead_time_days=1, unit_cost=Decimal('260.00'))
    sm3 = SupplierItemMapping(tenant_id=tenant_id, supplier_id=supp_callebaut.id, item_id=p_cocoa.id, lead_time_days=4, unit_cost=Decimal('650.00'))
    sm4 = SupplierItemMapping(tenant_id=tenant_id, supplier_id=supp_pack.id, item_id=p_tub500.id, lead_time_days=3, unit_cost=Decimal('12.00'))
    db.session.add_all([sm1, sm2, sm3, sm4])
    db.session.flush()

    # 17. Work Orders
    # WO 1: Completed Vanilla 500 tubs
    wo1 = WorkOrder(
        tenant_id=tenant_id, company_id=company_id, bom_id=bom_vanilla.id,
        wo_number='WO-2026-VAN-001', planned_qty=Decimal('500.0000'),
        produced_qty=Decimal('500.0000'), start_date=today - timedelta(days=5),
        end_date=today - timedelta(days=5), due_date=today - timedelta(days=4),
        status='completed', notes='Morning production batch for supermarket distribution'
    )
    # WO 2: In-Progress Chocolate 500 tubs
    wo2 = WorkOrder(
        tenant_id=tenant_id, company_id=company_id, bom_id=bom_choc.id,
        wo_number='WO-2026-CHOC-002', planned_qty=Decimal('500.0000'),
        produced_qty=Decimal('0.0000'), start_date=today - timedelta(days=1),
        due_date=today + timedelta(days=2),
        status='wip', notes='Special weekend batch for Indiranagar Scoop Parlour'
    )
    # WO 3: Planned Mango 300 tubs
    wo3 = WorkOrder(
        tenant_id=tenant_id, company_id=company_id, bom_id=bom_vanilla.id,
        wo_number='WO-2026-MANGO-003', planned_qty=Decimal('300.0000'),
        produced_qty=Decimal('0.0000'), start_date=today,
        due_date=today + timedelta(days=3),
        status='planned', notes='Alphonso seasonal run'
    )
    db.session.add_all([wo1, wo2, wo3])
    db.session.flush()

    # Operations for WO2 (WIP)
    wo_op1 = WorkOrderOperation(
        work_order_id=wo2.id, operation_sequence=10,
        operation_name='Batch Mixing & Pasteurization (85°C)',
        work_center_id=wc_mixing.id, machine_id=m_past.id,
        planned_setup_time=20, planned_run_time=60, actual_setup_time=20,
        actual_run_time=58, status='completed', operator_user_id=user.id,
        started_at=now - timedelta(hours=4), completed_at=now - timedelta(hours=2)
    )
    wo_op2 = WorkOrderOperation(
        work_order_id=wo2.id, operation_sequence=20,
        operation_name='Continuous Churn-Freezing (-5°C)',
        work_center_id=wc_churning.id, machine_id=m_freezer.id,
        planned_setup_time=15, planned_run_time=90, actual_setup_time=15,
        actual_run_time=45, status='in_progress', operator_user_id=user.id,
        started_at=now - timedelta(hours=2)
    )
    wo_op3 = WorkOrderOperation(
        work_order_id=wo2.id, operation_sequence=30,
        operation_name='Tub Filling, Sealing & Blast Hardening',
        work_center_id=wc_packing.id, machine_id=m_filler.id,
        planned_setup_time=10, planned_run_time=50, actual_setup_time=0,
        actual_run_time=0, status='pending'
    )
    db.session.add_all([wo_op1, wo_op2, wo_op3])
    db.session.flush()

    # Material Issues for WO2
    pmi1 = ProductionMaterialIssue(
        tenant_id=tenant_id, work_order_id=wo2.id, item_id=p_milk.id,
        warehouse_id=wh_ambient_raw.id, qty_planned=Decimal('140.0000'),
        qty_issued=Decimal('140.0000'), qty_consumed=Decimal('140.0000'),
        qty_returned=Decimal('0.0000'), variance=Decimal('0.0000')
    )
    pmi2 = ProductionMaterialIssue(
        tenant_id=tenant_id, work_order_id=wo2.id, item_id=p_cream.id,
        warehouse_id=wh_ambient_raw.id, qty_planned=Decimal('65.0000'),
        qty_issued=Decimal('65.0000'), qty_consumed=Decimal('65.0000'),
        qty_returned=Decimal('0.0000'), variance=Decimal('0.0000')
    )
    pmi3 = ProductionMaterialIssue(
        tenant_id=tenant_id, work_order_id=wo2.id, item_id=p_cocoa.id,
        warehouse_id=wh_ambient_raw.id, qty_planned=Decimal('15.0000'),
        qty_issued=Decimal('15.0000'), qty_consumed=Decimal('15.0000'),
        qty_returned=Decimal('0.0000'), variance=Decimal('0.0000')
    )
    db.session.add_all([pmi1, pmi2, pmi3])
    db.session.flush()

    # 18. Quality Inspection for WO1 (Passed QC)
    qc = QualityInspection(
        tenant_id=tenant_id, company_id=company_id,
        reference_type='work_order', reference_id=wo1.id,
        inspection_date=now - timedelta(days=5),
        passed_qty=Decimal('500.00'), failed_qty=Decimal('0.00'),
        qc_status='passed',
        remarks='Batch BATCH-VAN-2026-001 certified compliant with FSSAI dairy standards.',
        check_parameters=[
            {'name': 'Milk Butterfat %', 'standard': 'Min 10.0%', 'actual': '11.8%', 'result': 'pass'},
            {'name': 'Overrun (Air Volume %)', 'standard': '75% - 85%', 'actual': '81.5%', 'result': 'pass'},
            {'name': 'Blast Core Temperature', 'standard': '<= -18°C', 'actual': '-22.4°C', 'result': 'pass'},
            {'name': 'Total Bacterial Plate Count', 'standard': '< 10 CFU/g', 'actual': '0 CFU/g', 'result': 'pass'},
            {'name': 'Sensory & Vanilla Aroma', 'standard': 'Velvety smooth, visible bean specs', 'actual': 'Flawless texture', 'result': 'pass'}
        ]
    )
    db.session.add(qc)
    db.session.flush()

    # 19. MRP Calculation Records
    mrp1 = MaterialRequirementPlan(
        tenant_id=tenant_id, work_order_id=wo3.id, raw_material_id=p_milk.id,
        required_qty=Decimal('90.0000'), current_stock_qty=Decimal('2400.0000'),
        shortage_qty=Decimal('0.0000'), status='draft'
    )
    mrp2 = MaterialRequirementPlan(
        tenant_id=tenant_id, work_order_id=wo3.id, raw_material_id=p_mango_pulp.id,
        required_qty=Decimal('60.0000'), current_stock_qty=Decimal('400.0000'),
        shortage_qty=Decimal('0.0000'), status='draft'
    )
    db.session.add_all([mrp1, mrp2])
    db.session.flush()

    # 20. Job Work Order (Subcontracting Cocoa Nibs Roasting)
    jw = JobWorkOrder(
        tenant_id=tenant_id, company_id=company_id, vendor_id=supp_callebaut.id,
        work_order_id=wo2.id, issue_challan_no='JW-CH-2026-011',
        status='sent', expected_return_date=today + timedelta(days=5),
        service_cost=Decimal('4500.00'),
        materials_sent=[
            {'item_id': p_cocoa.id, 'qty': 25, 'uom': 'Kg'}
        ]
    )
    db.session.add(jw)
    db.session.flush()

    print(f"[{tenant.name}] Seeding Dairy/Bakery Daily Churning Plan & HACCP...")

    # 21. Daily Production Shift Plan
    shift_plan = BakingPlan(
        tenant_id=tenant_id, company_id=company_id,
        plan_date=today, shift='Morning', status='in_progress'
    )
    db.session.add(shift_plan)
    db.session.flush()

    plan_item = BakingPlanItem(
        plan_id=shift_plan.id, tenant_id=tenant_id, product_id=p_fg_vanilla.id,
        order_demand=300, forecast_qty=200, planned_qty=500, batch_size=500,
        num_batches=1, oven='Pasteurizer Deck A', status='baking',
        notes='High demand supermarket batch'
    )
    db.session.add(plan_item)
    db.session.flush()

    # HACCP Critical Control Point
    haccp = HaccpControlPoint(
        tenant_id=tenant_id, company_id=company_id, bake_plan_item_id=plan_item.id,
        checkpoint_name='HTST Pasteurization Hold Time & Temp',
        recorded_value='85.4°C for 16s', spec_min=Decimal('85.00'),
        spec_max=Decimal('88.00'), unit='°C', is_pass=True,
        checked_by=user.id, checked_at=now - timedelta(hours=2),
        notes='Meets pasteurization food safety validation standards'
    )
    db.session.add(haccp)
    db.session.flush()

    # Reefer Delivery Route
    route = DeliveryRoute(
        tenant_id=tenant_id, company_id=company_id,
        route_date=today, vehicle_no='KA-01-IC-2026',
        driver='Vikram Rathore (Reefer Cold Fleet)', status='in_transit',
        notes='Morning cold delivery to Indiranagar & Supermarket'
    )
    db.session.add(route)
    db.session.flush()

    stop1 = DeliveryRouteStop(
        route_id=route.id, tenant_id=tenant_id, customer_id=cust_supermarket.id,
        sequence=1, status='delivered', notes='50 Tubs Royal Vanilla delivered at -20°C'
    )
    stop2 = DeliveryRouteStop(
        route_id=route.id, tenant_id=tenant_id, customer_id=cust_cafe.id,
        sequence=2, status='in_transit', notes='Scheduled 11:30 AM drop'
    )
    db.session.add_all([stop1, stop2])
    db.session.flush()

    print(f"[{tenant.name}] Seeding POS Sales & Wholesale Tax Invoices...")

    # 22. Invoices
    # Wholesale Tax Invoice
    inv_wholesale = Invoice(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
        customer_id=cust_supermarket.id, invoice_number='INV-2026-001',
        invoice_date=now - timedelta(days=2), due_date=now + timedelta(days=28),
        type='Sales', subtotal=Decimal('49800.00'),
        cgst_amount=Decimal('4482.00'), sgst_amount=Decimal('4482.00'),
        total_amount=Decimal('58764.00'), net_amount=Decimal('58764.00'),
        payment_method='BankTransfer', payment_status='Paid',
        outstanding_balance=Decimal('0.00'),
        notes='Wholesale dispatch of 200 Tubs Royal Vanilla Bean 500ml'
    )
    db.session.add(inv_wholesale)
    db.session.flush()

    inv_item1 = InvoiceItem(
        tenant_id=tenant_id, invoice_id=inv_wholesale.id, product_id=p_fg_vanilla.id,
        description='Royal Bourbon Vanilla Bean 500ml Tub - Batch BATCH-VAN-2026-001',
        quantity=200, rate=Decimal('249.00'), gst_rate=Decimal('18.00'),
        cgst_amount=Decimal('4482.00'), sgst_amount=Decimal('4482.00'),
        total_amount=Decimal('58764.00')
    )
    db.session.add(inv_item1)
    db.session.flush()

    # POS Retail Bill (Scoop Parlour Walk-in)
    inv_pos = Invoice(
        tenant_id=tenant_id, company_id=company_id, branch_id=parlour_branch.id,
        customer_id=cust_walkin.id, invoice_number='POS-2026-IND-042',
        invoice_date=now - timedelta(hours=3), due_date=now,
        type='Sales', subtotal=Decimal('498.00'),
        cgst_amount=Decimal('44.82'), sgst_amount=Decimal('44.82'),
        total_amount=Decimal('587.64'), net_amount=Decimal('587.64'),
        payment_method='UPI', payment_status='Paid', outstanding_balance=Decimal('0.00'),
        notes='Scoop Parlour UPI transaction #TXN998822'
    )
    db.session.add(inv_pos)
    db.session.flush()

    inv_pos_item = InvoiceItem(
        tenant_id=tenant_id, invoice_id=inv_pos.id, product_id=p_fg_vanilla.id,
        description='Royal Bourbon Vanilla 500ml Tub',
        quantity=2, rate=Decimal('249.00'), gst_rate=Decimal('18.00'),
        cgst_amount=Decimal('44.82'), sgst_amount=Decimal('44.82'),
        total_amount=Decimal('587.64')
    )
    db.session.add(inv_pos_item)
    db.session.flush()

    # Equipment Rental Invoice
    inv_rent = Invoice(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
        customer_id=cust_banquet.id, invoice_number='INV-RENT-2026-003',
        invoice_date=now - timedelta(days=1), due_date=now + timedelta(days=14),
        type='Rental', subtotal=Decimal('14000.00'),
        cgst_amount=Decimal('1260.00'), sgst_amount=Decimal('1260.00'),
        total_amount=Decimal('16520.00'), net_amount=Decimal('16520.00'),
        payment_method='BankTransfer', payment_status='Pending',
        outstanding_balance=Decimal('16520.00'),
        notes='Rental of Soft Serve Machine for 4 Days Gala Event'
    )
    db.session.add(inv_rent)
    db.session.flush()

    # Quotation
    quote = Quotation(
        tenant_id=tenant_id, company_id=company_id, customer_id=cust_cafe.id,
        quotation_number='QT-2026-015', quotation_date=now - timedelta(days=4),
        valid_until=now + timedelta(days=10), status='Sent',
        subtotal=Decimal('35000.00'), cgst_amount=Decimal('3150.00'),
        sgst_amount=Decimal('3150.00'), total_amount=Decimal('41300.00'),
        notes='Quote for supply of Sicilian Pistachio Gelato 5L Bulk Tubs'
    )
    db.session.add(quote)
    db.session.flush()

    quote_item = QuotationItem(
        tenant_id=tenant_id, quotation_id=quote.id, product_id=p_fg_pistachio_bulk.id,
        description='Sicilian Roasted Pistachio Gelato 5L Bulk Tub',
        quantity=20, rate=Decimal('1750.00'), gst_rate=Decimal('18.00'),
        cgst_amount=Decimal('3150.00'), sgst_amount=Decimal('3150.00'),
        total_amount=Decimal('41300.00')
    )
    db.session.add(quote_item)
    # Sales Orders (Pipeline)
    so1 = SalesOrder(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
        customer_id=cust_supermarket.id, order_number='SO-2026-001',
        order_date=now - timedelta(days=3), delivery_date=now + timedelta(days=2),
        status='Confirmed', subtotal=Decimal('49800.00'),
        cgst_amount=Decimal('4482.00'), sgst_amount=Decimal('4482.00'),
        total_amount=Decimal('58764.00'), notes='Supermarket weekend stock replenishment'
    )
    so2 = SalesOrder(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
        customer_id=cust_cafe.id, order_number='SO-2026-002',
        order_date=now - timedelta(days=1), delivery_date=now + timedelta(days=3),
        status='Confirmed', subtotal=Decimal('35000.00'),
        cgst_amount=Decimal('3150.00'), sgst_amount=Decimal('3150.00'),
        total_amount=Decimal('41300.00'), notes='Bulk Gelato tubs for cafe sundae menu'
    )
    db.session.add_all([so1, so2])
    db.session.flush()

    so1_item = SalesOrderItem(
        tenant_id=tenant_id, sales_order_id=so1.id, product_id=p_fg_vanilla.id,
        description='Royal Bourbon Vanilla Bean 500ml Tub',
        quantity=200, rate=Decimal('249.00'), gst_rate=Decimal('18.00'),
        cgst_amount=Decimal('4482.00'), sgst_amount=Decimal('4482.00'),
        total_amount=Decimal('58764.00')
    )
    so2_item = SalesOrderItem(
        tenant_id=tenant_id, sales_order_id=so2.id, product_id=p_fg_pistachio_bulk.id,
        description='Sicilian Roasted Pistachio Gelato 5L Bulk Tub',
        quantity=20, rate=Decimal('1750.00'), gst_rate=Decimal('18.00'),
        cgst_amount=Decimal('3150.00'), sgst_amount=Decimal('3150.00'),
        total_amount=Decimal('41300.00')
    )
    db.session.add_all([so1_item, so2_item])
    db.session.flush()

    print(f"[{tenant.name}] Seeding Supplier Purchase Orders...")

    # Supplier Purchase Orders
    po1 = PurchaseOrder(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
        supplier_id=supp_amul.id, po_number='PO-2026-AMUL-001',
        order_date=now - timedelta(days=6), expected_date=now - timedelta(days=5),
        status='Received', subtotal=Decimal('277000.00'),
        gst_amount=Decimal('13850.00'), total_amount=Decimal('290850.00'),
        notes='Bulk chilled milk tanker (2,400 L) & heavy dairy cream (650 Kg)'
    )
    po2 = PurchaseOrder(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
        supplier_id=supp_callebaut.id, po_number='PO-2026-CAL-002',
        order_date=now - timedelta(days=4), expected_date=now - timedelta(days=2),
        status='Confirmed', subtotal=Decimal('34500.00'),
        gst_amount=Decimal('6210.00'), total_amount=Decimal('40710.00'),
        notes='Belgian cocoa powder 70% (50 Kg) & dark choco inclusions (30 Kg)'
    )
    po3 = PurchaseOrder(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
        supplier_id=supp_pack.id, po_number='PO-2026-ECO-003',
        order_date=now - timedelta(days=2), expected_date=now + timedelta(days=3),
        status='Sent', subtotal=Decimal('32500.00'),
        gst_amount=Decimal('5850.00'), total_amount=Decimal('38350.00'),
        notes='5,000 Pcs 500ml Bio Paper Tubs & Embossed Lids'
    )
    db.session.add_all([po1, po2, po3])
    db.session.flush()

    poi1 = PurchaseItem(
        tenant_id=tenant_id, purchase_order_id=po1.id, product_id=p_milk.id,
        quantity=2400, rate=Decimal('45.00'), gst_rate=Decimal('5.00'),
        gst_amount=Decimal('5400.00'), total_amount=Decimal('113400.00')
    )
    poi2 = PurchaseItem(
        tenant_id=tenant_id, purchase_order_id=po1.id, product_id=p_cream.id,
        quantity=650, rate=Decimal('260.00'), gst_rate=Decimal('5.00'),
        gst_amount=Decimal('8450.00'), total_amount=Decimal('177450.00')
    )
    poi3 = PurchaseItem(
        tenant_id=tenant_id, purchase_order_id=po2.id, product_id=p_cocoa.id,
        quantity=50, rate=Decimal('480.00'), gst_rate=Decimal('18.00'),
        gst_amount=Decimal('4320.00'), total_amount=Decimal('28320.00')
    )
    poi4 = PurchaseItem(
        tenant_id=tenant_id, purchase_order_id=po3.id, product_id=p_tub500.id,
        quantity=5000, rate=Decimal('6.50'), gst_rate=Decimal('18.00'),
        gst_amount=Decimal('5850.00'), total_amount=Decimal('38350.00')
    )
    db.session.add_all([poi1, poi2, poi3, poi4])
    db.session.flush()

    # General Procurement & Purchases (Trading/Finished Parlour Supplies - non-raw material)
    po_gen1 = PurchaseOrder(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
        supplier_id=supp_pack.id, po_number='PO-2026-GEN-001',
        order_date=now - timedelta(days=5), expected_date=now - timedelta(days=3),
        status='Received', subtotal=Decimal('15800.00'),
        gst_amount=Decimal('1791.00'), total_amount=Decimal('17591.00'),
        notes='Crisp Artisan Waffle Cones (1,800 Cones) & Single Scoop Bio Cups (2,200 Cups)'
    )
    po_gen2 = PurchaseOrder(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
        supplier_id=supp_coldtech.id, po_number='PO-2026-GEN-002',
        order_date=now - timedelta(days=2), expected_date=now + timedelta(days=2),
        status='Confirmed', subtotal=Decimal('8500.00'),
        gst_amount=Decimal('1530.00'), total_amount=Decimal('10030.00'),
        notes='Parlour Display Freezer LED Strip Spares & Chiller Temperature Gauges'
    )
    db.session.add_all([po_gen1, po_gen2])
    db.session.flush()

    poi_gen1 = PurchaseItem(
        tenant_id=tenant_id, purchase_order_id=po_gen1.id, product_id=p_waffle_cone.id,
        quantity=1800, rate=Decimal('4.50'), gst_rate=Decimal('5.00'),
        gst_amount=Decimal('405.00'), total_amount=Decimal('8505.00')
    )
    poi_gen2 = PurchaseItem(
        tenant_id=tenant_id, purchase_order_id=po_gen1.id, product_id=p_cup100.id,
        quantity=2200, rate=Decimal('3.50'), gst_rate=Decimal('18.00'),
        gst_amount=Decimal('1386.00'), total_amount=Decimal('9086.00')
    )
    db.session.add_all([poi_gen1, poi_gen2])
    db.session.flush()

    # Goods Receipt Note (GRN) for General Purchase
    grn_gen = GoodsReceiptNote(
        tenant_id=tenant_id, company_id=company_id, warehouse_id=wh_parlour_dip.id,
        purchase_order_id=po_gen1.id, grn_number='GRN-2026-GEN-001',
        received_date=now - timedelta(days=3), supplier_invoice_no='INV-ECO-9942',
        supplier_invoice_date=now - timedelta(days=3), vehicle_no='KA-03-TR-8811',
        gate_entry_no='GE-2026-089', status='approved',
        notes='Received in full condition at Indiranagar Parlour dry stores'
    )
    db.session.add(grn_gen)
    db.session.flush()

    grni1 = GRNItem(
        tenant_id=tenant_id, grn_id=grn_gen.id, purchase_item_id=poi_gen1.id,
        product_id=p_waffle_cone.id, ordered_quantity=1800, received_quantity=1800,
        accepted_quantity=1800, rejected_quantity=0
    )
    grni2 = GRNItem(
        tenant_id=tenant_id, grn_id=grn_gen.id, purchase_item_id=poi_gen2.id,
        product_id=p_cup100.id, ordered_quantity=2200, received_quantity=2200,
        accepted_quantity=2200, rejected_quantity=0
    )
    db.session.add_all([grni1, grni2])
    db.session.flush()

    # Purchase Return (Damaged carton debit note)
    pret1 = PurchaseReturn(
        tenant_id=tenant_id, company_id=company_id, supplier_id=supp_pack.id,
        purchase_order_id=po_gen1.id, return_number='PR-2026-ECO-001',
        return_date=now - timedelta(days=2),
        reason='Crushed waffle cone carton discovered during unloading inspection',
        subtotal=Decimal('225.00'), gst_amount=Decimal('11.25'),
        total_amount=Decimal('236.25'), status='Completed'
    )
    db.session.add(pret1)
    db.session.flush()

    preti1 = PurchaseReturnItem(
        tenant_id=tenant_id, purchase_return_id=pret1.id, product_id=p_waffle_cone.id,
        quantity=50, rate=Decimal('4.50'), gst_rate=Decimal('5.00'),
        gst_amount=Decimal('11.25'), total_amount=Decimal('236.25')
    )
    db.session.add(preti1)
    db.session.flush()

    # Team Users (Roles & Permissions)
    from werkzeug.security import generate_password_hash
    pwd_hash = generate_password_hash('demo123')
    team_users = [
        {'name': 'Ravi Kumar', 'email': 'ravi.plant@smartgonext.com', 'phone': '9876543210', 'role_name': 'Plant Manager'},
        {'name': 'Anita Sharma', 'email': 'anita.accounts@smartgonext.com', 'phone': '9876543211', 'role_name': 'Accountant'},
        {'name': 'Priya Mehta', 'email': 'priya.pos@smartgonext.com', 'phone': '9876543212', 'role_name': 'Cashier'}
    ]
    for tu in team_users:
        if not User.query.filter_by(tenant_id=tenant_id, email=tu['email']).first():
            role = Role.query.filter_by(tenant_id=tenant_id, name=tu['role_name']).first()
            u = User(
                tenant_id=tenant_id, company_id=company_id, branch_id=branch.id,
                name=tu['name'], email=tu['email'], phone=tu['phone'],
                password_hash=pwd_hash, role_id=role.id if role else None,
                is_active=True
            )
            db.session.add(u)
    db.session.flush()

    print(f"[{tenant.name}] Seeding Employees & HR...")

    # 23. HR Employees
    employees = [
        Employee(
            tenant_id=tenant_id, company_id=company_id, employee_code='EMP-2024-001',
            name='Marco Rossi', phone='9988772201', email='marco@frostydelights.com',
            department='Operations', designation='Master Gelatiere / Head Creamery Chef',
            basic_salary=Decimal('90000.00'), gross_salary=Decimal('115000.00'),
            date_of_joining=date(2023, 1, 15), is_active=True
        ),
        Employee(
            tenant_id=tenant_id, company_id=company_id, employee_code='EMP-2024-002',
            name='Dr. Shalini Swaminathan', phone='9988772202', email='shalini@frostydelights.com',
            department='Quality & R&D', designation='Dairy Chemist & Food Safety Officer',
            basic_salary=Decimal('75000.00'), gross_salary=Decimal('95000.00'),
            date_of_joining=date(2023, 4, 1), is_active=True
        ),
        Employee(
            tenant_id=tenant_id, company_id=company_id, employee_code='EMP-2024-003',
            name='Sunil Deshmukh', phone='9988772203', email='sunil@frostydelights.com',
            department='Maintenance', designation='Cold Chain & Refrigeration Engineer',
            basic_salary=Decimal('55000.00'), gross_salary=Decimal('70000.00'),
            date_of_joining=date(2023, 6, 10), is_active=True
        ),
        Employee(
            tenant_id=tenant_id, company_id=company_id, employee_code='EMP-2024-004',
            name='Ananya Sen', phone='9988772204', email='ananya@frostydelights.com',
            department='Retail Sales', designation='Scoop Parlour Manager & POS Lead',
            basic_salary=Decimal('45000.00'), gross_salary=Decimal('58000.00'),
            date_of_joining=date(2023, 9, 20), is_active=True
        ),
        Employee(
            tenant_id=tenant_id, company_id=company_id, employee_code='EMP-2024-005',
            name='Vikram Rathore', phone='9988772205', email='vikram@frostydelights.com',
            department='Logistics', designation='Reefer Cold-Truck Fleet Driver',
            basic_salary=Decimal('32000.00'), gross_salary=Decimal('42000.00'),
            date_of_joining=date(2024, 2, 1), is_active=True
        ),
        Employee(
            tenant_id=tenant_id, company_id=company_id, employee_code='EMP-2024-006',
            name='Pooja Hegde', phone='9988772206', email='pooja@frostydelights.com',
            department='Finance', designation='Accounts & Inventory Controller',
            basic_salary=Decimal('50000.00'), gross_salary=Decimal('65000.00'),
            date_of_joining=date(2024, 3, 15), is_active=True
        ),
    ]
    db.session.add_all(employees)
    db.session.flush()

    print(f"[{tenant.name}] Seeding Ice Cream Chart of Accounts (Finance)...")

    # 24. Chart of Accounts tailored for Dairy & Ice Cream
    coa_list = [
        {"account_name": "Cash Drawer - Scoop Parlour", "account_code": "1001", "account_type": "Asset", "description": "Cash register at Indiranagar parlour"},
        {"account_name": "HDFC Current Account - Operations", "account_code": "1002", "account_type": "Asset", "description": "Primary operating bank account"},
        {"account_name": "Accounts Receivable (B2B & Supermarkets)", "account_code": "1003", "account_type": "Asset", "description": "Amounts owed by wholesale clients"},
        {"account_name": "Finished Ice Cream Stock (-25°C Deep Freeze)", "account_code": "1004", "account_type": "Asset", "description": "Valuation of commercial tubs ready for sale"},
        {"account_name": "Dairy & Raw Ingredients Inventory (+4°C)", "account_code": "1005", "account_type": "Asset", "description": "Milk, cream, sugar, cocoa and purees"},
        {"account_name": "Packaging & Disposables Inventory", "account_code": "1006", "account_type": "Asset", "description": "Paper tubs, waffle cones and cartons"},
        {"account_name": "Freezer Machinery & Cold Storage Assets", "account_code": "1007", "account_type": "Asset", "description": "Continuous churners, pasteurizers, and cold rooms"},
        {"account_name": "Refrigerated Reefer Fleet Vehicles", "account_code": "1008", "account_type": "Asset", "description": "Cold chain delivery transport vehicles"},
        {"account_name": "Accounts Payable (Dairy & Material Suppliers)", "account_code": "2001", "account_type": "Liability", "description": "Outstanding payables to Amul, Callebaut, etc."},
        {"account_name": "GST Output Payable (18% Ice Cream)", "account_code": "2002", "account_type": "Liability", "description": "GST collected on ice cream billing"},
        {"account_name": "GST Input Tax Credit Receivable", "account_code": "2003", "account_type": "Liability", "description": "Input tax credit on dairy purchases"},
        {"account_name": "Ice Cream Wholesale Sales Revenue", "account_code": "3001", "account_type": "Income", "description": "B2B supermarket and cafe distribution turnover"},
        {"account_name": "Scoop Parlour Retail POS Revenue", "account_code": "3002", "account_type": "Income", "description": "Direct parlour scoop and sundae billing"},
        {"account_name": "Ice Cream Dispenser Rental Revenue", "account_code": "3003", "account_type": "Income", "description": "Event and banquet soft serve rentals"},
        {"account_name": "Raw Milk & Heavy Dairy Cream Purchases", "account_code": "4001", "account_type": "Expense", "description": "Direct dairy ingredient procurement costs"},
        {"account_name": "Flavors, Cocoa & Fruit Puree Purchases", "account_code": "4002", "account_type": "Expense", "description": "Specialty chocolate, vanilla, and mango costs"},
        {"account_name": "Cold Storage Power & Industrial Electricity", "account_code": "4003", "account_type": "Expense", "description": "Continuous deep freezer electric utility"},
        {"account_name": "Cold-Chain Logistics & Dry Ice Freight", "account_code": "4004", "account_type": "Expense", "description": "Reefer diesel, dry ice, and delivery expenses"},
        {"account_name": "Creamery Production & Kitchen Wages", "account_code": "4005", "account_type": "Expense", "description": "Salaries for gelatieres and production crew"},
        {"account_name": "Freezer Servicing & Freon Gas Maintenance", "account_code": "4006", "account_type": "Expense", "description": "Refrigeration preventive maintenance and repairs"},
    ]
    for item in coa_list:
        existing = ChartOfAccount.query.filter_by(tenant_id=tenant_id, account_code=item['account_code']).first()
        if not existing:
            coa = ChartOfAccount(tenant_id=tenant_id, company_id=company_id, **item, is_active=True)
            db.session.add(coa)
    db.session.flush()

    print(f"[{tenant.name}] Seeding Projects, Documents, and Repair Job Cards...")

    # 25. Projects
    p1 = Project(
        tenant_id=tenant_id, company_id=company_id,
        name='Solar-Powered Zero-Emission Cold Storage Plant',
        description='Installing a 100kW rooftop solar grid to power -25°C blast freezers',
        start_date=today - timedelta(days=30), end_date=today + timedelta(days=120),
        budget=Decimal('4500000.00'), status='InProgress', priority='High'
    )
    p2 = Project(
        tenant_id=tenant_id, company_id=company_id,
        name='Summer 2026: Exotic Alphonso & Berry Swirl Launch',
        description='Product formulation, marketing, and pan-city parlour rollout',
        start_date=today - timedelta(days=15), end_date=today + timedelta(days=45),
        budget=Decimal('650000.00'), status='InProgress', priority='Medium'
    )
    db.session.add_all([p1, p2])
    db.session.flush()

    # 26. Documents
    docs = [
        Document(
            tenant_id=tenant_id, company_id=company_id,
            title='FSSAI Central Food Safety License - Ice Cream & Dairy',
            file_type='PDF', folder='Compliance',
            file_name='fssai-dairy-license-2026.pdf',
            file_url='/uploads/fssai-dairy-license-2026.pdf', is_public=True
        ),
        Document(
            tenant_id=tenant_id, company_id=company_id,
            title='Cold Chain Temperature Control SOP (-18°C Mandatory)',
            file_type='PDF', folder='SOPs',
            file_name='cold-chain-sop-v2.pdf',
            file_url='/uploads/cold-chain-sop-v2.pdf', is_public=False
        ),
        Document(
            tenant_id=tenant_id, company_id=company_id,
            title='Bourbon Vanilla & Belgian Chocolate Master Formulation Specs',
            file_type='PDF', folder='Formulations',
            file_name='master-ice-cream-recipes-2026.pdf',
            file_url='/uploads/master-ice-cream-recipes-2026.pdf', is_public=False
        ),
        Document(
            tenant_id=tenant_id, company_id=company_id,
            title='Amul Organic Farm Milk Microbiological Certificate',
            file_type='PDF', folder='LabReports',
            file_name='amul-milk-qc-cert.pdf',
            file_url='/uploads/amul-milk-qc-cert.pdf', is_public=False
        ),
    ]
    db.session.add_all(docs)
    db.session.flush()

    # 27. Repair Job Card
    repair = RepairJobCard(
        tenant_id=tenant_id, company_id=company_id, customer_id=cust_banquet.id,
        job_card_number='REP-2026-008', item_description=eq_softserve.name,
        serial_no=eq_softserve.serial_number, model_no=eq_softserve.model_number,
        reported_issues='Compressor refrigerant valve periodic seal replacement and flow test',
        diagnostic_notes='Valve seal replaced, gas pressure normal at 45 PSI',
        status='InProgress', estimated_cost=Decimal('2500.00'), actual_cost=Decimal('2200.00'),
        assigned_technician_id=user.id, received_date=now - timedelta(days=2),
        customer_notes='Need delivery by Friday for banquet',
        internal_notes='Parts sourced from ColdTech Refrigeration'
    )
    db.session.add(repair)
    db.session.flush()

    # 28. Persist Effective UI Config for Ice Cream & Dairy Manufacturing
    seed_business_type_config(tenant_id, company_id, 'Ice Cream Manufacturing', commit=False)
    seed_default_templates(tenant_id, company_id, commit=False)

    db.session.commit()
    print(f"[{tenant.name}] SUCCESS: Complete Ice Cream Creamery & Manufacturing demo dataset seeded!")
