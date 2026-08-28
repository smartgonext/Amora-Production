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

To support multi-level BOMs, routing, costs, and multiple workflows, we will implement the following database structure:

### 2.1 Configuration & Meta
* **`tenant_manufacturing_configs`**
  - `id`, `tenant_id`, `mfg_type` (`process`, `discrete`, `textile`, `assembly`), `enabled_features` (JSON list of features like: `routing`, `serial_tracking`, `expiry_tracking`, `subcontracting`, `job_work`).

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

### 2.3 Production Control (Work Orders & WIP)
* **`work_orders`**
  - `id`, `tenant_id`, `company_id`, `sales_order_id` (Null if Make-to-Stock, populated if Make-to-Order), `bom_id`, `wo_number` (Unique sequence), `planned_qty`, `produced_qty`, `start_date`, `due_date`, `status` (`planned`, `released`, `wip`, `qc_pending`, `completed`, `cancelled`).
* **`work_order_operations`** *(Tracks completion state per stage)*
  - `id`, `work_order_id`, `operation_sequence`, `operation_name`, `work_center_id`, `status` (`pending`, `in_progress`, `completed`), `started_at`, `completed_at`, `actual_setup_time`, `actual_run_time`, `operator_user_id`.
* **`production_material_issues`** *(Tracks issue of raw materials to WIP)*
  - `id`, `work_order_id`, `item_id`, `warehouse_id`, `qty_issued`, `qty_returned`, `batch_no`, `serial_no`.

### 2.4 Quality Control & Job Work
* **`quality_inspections`**
  - `id`, `tenant_id`, `reference_type` (`work_order`, `purchase_receipt`), `reference_id`, `passed_qty`, `failed_qty`, `qc_status` (`passed`, `failed`, `conditional`), `inspected_by`, `inspection_date`, `check_parameters` (JSON checklist).
* **`job_work_orders`** *(Subcontracting)*
  - `id`, `tenant_id`, `work_order_id`, `vendor_id` (Job worker), `issue_challan_no`, `materials_sent` (JSON), `expected_return_date`, `actual_return_date`, `service_cost`, `status` (`sent`, `partially_received`, `completed`).

---

## ⚙️ 3. Execution Phase Plan

### Phase 1: Database Migration & Configuration Core
* [ ] **Step 1.1:** Add tables `tenant_manufacturing_configs`, `bom_headers`, `bom_items`, `bom_byproducts`, `work_centers`, `bom_routing_operations` to backend models.
* [ ] **Step 1.2:** Add tables `work_orders`, `work_order_operations`, `production_material_issues`, `quality_inspections`, `job_work_orders` to backend models.
* [ ] **Step 1.3:** Run database migrations.

### Phase 2: Unified Backend API (`app/routes/manufacturing.py`)
* [ ] **Step 2.1:** Implement **BOM & Versioning Service** (Supports Multi-level BOM hierarchy, operations routing, and alternate components).
* [ ] **Step 2.2:** Implement **Work Order Lifecycle Engine**:
  * Create Work Order (Make-to-Stock / Make-to-Order).
  * Release to WIP (Deducts/reserves raw materials, generates routing sheet).
  * Complete Operation (Tracks actual time, labor, and machine costs per step).
  * Final Production Receipt (Adds finished goods to stock with auto-batching or serial number generation, updates actual costing ledger).
* [ ] **Step 2.3:** Implement **QC & Subcontracting Services**.

### Phase 3: Adaptive Frontend UI (`frontend/src/pages/manufacturing/`)
* [ ] **Step 3.1: BOM & Routing Workspace (`BomDesigner.jsx`):**
  - Tree-view for multi-level BOMs.
  - Sequenced routing grid to map operations to work centers and machines.
  - Co-products, scrap, and cost calculation preview.
* [ ] **Step 3.2: Production Gantt & Work Order Board (`WorkOrderBoard.jsx`):**
  - Dashboard for Release, WIP, QC, and Complete stages.
  - Multi-stage routing operation tracking (Operators can complete step 10 -> step 20 -> step 30).
* [ ] **Step 3.3: Job Work & QC Checklists (`JobWorkPage.jsx`, `QcInspectionPage.jsx`):**
  - Outward/Inward challans for subcontracting vendor assignments.
  - Custom parameter checklist popup for quality officers.

### Phase 4: Dynamic Navbar & Registration Configuration
* [ ] **Step 4.1: Adaptive Navbar Configuration (`Navbar.jsx`):**
  - Navbar links automatically rename or hide based on the config. (e.g. mixing/batch screens for process, routing/operation tracking for discrete, cutting/stitching status for textiles).
* [ ] **Step 4.2: Registration Engine Update (`RegisterPage.jsx`):**
  - Seed custom `tenant_manufacturing_configs` on registration depending on industry selection.

---

## 📌 Phase 1 Checklist (Immediate Next Steps)

- [ ] Define the models in `backend/app/models/manufacturing.py`.
- [ ] Implement DB migrations.
- [ ] Expose registration config integration.
