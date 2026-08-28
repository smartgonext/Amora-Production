# Universal Manufacturing Engine Implementation Plan

This document outlines the architecture, database schema, API designs, and frontend requirements for building a **Universal Manufacturing Engine** in the Multi-Tenant SaaS ERP. 

Instead of building a fixed industry module (like Ice Cream), this engine acts as a **generic, configurable core** that adapts to different manufacturing types (Process, Discrete, Textile, Assembly) and models (Make-to-Stock, Make-to-Order, Job-Work) based on tenant industry templates.

---

## 🏗️ 1. Core Architecture & Industry Templates

When a tenant registers, their selected **Industry Sub-Type** configures the features enabled within the manufacturing module:

```
                            Tenant Profile
                                  │
                       Industry Sub-Type Configuration
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      ▼                           ▼                           ▼
[Process Mfg]              [Discrete Mfg]             [Textile Mfg]
(Ice Cream, Pharma)        (Furniture, Machinery)     (Garments, Fabrics)
  ├── Recipe/BOM             ├── Multi-level BOM        ├── Size/Color Matrix
  ├── Batch Production       ├── Routing/Operations     ├── Cutting/Stitching
  └── Expiry & QC            └── Serial Tracking        └── WIP/Job-Work
```

### Industry Feature Matrix

| Feature | Process (Ice Cream/Pharma) | Discrete (Furniture/Electronics) | Textile (Garments) | Assembly (Machinery) |
| :--- | :--- | :--- | :--- | :--- |
| **BOM Type** | Recipe / Yield Based | Multi-level (Sub-assemblies) | Variant Matrix (Size/Color) | Component List |
| **Tracking** | Batch No + Expiry Date | Serial Number + Warranty | Lot No + Variant Tag | Serial Number |
| **Operations** | Direct Batch Mixing | Multi-stage Routing | Cutting, Stitching, Packing | Station-wise Assembly |
| **Subcontracting**| Rare | High (Specialized parts) | Very High (Job work) | Medium |

---

## 🗄️ 2. Database Schema & Models

To support multi-level BOMs, routing, costs, suppliers, raw material procurement, and multiple workflows:

### 2.1 Configuration & Meta
* **`tenant_manufacturing_configs`**
  - `id`, `tenant_id`, `mfg_type` (`process`, `discrete`, `textile`, `assembly`), `enabled_features` (JSON list of features like: `routing`, `serial_tracking`, `expiry_tracking`, `subcontracting`, `job_work`, `mrp_auto_po`).

### 2.2 Bill of Materials (BOM) & Routing
* **`bom_headers`**
  - `id`, `tenant_id`, `product_id` (Finished/Semi-finished item), `version` (e.g. `V1.0`), `revision_no`, `name`, `status` (`active`, `draft`, `deprecated`), `effective_start_date`, `effective_end_date`, `standard_cost`, `overhead_cost`, `total_setup_time_mins`.
* **`bom_items`**
  - `id`, `bom_id`, `material_item_id` (Raw/Semi-finished component), `qty_required`, `uom`, `waste_pct`, `is_alternate` (Boolean), `parent_bom_item_id` (For Multi-level BOM hierarchy).
* **`bom_byproducts`** *(Co-products, Scrap, and By-products)*
  - `id`, `bom_id`, `item_id`, `type` (`co_product`, `by_product`, `scrap`), `qty_expected`, `uom`.
* **`work_centers` & `machines`**
  - `id`, `tenant_id`, `name`, `hourly_labor_rate`, `hourly_machine_rate`, `capacity_limit`.
* **`bom_routing_operations`**
  - `id`, `bom_id`, `operation_sequence` (Int: 10, 20, 30), `operation_name` (e.g. Cutting, Mixing, Welding), `work_center_id`, `machine_id`, `setup_time_mins`, `processing_time_per_unit_mins`, `labor_hours_per_unit`.

### 2.3 Raw Material Procurement & Supplier Integration (MRP)
* **`supplier_item_mappings`**
  - `id`, `tenant_id`, `supplier_id`, `item_id` (Raw material), `supplier_part_number`, `unit_price`, `lead_time_days`, `min_order_qty` (MOQ), `is_preferred_supplier`.
* **`material_requirements_plans` (MRP Runs)**
  - `id`, `tenant_id`, `work_order_id`, `raw_material_id`, `required_qty`, `current_stock_qty`, `shortage_qty`, `suggested_po_qty`, `supplier_id`, `status` (`draft`, `po_generated`).

### 2.4 Production Control (Work Orders & WIP)
* **`work_orders`**
  - `id`, `tenant_id`, `company_id`, `sales_order_id` (Null if Make-to-Stock, populated if Make-to-Order), `bom_id`, `wo_number` (Unique sequence), `planned_qty`, `produced_qty`, `start_date`, `due_date`, `status` (`planned`, `released`, `wip`, `qc_pending`, `completed`, `cancelled`).
* **`work_order_operations`** *(Tracks completion state per stage)*
  - `id`, `work_order_id`, `operation_sequence`, `operation_name`, `work_center_id`, `status` (`pending`, `in_progress`, `completed`), `started_at`, `completed_at`, `actual_setup_time`, `actual_run_time`, `operator_user_id`.
* **`production_material_issues`** *(Tracks issue of raw materials to WIP)*
  - `id`, `work_order_id`, `item_id`, `warehouse_id`, `qty_issued`, `qty_returned`, `batch_no`, `serial_no`.

