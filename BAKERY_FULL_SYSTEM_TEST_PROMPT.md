# 🥖 SMARTGONEXT ERP — COMPREHENSIVE BAKERY PRODUCTION FULL-SYSTEM TEST & AUDIT MASTER PROMPT
> **Target System**: SmartGoNext Universal ERP (Bakery Vertical)  
> **Target Tenant**: `Amora Bakery & Patisserie` (Subdomain: `amora`)  
> **Auth Credentials**:  
> • **Bakery Admin**: `admin@amorabakery.com` / `Amora@123`  
> • **Platform Superadmin**: `superadmin@smartgonext.com` / `SuperAdmin@123`  
> • **Local Endpoints**: Frontend `http://localhost:3000` | Backend `http://localhost:5000`

---

## 🎯 AGENT ROLE & DIRECTIVE
You are acting as a **Principal QA Automation Engineer & Senior Full-Stack ERP Developer**. Your mission is to systematically test, audit, and auto-fix all **26 core pages** of the Bakery ERP across **Phase 1** and **Phase 2**.

For **EVERY SINGLE PAGE**, you must:
1. **Verify Complete CRUD**: Test **Create**, **Read / List**, **Update / Edit**, and **Delete / Soft-Delete**.
2. **Inspect UI Components**: Verify action button placement (Edit/Delete icons, Modals, Dropdowns), form validation messages, loading spinners, and error alerts.
3. **Verify Business Logic & Data Sync**: Confirm calculations (GST tax, discounts, batch quantities, baker's % ratios, stock ledger deductions, COGS ledger entries). Ensure no orphaned data or silent failures.
4. **Identify & Fix Bugs On-The-Fly**: If any endpoint throws 4xx/5xx, any modal fails to save, any table fails to sync, or any UI element is misaligned, **immediately locate the file in backend/frontend, fix the code, test it, and verify resolution**.

---

# 📦 PHASE 1: CORE COMMERCIAL, INVENTORY & FINANCIAL SUITE (PAGES 1 TO 12)

### Page 1: Dashboard (`/dashboard`)
- [ ] **Load & Render**: Verify executive metric cards (Today's Sales, Low Stock Alerts, Active Bake Orders, Receivables).
- [ ] **Data Sync**: Check if the cards reflect live records from Amora Bakery (not hardcoded dummy numbers).
- [ ] **Tenant Header**: Verify current active company shows `Amora Bakery & Patisserie`.
- [ ] **Quick Action Links**: Test quick navigation buttons (New Bill, New Work Order, Add Product).
- [ ] **Auto-Fix Mandate**: If any widget shows `NaN`, empty state crashes, or fails to fetch, fix the aggregated endpoint in `backend/app/routes/reports.py` or `frontend/src/pages/dashboard/DashboardPage.jsx`.

### Page 2: Products & Services (`/products`)
- [ ] **CRUD Operations**:
  - **Create**: Add a test finished product (e.g., `Brioche Buns 4-pack`, Unit: `pack`, HSN: `1905`, Price: `₹120`, Shelf Life: `3 days`, Allergens: `["Gluten", "Dairy", "Egg"]`).
  - **Read**: Verify product list filters by Category (`Artisan Breads`, `Cakes & Patisserie`).
  - **Update**: Edit selling price and best-before days. Verify modal reloads updated values.
  - **Delete**: Soft-delete a product. Verify `is_deleted = True` and item disappears from active list.
- [ ] **Bakery Attributes**: Verify `shelf_life_days`, `best_before_days`, `allergens`, and `is_fresh` toggle work.
- [ ] **Auto-Fix Mandate**: Ensure barcode/SKU generator and image upload fields do not fail if omitted.

### Page 3: Customers (`/customers`)
- [ ] **CRUD Operations**:
  - **Create**: Add B2B wholesale client (e.g., `The Roastery Cafe`, GSTIN, Credit Limit: `₹25,000`, Payment Terms: `Net 15`).
  - **Read**: Verify search by customer name and phone number works.
  - **Update**: Edit phone number and delivery address. Verify table updates instantly.
  - **Delete**: Test soft-delete; ensure customer with open ledger entries cannot be hard deleted.
- [ ] **Customer Ledger**: Verify outstanding balance calculations match invoiced amounts.

### Page 4: Suppliers (`/suppliers`)
- [ ] **CRUD Operations**:
  - **Create**: Add ingredient supplier (e.g., `Southern Grain & Flour Mills`, Contact Person, Payment terms: `Net 30`).
  - **Read**: Verify supplier directory renders active contact details.
  - **Update**: Edit bank account details and contact phone.
  - **Delete**: Test soft-delete; verify prompt confirms deletion safely.

### Page 5: Sales (`/sales`)
- [ ] **Workflow Lifecycle**:
  - **Quotation**: Create quotation for 50 Sourdough Loaves to B2B customer. Convert Quotation $\rightarrow$ Sales Order.
  - **Sales Order**: Confirm Sales Order; verify status updates to `Confirmed`.
  - **Tax Invoice**: Convert Sales Order $\rightarrow$ GST Tax Invoice. Verify CGST/SGST 5% auto-calculated.
- [ ] **Invoice PDF / Print**: Test invoice preview and download; ensure company header and GSTIN render.
- [ ] **Stock Sync**: Verify creating invoice updates inventory balance or links to dispatch.

### Page 6: Purchases (`/purchases`)
- [ ] **Procurement Lifecycle**:
  - **Create PO**: Create Purchase Order for 500kg `French T55 Flour` from `Royal Flour Mills`.
  - **PO Approval**: Approve Purchase Order; verify status updates to `Ordered`.
  - **Goods Receipt Note (GRN)**: Receive items against PO into `Central Pantry & Raw Material Store`.
  - **Stock Ledger Sync**: Verify purchase price updates product ledger and increments stock in real time.

### Page 7: Inventory & Multi-Warehouse (`/inventory`)
- [ ] **Warehouse Navigation**: Verify all 4 bakery storage zones exist:
  1. `Central Pantry & Raw Material Store`
  2. `Cold Chiller & Dairy Room (2°C - 4°C)`
  3. `Bakehouse Floor & WIP`
  4. `Front Display & Retail Counter`
- [ ] **Batch & FEFO Tracking**: Create/inspect batch record with Manufacturing Date and Expiry Date.
- [ ] **Stock Transfer**: Transfer 50kg flour from Central Store $\rightarrow$ Bakehouse Floor WIP. Check dual ledger balance.
- [ ] **Stock Adjustment**: Test physical count reconciliation (waste/damage adjustments).

### Page 8: HR / Payroll (`/hr`)
- [ ] **CRUD Operations**:
  - **Create**: Add bakery employee (e.g., `Baking Assistant`, Shift: `Morning 05:00 - 13:00`, Base Salary).
  - **Read**: Verify employee roster, designation, and contact info render.
  - **Update**: Edit designation or salary structure.
  - **Delete**: Test deactivating an employee (`is_active = False`).
- [ ] **Shift & Attendance**: Verify shift assignment binds to the user.

### Page 9: Documents (`/documents`)
- [ ] **File Lifecycle**:
  - **Upload**: Upload bakery FSSAI license / food safety compliance PDF or image.
  - **Category Tagging**: Tag document as `Compliance`, `Supplier Invoice`, or `Recipe Note`.
  - **Download / Preview**: Test opening and viewing uploaded files.
  - **Delete**: Remove uploaded file; verify storage is freed.

### Page 10: Billing / Point of Sale (`/billing`)
- [ ] **Rapid POS Terminal Operations**:
  - **Catalog Grid**: Verify quick buttons for finished bakery goods (Croissant, Sourdough, Cake slice).
  - **Cart Calculation**: Add multiple items; verify subtotal, GST (5%), discount %, and round-off.
  - **Customer Selection**: Toggle between `Walk-in Retail` and registered B2B client.
  - **Checkout / Tender**: Pay via `Cash` / `UPI` / `Split Payment`.
  - **Receipt Generation**: Verify receipt prints thermal 3-inch slip format with batch barcode.
  - **Real-Time Stock Depletion**: Confirm front display counter stock decrements immediately upon billing.

### Page 11: Finance & Accounting (`/finance`)
- [ ] **Chart of Accounts (COA)**: Verify tree structure (Assets, Liabilities, Equity, Revenue, Direct Expenses).
- [ ] **Journal Entries**: Post manual journal voucher (e.g., Debit `Baking Oven Power & Gas`, Credit `Bank Account`).
- [ ] **General Ledger**: Verify drilling down into `1010 Cash in Till` shows POS billing receipts.
- [ ] **Accounts Payable & Receivable**: Verify aging summary of pending supplier bills and customer dues.

### Page 12: Reports & Analytics (`/reports`)
- [ ] **Sales Summary**: Verify date-range filter (Today, This Week, This Month, Custom).
- [ ] **Gross Profit Margin Report**: Check product-wise profit margins (Selling Price vs. BOM ingredient cost).
- [ ] **Inventory Valuation**: Verify valuation using FIFO / weighted average cost.
- [ ] **GST GSTR-1 / GSTR-3B Summary**: Verify tax breakdown matches invoice totals.

---

# 🥖 PHASE 2: BAKERY MANUFACTURING & PLATFORM ADMIN SUITE (PAGES 13 TO 26)

### Page 13: Raw Materials (`/manufacturing/materials`)
- [ ] **Listing & Thresholds**: Verify flour, butter, sugar, yeast, and cocoa are listed with reorder points.
- [ ] **Add Ingredient**: Add new raw ingredient (e.g., `Organic Rolled Oats`, Unit: `kg`, Cost: `₹85/kg`).
- [ ] **Safety Stock Alerts**: Verify items below `min_stock_level` show yellow/red warning badges.

### Page 14: Raw Material Purchases (`/manufacturing/purchases`)
- [ ] **Direct Procurement Inward**: Create RM purchase entry directly for pantry restocking.
- [ ] **Batch Allocation**: Assign lot number (e.g., `LOT-MIL-202610-01`) with vendor invoice number.
- [ ] **UOM Check**: Verify purchases in bulk (e.g., 25kg bag) correctly map to base unit (kg).

### Page 15: Recipe / Yield BOM Designer (`/manufacturing/bom`)
- [ ] **Master Formula Configuration**:
  - Inspect `Master Sourdough Loaf Formula` and `French Laminated Croissant Formula`.
  - Check **Hydration %** (water relative to flour), **Dough Yield %**, and **Bake Loss %** calculations.
- [ ] **Baker's Percentage Engine**:
  - Add/Edit formula line items: verify reference flour shows 100%, and salt/yeast/butter calculate as % of flour weight.
- [ ] **By-products & Scrap**: Verify dough trimmings / scrap factor % can be configured.
- [ ] **Lifecycle Status**: Test toggling BOM between `Draft` $\rightarrow$ `Active` $\rightarrow$ `Deprecated`.

### Page 16: Bake Batches / Work Orders (`/manufacturing/work-orders`)
- [ ] **Batch Lifecycle Tracking**:
  - **Create Batch**: Generate Work Order for 100 Sourdough Loaves from active BOM.
  - **Release to Floor**: Transition status `Planned` $\rightarrow$ `Released` $\rightarrow$ `WIP (In Oven)`.
  - **Material Issue**: Auto-consume calculated quantities of Flour, Salt, and Yeast from WIP Warehouse.
  - **Batch Completion**: Record produced yield (e.g., 98 loaves finished, 2 burnt/scrap).
  - **Finished Goods Receipt**: Verify finished goods inventory increments in Front Display / Retail Counter.

### Page 17: MRP / Shortage Calculation Engine (`/manufacturing/mrp`)
- [ ] **Requirement Analysis**: Run MRP against active bake work orders.
- [ ] **Shortage Detection**: If flour or butter is below planned batch requirement, verify shortfall qty is flagged.
- [ ] **Auto-PO Generation**: Click `Generate Purchase Order` from shortage; verify pre-filled PO is drafted with preferred supplier.

### Page 18: Quality Control (`/manufacturing/qc`)
- [ ] **Incoming Inspection**: Record inspection on received milk/butter shipment (temperature, packaging integrity).
- [ ] **In-Process Check**: Record pH / dough fermentation temperature check.
- [ ] **Pass / Fail & Quarantine**: Mark defective raw batch as `Quarantined`; verify it cannot be consumed in BOM work orders.

### Page 19: Recipe Scaler (`/manufacturing/recipe-scaler`)
- [ ] **Dynamic Baker's Math Scaling**:
  - Select `Master Sourdough Loaf Formula`.
  - Enter Target Batch Size: `150 kg Dough` OR `200 Loaves`.
  - Verify all ingredient weights (flour, water, salt, yeast) scale instantaneously with zero precision errors.
- [ ] **Printable Scale Sheet**: Verify scaled recipe sheet can be printed for oven bakers.

### Page 20: Bake Planner (`/manufacturing/bake-planner`)
- [ ] **Shift Scheduling**:
  - View daily schedule for `Morning` and `Evening` shifts.
  - Add product lines with planned batch counts and assigned oven deck (e.g., `Stone Hearth Deck 1`).
  - Progress status from `Planned` $\rightarrow$ `Baking` $\rightarrow$ `Done`.

### Page 21: Fresh Returns & Delivery (`/manufacturing/fresh-returns`)
- [ ] **Route Management**: View daily delivery route to cafe clients (`The Urban Cafe & Roastery`).
- [ ] **Unsold Fresh Returns**: Log unsold loaves returned after 24 hours.
- [ ] **Salvage vs. Scrap**: Categorize return as `Day-Old Discount Counter`, `Breadcrumb Salvage`, or `Discard Scrap`.
- [ ] **Credit Note Generation**: Verify client balance is credited for authorized returns.

### Page 22: Bakery HACCP QC (`/manufacturing/bakery-qc`)
- [ ] **Critical Control Points (CCP) Logs**:
  - Verify active checkpoints:
    1. **CCP-1**: Oven Core Crumb Temperature (Target $\ge 94^\circ\text{C}$).
    2. **CCP-2**: Dairy & Chiller Temperature (Target $1^\circ\text{C} - 4^\circ\text{C}$).
    3. **CCP-3**: Flour Sieve & Magnet Trap Inspection.
- [ ] **Record Entry**: Submit live temperature probe reading; test that out-of-spec readings trigger required `Corrective Action` field.

### Page 23: Bake-Day Cost (`/manufacturing/day-cost`)
- [ ] **Comprehensive Batch Costing**:
  - Calculate actual cost per loaf factoring:
    * Raw ingredient cost consumed
    * Gas/electricity utility allowance
    * Baker labor hours
    * Bake loss & scrap variance
- [ ] **Gross Margin Analysis**: Compare actual cost vs. retail price (₹180) to show net margin %.

### Page 24: Branches (`/branches`)
- [ ] **Multi-Branch Setup**: Verify `Amora Central Bakehouse` is marked as Main Head Office.
- [ ] **Add Outlet**: Create retail kiosk (e.g., `Amora Express Kiosk - Express Avenue`).
- [ ] **Branch Switcher**: Switch branch in top bar; verify stock and sales filter by selected branch.

### Page 25: Users & Access Control (`/users`)
- [ ] **User Directory**: Verify `admin@amorabakery.com`, `chef@amorabakery.com`, and `pos@amorabakery.com`.
- [ ] **Create User**: Add new cashier user with assigned role and branch.
- [ ] **Password Reset**: Test changing password; verify bcrypt hash updates.
- [ ] **Permission Enforcement**: Log in as `Cashier`; verify manufacturing and admin settings are inaccessible.

### Page 26: Settings (`/settings`)
- [ ] **Company Profile**: Verify Company Name, Address, GSTIN, and Currency (`INR`).
- [ ] **Business Type Gating**: Confirm business type is set to `Bakery`.
- [ ] **Number Series**: Verify configurable prefix/suffix for Invoices (`INV-2026-`), Work Orders (`WO-AMR-`), and POs (`PO-AMR-`).
- [ ] **Print Templates**: Test Visual Template Designer preview for invoices and delivery challans.

---

## 🛠️ BUG REPORTING & AUTO-FIX STANDARD
Whenever you uncover any defect during the execution of this test workflow:
1. **Log the Bug**: State the Page, Endpoint/Component, Observed Behavior, and Expected Behavior.
2. **Apply Direct Code Fix**: Open the exact source file in `backend/app/` or `frontend/src/` and apply the fix.
3. **Verify Locally**: Re-test the endpoint or UI action immediately to confirm `200 OK` and error-free operation.
4. **Sign-off**: Output the final verification status for that page before advancing to the next.

