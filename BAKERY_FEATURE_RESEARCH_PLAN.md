# 🍞 Bakery Manufacturing — Real-Company Research & Feature-Add Plan

> **Purpose:** Research how a **real bakery manufacturing company actually operates**, decide which of those real activities this ERP already covers, and recommend the **specific new features to add** so the software genuinely serves a bakery — not a generic manufacturing unit.
>
> **Guiding rule (your requirement):** everything is **Company-Type driven**. When someone creates a shop and picks **"Bakery"**, only the bakery-relevant modules and fields open. A **Retail / other** type sees only its own fields. Nothing unrelated shows, and nothing is one-size-fits-all.
>
> **Scope:** this is **not** about adding a theoretical "R&D department." It is about the *actual real-world operations* of a bakery factory (ingredients, mixing, baking, quality, packaging, distribution, freshness, safety, costing) mapped to software features.

---

## 1. How we researched it

We combined **industry knowledge of commercial bakery operations** with verified codebase facts (models, services, routes, React pages, and the existing plan docs in `d:\ERP\`). Key industry facts used:

- A bakery formula is expressed in **Baker's Percentage** — every ingredient relative to **flour = 100%**. Water = "hydration %", salt ≈ 2%, yeast ≈ 1–2%. This is how real bakers scale a recipe across batch sizes.
- Commercial breadmaking sequence: **formulation → mixing/kneading → bulk fermentation → dividing/shaping → proofing → baking → cooling → slicing → packaging → distribution**, with **bake loss** (dough wt vs finished bread wt) and **freshness/staling/shelf-life** critical.
- Bakery production mixes **make-to-stock** (fresh daily bread) and **make-to-order** (custom/bulk), with **very short shelf life** and **same/next-day delivery** — so production planning, expiry policy (FEFO/FIFO), and route delivery dominate.
- Obligations: **HACCP, allergen control, nutrition/ingredient labeling, storage instructions, batch traceability, supplier compliance**.

---

## 2. What a real bakery company does (operational map)

```
  SALES & DEMAND
  ────────────────
  • Retail counter / POS sales (store + cafes)
  • B2B / institutional orders (hotels, restaurants, caterers)
  • Custom & celebration orders (cakes) → make-to-order
  • Wholesale distributor / route sales
           │
           ▼
  DEMAND → PRODUCTION PLANNING  (what do we bake today/tomorrow)
  • Bread baked daily (fresh) — plan per production day
  • Long-life items (biscuits, rusks, wrapped bread) planned to stock
  • Master Baking Schedule by shift + oven/line capacity
           │
           ▼
  FORMULATION / RECIPE (BAKER'S %)
  • Ingredient master (flour, yeast, sugar, fat, improvers, milk, eggs, additives)
  • Recipe = baker's %, dough yield, bake loss
  • Scaling: small (lab) → line (commercial batch)
           │
           ▼
  RAW MATERIAL PROCUREMENT
  • Purchase orders from suppliers (flour, yeast, ...)
  • GRN + incoming quality (batch no, mfg/expiry date)
  • Stock stored FIFO / FEFO (first-expiry-first-out)
           │
           ▼
  PRODUCTION EXECUTION (BAKERY FLOOR)
  • Issue raw materials to batch (batch no traceability)
  • Stage sequence: mix → ferment/proof → bake → cool → slice → pack
  • Actual vs expected yield (overweight/underweight, waste)
  • Ovens / equipment, labor, shift / downtime
           │
  ▼
  QUALITY (QC / HACCP)
  • In-process checks (weight, colour, temperature)
  • Finished checks (taste, texture, shelf-life, packing integrity)
  • Allergen cross-contamination control; supplier compliance docs
  • Batch release → reject / rework
           │
  ▼
  PACKAGING + SHELF-LIFE
  • Label: ingredients, allergens, nutrition, net weight, best-before
  • Expiry: FEFO/FIFO in warehouse
  • Freshness: "baked today" / unsold stock end-of-day
           │
  ▼
  DISTRIBUTION / DELIVERY
  • Delivery challan + route/run planning (van stops per area)
  • Return of unsold fresh stock (credit note) — high bakery priority
           │
  ▼
  COSTING & FINANCE
  • Batch / formula cost of goods (materials + labor + overhead)
  • Actual vs standard yield & cost variance per batch / per day
  • Invoicing, daily sales reconciliation, GST
```
---

## 3. What the software already has (verified mapping)

| # | Real bakery activity | Software feature | Where in code ✅ |
|---|---|---|---|
| 1 | Formula / recipe with quantities | BOM with recipe, qty, waste %, alternate, multi-level | `BomHeader`/`BomItem`/`BomByproduct` (models/manufacturing.py) |
| 2 | BOM versioning / revisions | BOM version + revision | manufacturing.py + routes |
| 3 | Raw-material master | `Product`, `is_raw_material`, purchase cost | product.py + RawMaterialsPage |
| 4 | Raw-material receipt with expiry at GRN | `GRNItem` batch_no, mfg/expiry, gate entry | grn_service.py, product.py |
| 5 | Batch traceability (finished ↔ raw) | `BatchLineage` | models/manufacturing.py |
| 6 | Production ticket / run | Work order, release/WIP/complete, production receipt | manufacturing_service.py + WorkOrderBoard |
| 7 | Yield / variance analysis | `compute_work_order_analysis` (material yield %) | manufacturing_service.py:737 |
| 8 | MRP / auto purchase-orders | `run_mrp`, auto-PO | manufacturing_service.py + MrpPlanningPage |
| 9 | QC inspections | `QualityInspection` + JSON checklist | models + QcInspectionPage |
| 10 | Bakery tenant profile + gating | "Bakery" = process / batch / expiry / QC | manufacturing_config.py |
| 11 | Sales / POS / invoicing / GST | POS + sales + invoices + finance + GST | sales.py + BillingPage |
| 12 | Make-to-order (custom / bulk) | SalesOrder → WorkOrder (`sales_order_id`) | models/manufacturing.py:176 |
| 13 | B2B customers & billing | Customer master + invoicing | customers.py + invoices.py |

**Bottom line: the foundation is strong — it can already *run* a bakery at the batch level.**

---

## 4. The REAL gaps (what a bakery needs that the software does NOT have)

Ordered from most-to-least painful for a real bakery operator.

### 🔴 A. Production planning — "what do we bake today?"
A bakery MUST plan the **production day** (per product, per shift, per oven/line capacity), fed by:
- POS / order history (same-day-last-week, yesterday),
- B2B make-to-order commitments,
- custom / celebration orders,
- freshness lead time (fresh loaves need 2–3 bake runs/day; wrapped goods bake-to-stock).

**Today:** only `WorkOrder` (per BOM) + MRP + raw sales orders. **No day/shift master baking schedule, no forecast, no capacity by oven/line, no bake-plan calendar.**

> **Add:** `BakeryProductionPlan` (date, shift, line/oven, product, planned batches + qty, capacity) → **Daily Bake Board** frontend.

### 🔴 B. Recipe scaling with Baker's %, dough yield, and bake loss
- Enter formula in **Baker's %** (flour = 100%), auto-scale to a target dough weight and to finished loaves given **dough yield** and **bake loss %**.
- Compare expected vs actual baked qty.

**Now:** BOM is scalar per component only — no %-of-flour math, hydration/dough-yield/bake-loss fields, or auto-scaling.

> **Add:** `baker_pct` column on `BomItem`; `scale_formula()` service; `hydration_pct`, `dough_yield_pct`, `bake_loss_pct` on `BomHeader`; a **Recipe Scaler** screen (bakery).

### 🔴 C. Shelf-life / freshness / FEFO + unsold-day return
- **FEFO / FIFO picking** (shortest-expiry picked first).
- **Day-code / freshness**: mark fresh items unsold at day-end, auto "unsold" hints + **credit note** for retailer returns.
- **Expiry alerts** beyond raw GRN fields.

**Today:** only raw-material batch/expiry at GRN. No FEFO queue, no freshness/day-code, no unsold-return.

> **Add:** `shelf_life_days`, `best_before_days`, `is_fresh` on products (bakery); a **FEFO picking queue** in inventory; an **Unsold Fresh Stock / Return** module linked to credit notes.

### 🟠 D. Food-safety compliance / labelling (HACCP / FSSAI-style)
- Structured **allergen** flags per ingredient & finished product (gluten, milk, egg, nuts…).
- **Nutrition / ingredient declaration** for labels (roll-up from formula).
- **HACCP control-point logs** (checkpoint temps/times), today QC is free-form JSON.
- Supplier compliance documents (COA) linked to ingredients.

> **Add:** allergen + nutrition + label fields on `Product`/`BomHeader`; **Label/Declaration generator**; **HACCP control-point checklists** tied to `QualityInspection` — gated to bakery/food.

### 🟠 E. Production-day cost & variance accounting
- **Batch / day cost sheet** (materials + labour + waste) vs standard BOM cost per batch and per day.
- **Waste / overweight / underweight** variance.

**Today:** `compute_work_order_analysis` gives material-yield % only — no labour/overhead/waste cost roll-up, no per-day P&L.

> Extend into a **Bake-Day Cost Report** (materials + labour + waste + oven overhead) with planned vs actual per product.

### 🟠 F. Delivery routes / distribution + challan + unsold returns
- **Route/run planning** for vans (area → customer drop order).
- **Delivery challan** + undelivered/unsold returns (heavy for bakeries).

**Today:** `delivery_challan` template exists, invoicing works, but **no route/van module or unsold-return flow**.

> **Add:** `DeliveryRoute` (date, van, driver, ordered customers) → generate **delivery challans**; an **Unsold Return** pass linking to a credit-note.

### 🟡 G. Allergen-free lot segregation (cross-contamination)
- **Segregation** of allergen-carrying vs Free-From batches; schedule line clearances; "May contain" flags.
> Folded into the labelling/HACCP work (D).

---

## 5. Concrete NEW features to add

### Backend / data
1. **Bakery profile flags** in `manufacturing_config.py`: extend to `['batch_production','expiry_tracking','qc','baker_pct_scaling','fefo','freshness','allergen_label','haccp']`.
2. **Overlay columns**:
   - `Product`: `shelf_life_days`, `best_before_days`, `is_fresh`, `allergens` (JSON), `nutrition` (JSON)
   - `BomHeader`: `bake_loss_pct`, `dough_yield_pct`, `hydration_pct`
   - `BomItem`: `baker_pct`
3. **New tables**: `baking_production_plans`, `delivery_routes`, `unsold_returns`, `fefo_picks`, `haccp_control_points`.
4. **Service** `backend/app/services/bakery_service.py`:
   - `scale_formula(bom_id, target_dough_weight)` — baker's % → weights
   - `build_daily_bake_plan(date)` — orders + POS + capacity
   - `generate_label(product_id)` — nutrition + allergen declaration
   - `compute_day_cost(date)` — per-day P&L per batch
5. **Routes** `backend/app/routes/bakery.py` — CRUD for plans, returns, FEFO, labels, day-cost.
6. **Frontend** `frontend/src/pages/bakery/` — `RecipeScaler.jsx`, `BakePlanner.jsx`, `LabelGenerator.jsx`, `FreshReturnPage.jsx`, `DayCostReport.jsx`; surfaced via the adaptive Manufacturing/Sidebar **only when mfg_type='process'** + feature flags.

### Company-Type gating (your core rule)
Extend the **business_type → modules/features/fields** data (PLAN.md App A) so:
- **Bakery** gets all of the above + manufacturing + POS + inventory + expiry + finance;
- **Retail / Pharmacy / Jewellery / others** hide bakery screens, route/label/FEFO, and bakery fields.

---

## 6. Phased delivery (recommended order)

| Phase | Content | Priority |
|---|---|---|
| **1** | Company-Type driven module & field gating (data-driven; non-bakery hide irrelevant screens) | 🔴 |
| **2** | Bakery feature profile + new `Product`/`BOM` columns (shelf life, allergens, nutrition, baker%) | 🔴 |
| **3** | Recipe scaling engine (baker's %, dough yield, bake loss) + RecipeScaler UI | 🔴 |
| **4** | Daily bake plan / production schedule + forecast | 🟠 |
| **5** | FEFO / freshness + unsold-return + credit note + route/delivery | 🟠 |
| **6** | Label / nutrition / allergen generator + HACCP control-point QC | 🟠 |
| **7** | Bake-day cost & variance report; **pytest** tests for all | 🟡 |

---

## 7. End state — everything company-type driven

| If they pick | They see | They don't see |
|---|---|---|
| **Bakery** | Recipe scaling, daily bake plan, freshness/FEFO, allergen/nutrition labels, QC/HACCP, batch+expiry, route & unsold returns, batch manufacturing | generic ERP plumbing |
| **Manufacturing Unit** | BOM/routing, serial, scrap, MRP | recipe/freshness/routes |
| **Retail / Mobile / Jewellery / Others** | POS, products, stock, customers, finance | bakery/manufacturing/R&D/route |

Gating is **data-driven** (per PLAN.md) and **enforced server-side** (front-end hiding is not a security boundary).

---

> **Next step (on your go-ahead): implement Phase 1 + 2 + a working Recipe Scaling engine (baker's %), all gated to the Bakery company type.**