### 2.5 Quality Control & Job Work
* **`quality_inspections`**
  - `id`, `tenant_id`, `reference_type` (`work_order`, `purchase_receipt`), `reference_id`, `passed_qty`, `failed_qty`, `qc_status` (`passed`, `failed`, `conditional`), `inspected_by`, `inspection_date`, `check_parameters` (JSON checklist).
* **`job_work_orders`** *(Subcontracting)*
  - `id`, `tenant_id`, `work_order_id`, `vendor_id` (Job worker), `issue_challan_no`, `materials_sent` (JSON), `expected_return_date`, `actual_return_date`, `service_cost`, `status` (`sent`, `partially_received`, `completed`).

---

## ⚙️ 3. Execution Phase Plan

### Phase 1: Database Migration & Configuration Core
* [x] **Step 1.1:** Add tables `tenant_manufacturing_configs`, `bom_headers`, `bom_items`, `bom_byproducts`, `work_centers`, `bom_routing_operations`, `supplier_item_mappings`, `material_requirements_plans` to `backend/app/models/manufacturing.py`.
* [x] **Step 1.2:** Add tables `work_orders`, `work_order_operations`, `production_material_issues`, `quality_inspections`, `job_work_orders` to `backend/app/models/manufacturing.py`.
* [x] **Step 1.3:** Register models in `backend/app/models/__init__.py` and execute database initialization via `db.create_all()`.

### Phase 2: Unified Backend API (`app/routes/manufacturing.py`)
* [x] **Step 2.1:** Implement **BOM & Versioning Service** (Supports Multi-level BOM hierarchy, operations routing, and alternate components).
* [x] **Step 2.2:** Implement **Raw Material & Supplier Purchase Engine (MRP)**:
  * Check stock availability against Work Orders.
  * Auto-calculate raw material shortages.
  * 1-Click Generate Purchase Orders to preferred suppliers based on lead times and MOQs.
* [x] **Step 2.3:** Implement **Work Order Lifecycle Engine**:
  * Create Work Order (Make-to-Stock / Make-to-Order).
  * Release to WIP (Deducts/reserves raw materials, generates routing sheet).
  * Complete Operation (Tracks actual time, labor, and machine costs per step).
  * Final Production Receipt (Adds finished goods to stock with auto-batching or serial number generation, updates actual costing ledger).
* [x] **Step 2.4:** Implement **QC & Subcontracting Services**.

### Phase 3: Adaptive Frontend UI (`frontend/src/pages/manufacturing/`)
* [x] **Step 3.1: BOM & Routing Workspace (`BomDesigner.jsx`):**
  - Tree-view for multi-level BOMs.
  - Sequenced routing grid to map operations to work centers and machines.
  - Co-products, scrap, and cost calculation preview.
* [x] **Step 3.2: Raw Material Shortage & Auto-PO Generator (`MrpPlanningPage.jsx`):**
  - View raw material stock levels vs planned Work Orders.
  - Supplier lead times & minimum order quantity display.
  - One-click auto-create Purchase Orders to Suppliers.
* [x] **Step 3.3: Production Gantt & Work Order Board (`WorkOrderBoard.jsx`):**
  - Dashboard for Release, WIP, QC, and Complete stages.
  - Multi-stage routing operation tracking.
* [x] **Step 3.4: Job Work & QC Checklists (`JobWorkPage.jsx`, `QcInspectionPage.jsx`):**
  - Outward/Inward challans for subcontracting vendor assignments.
  - Custom parameter checklist popup for quality officers.

### Phase 4: Dynamic Navbar & Registration Configuration
* [x] **Step 4.1: Adaptive Navbar Configuration (`Navbar.jsx`):**
  - Navbar links automatically rename or hide based on the config.
* [x] **Step 4.2: Registration Engine Update (`RegisterPage.jsx`):**
  - Seed custom `tenant_manufacturing_configs` on registration depending on industry selection.

### Phase 5: End-to-End Testing & Verification
* [x] **Step 5.1:** Write automated API tests in `backend/tests/test_manufacturing.py` and `test_manufacturing_phase2.py` covering BOM creation, MRP auto-PO generation, Work Order release, WIP operation completion, and final production stock update.
* [x] **Step 5.2:** Validate full browser UI workflow for both Process (Ice Cream) and Discrete (Furniture/Electronics) manufacturing tenant accounts.

---

## 📌 Status Notes: 100% COMPLETE 🎉

- All database models in `backend/app/models/manufacturing.py` are created and registered.
- All backend REST APIs in `backend/app/routes/manufacturing.py` and services in `backend/app/services/manufacturing_service.py` are live.
- All frontend UI pages in `frontend/src/pages/manufacturing/` (`BomDesigner.jsx`, `MrpPlanningPage.jsx`, `WorkOrderBoard.jsx`, `JobWorkPage.jsx`, `QcInspectionPage.jsx`) are implemented and mapped in `App.jsx`.
- Dynamic Navbar & Registration integration in `Navbar.jsx` and `RegisterPage.jsx` are complete.
- Automated tests in `test_manufacturing.py` and `test_manufacturing_phase2.py` pass cleanly (100% PASS).
- Completed a comprehensive audit of all CRUD payload integrations:
  - Fixed data type casting for numeric input values (e.g. `standard_cost`, `overhead_cost`, `qty_required`, `waste_pct`) between the frontend form submissions and backend services to prevent MySQL/SQLAlchemy insertion crashes.
  - Seeded default Work Centers ("Assembly Line 1", "Fabrication Shop") and Machines ("CNC Cutting Machine", "Rotary Assembly Jig") to ensure the BOM Routing Designer is fully functional out-of-the-box.
