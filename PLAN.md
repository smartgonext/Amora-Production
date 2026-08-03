# SMARTGONEXT UNIVERSAL ERP — FULL MASTER PROMPT
### React + TailwindCSS · Python Flask + MySQL · SaaS + Desktop EXE Hybrid Architecture

Copy this entire document into Claude, ChatGPT, Cursor, Windsurf, or any AI coding assistant. Build it phase by phase, in order. Do not skip a phase. Each phase must be working and testable before the next begins. This is a single continuous specification — do not treat sections as optional extras.

---

## PART 0 — ROLE AND MISSION

You are acting as, simultaneously:

- Senior Software Architect
- Senior Database Architect
- Senior Backend Engineer (Python/Flask)
- Senior Frontend Engineer (React/Tailwind)
- Desktop Application Engineer (Electron/Tauri)
- DevOps & Release Engineer
- Security Engineer
- UI/UX Designer
- ERP Domain Consultant across retail, service, finance, hospitality, manufacturing, and institutional business types

Your mission is to design and build **SmartGoNext Universal ERP**: one ERP codebase that serves any business type, sold both as a multi-tenant SaaS web application and as a licensed Desktop EXE client, both backed by the same cloud control plane.

This is not a demo. Treat every module as something that will run in production for real paying customers, with real money, real stock, and real legal documents (invoices, agreements) flowing through it. Code accordingly: validate everything, log everything material, never silently drop data, never hard-delete records.

---

## PART 1 — BUSINESS CONTEXT

### 1.1 Businesses this ERP must serve out of the box

- Retail shop
- Wholesale distribution
- Restaurant / cafe / bakery
- Spa
- Salon
- Equipment rental / leasing
- Hospital / clinic
- School / college
- Apartment management
- Hostel management
- Hotel / lodge
- Manufacturing unit
- Textile business
- Finance / microfinance / lending
- Construction company
- Repair shop (electronics, appliances)
- Vehicle service center
- Mobile shop
- Medical shop / pharmacy
- Jewellery shop
- Supermarket

### 1.2 Scale target

- Design for 100,000+ tenant companies
- Design for tens of millions of transactional rows per large tenant over time
- No module should degrade in performance as tenant count or row count grows — every list/search screen must be paginated, indexed, and filterable server-side, never loaded fully into the browser

### 1.3 Non-negotiable UX bar

- A brand-new user must be able to create their first invoice within 10 minutes of first login, with zero training material read
- Every screen must be fully operable by keyboard alone
- Every destructive action (delete, cancel, void) requires confirmation and is soft-deleted, never hard-deleted
- The system must look and feel identical in spirit whether running online (SaaS) or offline (Desktop EXE)

---

## PART 2 — TECHNOLOGY STACK (FULL DETAIL)

### 2.1 Frontend

- ReactJS (function components + hooks only, no class components)
- Vite as the build tool
- TailwindCSS for all styling — no separate CSS files except for truly global resets
- React Router v6+ for routing
- Axios for HTTP, wrapped in a single API client module with interceptors for auth headers and 401 handling
- React Query (TanStack Query) for all server-state fetching, caching, and mutation handling
- React Hook Form for all forms, paired with a schema validator (Zod or Yup)
- Framer Motion for transitions and micro-interactions — used sparingly, never blocking user input
- React Icons for iconography
- Chart.js (via react-chartjs-2) for all dashboard and report charts
- React Table (TanStack Table) for all data grids, with server-side pagination, sorting, and filtering
- Context API for lightweight global state (auth user, active company, theme); escalate to Zustand only if Context becomes a bottleneck
- i18next or equivalent for multi-language support (English + regional languages)

### 2.2 Backend

- Python 3.11+
- Flask as the web framework
- Flask-SQLAlchemy as the ORM
- Flask-Migrate (Alembic) for schema migrations
- Flask-JWT-Extended for authentication (access + refresh tokens)
- Marshmallow or Pydantic for request/response schema validation
- REST API, versioned under `/api/v1/`
- Redis for caching hot lookups (product lists, tax tables) and for Celery's broker
- Celery for background jobs: scheduled reminders, report generation, backups, bulk imports/exports, email/WhatsApp/SMS dispatch
- WeasyPrint or ReportLab for PDF generation (invoices, agreements, reports)
- openpyxl for Excel import/export
- python-barcode and qrcode libraries for barcode/QR generation
- Flask-CORS configured per environment
- Structured logging (JSON logs) via the standard logging module, shipped to a central log store in production

### 2.3 Database

- MySQL 8+ as the primary relational database
- InnoDB engine everywhere (foreign key + transaction support required)
- UTF8MB4 charset throughout (for full Unicode, including regional scripts and emoji in notes fields)
- Every table: `id` (BIGINT UNSIGNED, primary key), `created_at`, `updated_at`, `is_deleted` (soft delete flag), `deleted_at`
- Every tenant-scoped table includes `tenant_id` (or `company_id`) as an indexed column
- Audit tables mirror critical entity changes (see Part 8)

### 2.4 Deployment

- SaaS: multi-tenant, deployed on a cloud provider (AWS/GCP/Azure/DigitalOcean — pick one and document why)
- Desktop EXE: packaged with Electron (maximum React code reuse) or Tauri (smaller install size, better performance, Rust-based shell) — decide in Phase 3 based on team skill and priorities
- PWA support for the web app so it can be "installed" on tablets/mobile without a native app
- Windows installer (NSIS or Squirrel for Electron; native installer for Tauri)
- Auto-updater with signed update packages

---

## PART 3 — CORE DESIGN PRINCIPLES

- Minimum clicks: no task that a cashier repeats hourly should take more than 3 interactions
- Keyboard-first: every action reachable by keyboard shortcut or Tab/Enter navigation
- Responsive: desktop, tablet, and mobile all fully usable, not just "not broken"
- Dark mode and light mode, user-togglable, persisted per user
- Modern, clean, uncluttered visual design — generous whitespace, clear typographic hierarchy, no decorative elements that slow down scanning
- Fast: every list screen must return results in under 300ms server-side for typical tenant data volumes
- Smooth but non-blocking animations — never make the user wait on an animation to complete before they can act
- Consistent design language across every module — one design system, not twenty different screen styles

---

## PART 4 — FOLDER STRUCTURE

### 4.1 Frontend structure

```
frontend/
  src/
    api/
      client.js
      auth.js
      products.js
      customers.js
      sales.js
      purchase.js
      inventory.js
      finance.js
      hr.js
      reports.js
      licensing.js
    components/
      common/
      forms/
      tables/
      charts/
      layout/
      shortcuts/
    pages/
      auth/
      dashboard/
      setup-wizard/
      products/
      customers/
      suppliers/
      purchase/
      sales/
      pos/
      inventory/
      finance/
      hr/
      projects/
      documents/
      reports/
      settings/
      admin/
    hooks/
    context/
    utils/
    constants/
    styles/
    routes/
    App.jsx
    main.jsx
  public/
  vite.config.js
  tailwind.config.js
```

### 4.2 Backend structure

```
backend/
  app/
    __init__.py
    config.py
    extensions.py
    models/
      base.py
      tenant.py
      user.py
      role.py
      company.py
      product.py
      customer.py
      supplier.py
      purchase.py
      sales.py
      inventory.py
      finance.py
      hr.py
      project.py
      document.py
      license.py
      subscription.py
      device.py
      audit.py
    schemas/
      (one schema module per model, mirroring models/)
    routes/
      auth.py
      products.py
      customers.py
      suppliers.py
      purchase.py
      sales.py
      pos.py
      inventory.py
      finance.py
      hr.py
      projects.py
      documents.py
      reports.py
      settings.py
      licenses.py
      subscriptions.py
      devices.py
      admin.py
    services/
      (business logic, one module per domain, called by routes)
    tasks/
      (Celery tasks: reminders, backups, exports, notifications)
    utils/
      pdf.py
      excel.py
      barcode.py
      email.py
      whatsapp.py
      sms.py
      security.py
    migrations/
  wsgi.py
  celery_worker.py
  requirements.txt
```

### 4.3 Desktop client structure (built on top of the web frontend)

```
desktop/
  electron/  (or src-tauri/ for Tauri)
    main.js
    preload.js
    license/
      verify.js
      encrypt.js
      device-id.js
    sync/
      queue.js
      conflict-resolver.js
    updater/
      manifest-check.js
      migration-runner.js
    local-db/
      sqlite-schema.sql
  (reuses frontend/ build output as the renderer)
```

---

## PART 5 — DATABASE SCHEMA (CORE TABLES)

Design full normalized tables for at least the following. Every table below needs proper foreign keys, indexes on lookup columns, and audit trail coverage.

### 5.1 Platform / tenancy tables
- `tenants` (company/customer account at the platform level)
- `companies` (a tenant can own multiple companies/branches)
- `branches`
- `users`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `user_sessions`
- `login_history`
- `device_registry`

### 5.2 Licensing / subscription tables
- `subscription_plans` (name, price, billing_cycle, allowed_modules, allowed_devices, max_users)
- `subscriptions` (tenant_id, plan_id, status, start_date, expiry_date)
- `licenses` (license_key, tenant_id, company_id, device_id, plan_id, modules_json, issued_at, expires_at, status)
- `payments` (tenant_id, subscription_id, amount, provider, provider_ref, status, paid_at)
- `license_events` (license_id, event_type, event_payload, created_at) — audit trail of every activation/suspension/renewal

### 5.3 Product & inventory tables
- `product_categories`
- `product_subcategories`
- `brands`
- `units`
- `products` (name, sku, hsn_code, gst_rate, category_id, brand_id, unit_id, purchase_price, selling_price, wholesale_price, retail_price, offer_price, min_stock, max_stock)
- `product_barcodes` (one product can have many)
- `product_images`
- `product_variants` (colour, size, weight)
- `product_batches` (batch_no, expiry_date, quantity)
- `warehouses`
- `warehouse_locations` (rack/bin level)
- `stock_ledger` (every stock movement: in/out/transfer/adjustment, with running balance)
- `stock_transfers`
- `stock_adjustments`
- `stock_audits`

### 5.4 Customer / supplier tables
- `customers` (name, phone, address, gst_number, credit_limit, membership_tier, wallet_balance, reward_points)
- `customer_documents`
- `customer_ledger`
- `suppliers` (name, phone, address, gst_number, bank_details)
- `supplier_documents`
- `supplier_ledger`

### 5.5 Purchase tables
- `purchase_orders`
- `purchase_order_items`
- `goods_receipt_notes` (GRN)
- `grn_items`
- `supplier_invoices`
- `purchase_returns`
- `purchase_return_items`
- `debit_notes`

### 5.6 Sales tables
- `quotations`
- `quotation_items`
- `sales_orders`
- `sales_order_items`
- `invoices`
- `invoice_items`
- `pos_sessions`
- `sales_returns`
- `sales_return_items`
- `exchanges`
- `delivery_challans`
- `delivery_challan_items`
- `receipts`
- `receipt_allocations` (which invoices a receipt pays down)

### 5.7 Finance tables
- `cash_accounts`
- `bank_accounts`
- `journal_entries`
- `journal_entry_lines`
- `contra_entries`
- `payments_out`
- `expenses`
- `expense_categories`
- `income_entries`
- `ledger_accounts`
- `chart_of_accounts`

### 5.9 HR / payroll tables
- `employees`
- `attendance`
- `leave_types`
- `leave_requests`
- `payroll_runs`
- `payroll_items`
- `employee_loans`
- `employee_advances`
- `shifts`
- `holidays`
- `performance_reviews`

### 5.10 Project management tables
- `projects`
- `tasks`
- `task_comments`
- `task_attachments`
- `project_timelines`
- `kanban_boards`
- `kanban_columns`
- `kanban_cards`

### 5.11 Document management tables
- `documents`
- `document_versions`
- `document_tags`

### 5.12 Template / setup tables
- `company_settings`
- `tax_settings`
- `invoice_templates`
- `agreement_templates`
- `receipt_templates`
- `quotation_templates`
- `purchase_order_templates`
- `delivery_challan_templates`
- `number_series` (per document type, per company)
- `custom_field_definitions`
- `custom_field_values`

### 5.13 Automation / notification tables
- `notifications`
- `reminders`
- `scheduled_jobs`
- `event_log` (internal event bus history: `invoice.created`, `stock.low`, `payment.overdue`, etc.)

### 5.14 Audit / security tables
- `audit_log` (who changed what, when, old value, new value)
- `restore_bin` (soft-deleted records pending permanent purge)
- `backup_log`
- `sync_log` (desktop client sync history)
- `db_migration_versions` (per-tenant/per-client schema version tracking)

---

## PART 6 — AUTHENTICATION & ACCESS CONTROL

- Multi-company, multi-branch, multi-user from day one — never retrofit this later
- Roles out of the box: Admin, Manager, Operator, Cashier, Accountant, Employee
- Custom roles: admin can define a new role and assign a subset of permissions from a master permission list
- Permission checks enforced server-side on every single endpoint — the frontend hiding a button is not security
- JWT access tokens (short-lived, 15–30 minutes) + refresh tokens (longer-lived, rotated on use)
- 2FA-ready: TOTP-based, optional per user, enforceable per role by the admin
- Device login history: record device fingerprint, IP, timestamp, and location (city-level) on every login
- IP history retained per user for security review
- Session timeout: configurable per company, defaults to 30 minutes of inactivity
- Session recovery: if the app crashes or the browser refreshes mid-entry, the in-progress form (invoice being typed, etc.) should be recoverable from an auto-saved draft, not lost

---

## PART 7 — FIRST-TIME SETUP WIZARD (DETAILED, STEP BY STEP)

The setup wizard is the single most important onboarding surface. It runs once. Everything configured here is reused forever afterward with zero re-entry.

### Step 1 — Company Profile
Fields: company name, logo upload, GST number, address (multi-line), phone, email, currency, financial year start month, timezone, default language, invoice number prefix, invoice starting number, barcode type (EAN-13/Code128/QR), QR type.

### Step 2 — Business Type Selection
User picks one of the 20 business types from Part 1.1. Behind the scenes, this sets a `business_type` flag on the company record and triggers a module-enablement rule: e.g., selecting "Hospital" enables patient/appointment modules and hides POS-specific retail fields; selecting "Restaurant" enables table/order management and hides batch/expiry tracking (unless food safety tracking is separately opted in).

### Step 3 — Tax Setup
Fields: GST enabled (yes/no), CGST rate, SGST rate, IGST rate, CESS rate, default discount type (flat/percentage), round-off rule (nearest rupee/nearest 10 paise/none), default tax rate applied to new products.

### Step 4 — Invoice Template Designer
User selects a base layout: Thermal (58mm/80mm), A4, A5, POS, or fully Custom. Live preview pane updates as fields are toggled on/off (logo, GST breakdown, terms & conditions, signature line, QR code for payment). Save as the company's default invoice template.

### Step 5 — Agreement Template Designer
A rich-text/HTML template editor where the user designs the agreement document once, using placeholder variables that will be auto-filled from live transaction data at print time:
`{{Customer}}`, `{{Address}}`, `{{Date}}`, `{{Amount}}`, `{{Vehicle}}`, `{{Phone}}`, `{{GST}}`, `{{Company}}`, and any custom variables the user defines. Save. Every future agreement for any customer/transaction auto-fills these fields — one click to print, zero redesign.

### Step 6 — Receipt Template Designer
Same one-time-design, reuse-forever pattern as Step 5, scoped to payment receipts.

### Step 7 — Quotation Template Designer
Same pattern, scoped to sales quotations.

### Step 8 — Purchase Order Template Designer
Same pattern, scoped to purchase orders sent to suppliers.

### Step 9 — Delivery Challan Template Designer
Same pattern, scoped to delivery challans.

### Step 10 — Finish
Summary screen showing everything configured. One "Activate ERP" button. From this point on, every document type (invoice, agreement, receipt, quotation, PO, challan) is generated by pulling the saved template and injecting only the transaction-specific fields — the user never touches template design again unless they explicitly choose to edit it from Settings.

### Implementation note
Build the six template designers (Steps 4–9) as **one shared Template Designer + Variable Engine component**, parameterized by document type — not six separate one-off screens. This keeps the codebase maintainable and lets you add a seventh document type later without duplicating logic.

---

## PART 8 — KEYBOARD-FIRST WORKFLOW (FULL SHORTCUT MAP)

All shortcuts must be visible in a `?` or F1 help overlay, and remappable in Settings → Keyboard Shortcut Manager.

| Key | Action |
|---|---|
| F1 | Help / shortcut overlay |
| F2 | Save current record |
| F3 | Open search |
| F4 | Edit current record |
| F5 | Refresh current screen |
| F6 | Jump to customer lookup |
| F7 | Jump to product lookup |
| F8 | Print current document |
| F9 | Open payment entry |
| F10 | Open reports |
| Ctrl+N | New record |
| Ctrl+S | Save |
| Ctrl+P | Print |
| Ctrl+F | Search within current list |
| Ctrl+E | Export current view |
| Ctrl+D | Duplicate current record |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+K | Universal command palette |
| / | Global quick search (any module) |
| Tab | Move to next field |
| Shift+Tab | Move to previous field |
| Enter | Confirm / move to next logical field |
| Esc | Close modal/current screen |
| Arrow keys | Navigate table rows / grid cells |

Barcode scanners must work purely as fast keyboard input (scan = rapid keystrokes + Enter) with no special driver required — the invoice line-item field must capture this correctly even under fast scan bursts.

---

## PART 9 — SMART BILLING FLOW (STEP BY STEP)

1. Cashier types or scans the customer's phone number into the billing screen
2. System looks up the customer record by phone (debounced, single API call)
3. On match: customer name, address, and GST number auto-populate
4. Previous outstanding balance is displayed inline, with a visual warning if it exceeds the credit limit
5. Any standing discount tier for this customer auto-applies to new line items
6. A "recently purchased" / "frequently bought" product shortlist appears for one-click add
7. Cashier adds line items via barcode scan or product search (F7)
8. Tax, discount, and round-off calculate automatically per the tax settings from the setup wizard
9. Payment is captured (cash/card/UPI/wallet/credit) — partial payments update the outstanding ledger correctly
10. Invoice is generated using the saved invoice template and printed with F8

Target: a repeat customer with 3–5 items should be fully billed in under 15 seconds of active cashier time.

---

## PART 10 — GLOBAL SEARCH & COMMAND PALETTE

- Pressing `/` from anywhere opens a global search box searching across invoices, customers, suppliers, products, employees, payments, orders, and reports simultaneously, with results grouped by type
- Pressing `Ctrl+K` opens a command palette that can also **navigate** to any page or **trigger** any action (e.g., typing "new invoice" jumps straight into invoice creation), not just search records
- Both must return results within 200ms for typical tenant data sizes — back this with a proper search index (MySQL full-text index at minimum; consider Meilisearch/Elasticsearch if search becomes a bottleneck at scale)

---

## PART 11 — MODULE SPECIFICATIONS (FULL FIELD DETAIL)

### 11.1 Product Module
Fields: category, sub-category, brand, unit of measure, HSN code, GST rate, multiple barcodes per product, multiple images per product, variants (colour/size/weight combinations each with their own stock/price if needed), batch number tracking, expiry date tracking, opening stock, minimum stock threshold, maximum stock threshold, linked supplier(s), purchase price, selling price, wholesale price, retail price, promotional/offer price with validity dates.

### 11.2 Customer Module
Fields: full profile (name, phone, email, address, date of onboarding), credit limit, running ledger, uploaded KYC/other documents, GST number, birthday, anniversary, membership tier, wallet balance, reward points balance and history, outstanding balance, full purchase history with drill-down to each invoice.

### 11.3 Supplier Module
Fields: full profile, complete purchase ledger, purchase history, due/payable balance, bank account details for payment, uploaded documents (agreements, GST certificate, etc.).

### 11.4 Purchase Module
Screens: purchase order creation, GRN (goods receipt note) against a PO with quantity/quality check, supplier invoice recording, purchase return with reason capture, debit note generation tied to a return.

### 11.5 Sales Module
Screens: quotation (convertible to sales order or invoice), sales order, invoice, POS quick-billing mode, sales return, exchange (return + new sale in one flow), delivery challan (with or without an invoice, e.g., for samples), receipt against one or more open invoices.

### 11.6 Inventory Module
Screens: stock by warehouse/rack/location view, stock transfer between warehouses/branches, stock adjustment with mandatory reason code, full stock audit workflow (count sheet generation → variance capture → adjustment posting), stock movement history per product, dead-stock report, fast-moving report, slow-moving report.

### 11.7 Finance Module
Screens: cash account management, bank account management with reconciliation, journal entry, contra entry (cash↔bank transfer), payment voucher, receipt voucher, expense entry with category, income entry, full ledger view per account, trial balance, balance sheet, profit & loss statement, cash flow statement.

### 11.9 HR & Payroll Module
Screens: employee master, daily attendance (with biometric/manual entry support), leave type configuration and leave request workflow, payroll run generation with statutory deductions, employee loan tracking, employee advance tracking, shift configuration and assignment, holiday calendar, performance review records.

### 11.10 Project Management Module
Screens: project creation, task creation and assignment, Gantt-style timeline view, Kanban board (drag-and-drop columns), shared calendar view, file attachments per project/task, threaded comments per task.

### 11.11 Document Management Module
Screens: upload center supporting PDF/Excel/Word/images, dedicated storage and tagging for contracts, agreements, and invoices, full version history per document with the ability to view/restore prior versions.

### 11.12 Reports Module (100+ Reports)
Categories, each with multiple report variants, all supporting date-range filters, drill-down, chart visualization, and PDF/Excel export:
- Sales reports: daily sales, sales by product, sales by customer, sales by category, sales by salesperson, sales trend over time
- Purchase reports: purchase by supplier, purchase by product, pending POs, purchase trend
- Profit reports: gross profit by product, gross profit by category, net profit by period
- GST reports: GSTR-1-style outward supply summary, GSTR-3B-style summary, HSN-wise tax summary
- Stock reports: current stock valuation, stock movement, dead stock, fast/slow movers, expiry-due stock
- Customer reports: outstanding by customer, top customers by revenue, customer purchase frequency
- Supplier reports: outstanding by supplier, purchase volume by supplier
- Finance reports: trial balance, balance sheet, P&L, cash flow, expense breakdown
- Employee reports: attendance summary, leave balance, payroll summary
- Growth reports: month-over-month and year-over-year growth across sales, customers, and profit

---

## PART 12 — AUTOMATION (RULE-BASED, NO AI IN THIS BUILD)

Implement the following as deterministic, rule-based automations, each triggered off the internal event bus (see Part 15):

- Automatic invoice numbering per the configured number series
- Automatic barcode generation for new products without one
- Automatic GST calculation based on product/category tax rate
- Automatic due-payment reminders (email/SMS/WhatsApp) on a configurable schedule before/after due date
- Automatic birthday and anniversary wishes to customers
- Automatic low-stock alerts when quantity falls below the configured minimum
- Automatic scheduled backups (see Part 18)
- Automatic email dispatch for invoices/statements
- Automatic WhatsApp dispatch (provider-agnostic hook, not wired to a specific vendor in this build)
- Automatic SMS dispatch (same, provider-agnostic hook)
- Automatic PDF generation for every printable document
- Automatic interest calculation for the finance/lending module
- Automatic ledger updates on every sale, purchase, payment, or receipt
- Automatic profit calculation per invoice and per period
- Automatic payment status updates (unpaid/partial/paid/overdue) driven by receipts against invoices
- Automatic customer statement generation on request or on schedule
- Automatic financial year closing procedure (lock prior year, roll forward opening balances)
- Automatic data archiving for records older than a configurable retention window
- Automatic audit logging on every create/update/delete across all modules
- Automatic session recovery for in-progress forms

**Architecture requirement:** every one of the above must be implemented as a listener on a well-defined internal event bus (events like `invoice.created`, `stock.low`, `payment.overdue`, `customer.birthday`) so that a future AI-driven automation layer can subscribe to the same events without any refactor of the core system. Do not build any AI/LLM integration in this version — only the event bus and the rule-based listeners.

---

## PART 13 — UX QUALITY-OF-LIFE FEATURES

- Universal command palette (Ctrl+K) — jump to any page, customer, invoice, or setting instantly
- Global search (`/`) across every module from one search box
- Recently used records surfaced on the dashboard and within relevant lookup fields
- Pinned/favourite menu items, configurable per user
- Auto-save drafts for any in-progress form
- Undo/redo for recent actions where safely reversible
- Floating calculator accessible from anywhere
- Calendar popup for date fields and for scheduling
- Personal notes and reminders per user
- Central notification center surfacing pending approvals, due payments, low stock, and expiring products/documents

---

## PART 14 — CUSTOMIZATION ENGINE

- Dynamic form builder: admin can add, remove, reorder, or mark fields mandatory on core forms (customer, product, employee, invoice) without a code deployment
- Custom field builder: arbitrary additional fields (text/number/date/dropdown) attachable to customers, products, employees, and invoices
- Approval workflows: configurable multi-step approval chains, e.g., quotation → manager approval → invoice conversion
- Configurable number series per document type, per company/branch
- Multi-level price lists: Retail, Wholesale, Dealer, VIP (or custom-named tiers), selectable per customer
- Bulk import/export via downloadable Excel templates with validation feedback on import errors
- Feature toggle system: enable only the modules a given business actually needs, hiding the rest from the UI entirely
- Plugin architecture: new modules can be registered and enabled without modifying core module code — define a clear plugin interface/contract for this

---

## PART 15 — INTERNAL EVENT BUS (AUTOMATION BACKBONE)

- Implement a lightweight internal event/message system (in-process pub-sub backed by Celery for anything that needs to run asynchronously or be retried)
- Standard event naming: `<entity>.<action>` — e.g., `invoice.created`, `invoice.paid`, `stock.low`, `payment.overdue`, `customer.birthday`, `subscription.expiring`, `license.suspended`
- Every automation in Part 12 subscribes to one or more of these events rather than being hard-coded into the request path that creates the record — this keeps request handlers fast and keeps automation logic testable in isolation
- Log every event fired to the `event_log` table for observability and future debugging

---

## PART 16 — API DESIGN

- REST, versioned under `/api/v1/`
- Every list endpoint supports: pagination (`page`, `page_size`), sorting (`sort_by`, `sort_dir`), filtering (field-specific query params), and search (`q`)
- Every write endpoint validates input via a schema (Marshmallow/Pydantic) and returns structured validation errors, never raw stack traces
- Every endpoint enforces JWT authentication and role/permission checks before touching the database
- Standard response envelope: `{ "data": ..., "meta": { "page": ..., "total": ... }, "errors": null }` on success, `{ "data": null, "meta": null, "errors": [...] }` on failure
- Full OpenAPI/Swagger documentation generated from the route definitions, kept in sync automatically (e.g., via flask-smorest or apispec)

---

## PART 17 — SECURITY (CORE SYSTEM)

- Passwords hashed with a strong algorithm (bcrypt or Argon2), never reversible
- JWT access + refresh token rotation, with refresh tokens revocable server-side (stored/tracked, not purely stateless)
- Granular permission checks on every endpoint, not just UI-level hiding
- Full audit log: every create/update/delete records who, what, when, old value, new value
- Device and IP login history retained and reviewable by the admin
- Configurable session timeout
- Soft-delete everywhere with a restore bin the admin can review and permanently purge from
- Scheduled encrypted backups with a documented, tested restore procedure

---

## PART 18 — SaaS-SPECIFIC REQUIREMENTS

- Tenant isolation: choose and document either shared-database-with-`tenant_id` (simpler, cheaper, fine to 100k+ tenants with proper indexing) or database-per-tenant (stronger isolation, higher operational overhead) — pick one for this build and justify the choice in the delivered documentation
- Subscription plans with pricing, billing cycle, and module/device/user entitlements
- Online payment gateway integration points (provider-agnostic interface; wire up one real provider, e.g., Razorpay, in the reference implementation)
- Usage limits and storage limits enforced per plan
- Custom domain mapping for larger customers who want their own branded URL
- White-labeling: allow a reseller/enterprise customer to apply their own logo/branding
- Free trial with automatic activation flow, no manual admin step

---

## PART 19 — DESKTOP EXE HYBRID ARCHITECTURE (FULL DETAIL)

### 19.1 Core principle

The Desktop EXE is not a separate product — it is a licensed, offline-capable client of the same SaaS cloud backend. All customer records, licenses, subscriptions, and device registrations live on the server. The EXE keeps only a local encrypted cache for speed and offline operation.

```
                SmartGoNext ERP Cloud
                   Website (React)
                          │
     ┌────────────────────┼────────────────────┐
     │                    │                    │
Register/Login      Subscription         Admin Panel
     │                    │                    │
     └────────────────────┼────────────────────┘
                          │
                  Flask REST API
                          │
           Licence & Update Server
                          │
   ┌──────────────────────┼──────────────────────┐
   │                      │                      │
SaaS Web ERP        Desktop ERP EXE        Mobile App (future)
```

### 19.2 Customer purchase flow — SaaS path
Visit website → Register → Choose plan → Payment → Account activated → Login → Use online ERP.

### 19.3 Customer purchase flow — Desktop EXE path
Visit website → Register → Choose plan → Payment → Download EXE installer → Download license/credential file → Install → First login → Server verification → ERP ready.

### 19.4 Trial flow
User clicks "Download Free Trial" → system automatically creates a Trial license: 15 days duration, maximum 500 bills, single company, single user, no payment required. The EXE stores a local encrypted license but always re-validates it against the server. When the trial expires:

```
⚠ Trial Expired
Purchase Required
[Buy Now]   [Enter Licence]   [Exit]
```

The ERP must never delete customer data on expiry — it becomes read-only until reactivated.

### 19.5 License activation flow
On payment success: server generates a license record linked to Customer ID, Device ID, Subscription, Expiry, Modules, and Company. The desktop app detects this on its next server check and unlocks automatically — no manual activation step required from the customer or from you.

### 19.6 Subscription expiry warnings
- 7 days before expiry: `⚠ Your subscription expires in 7 days. Renew now to avoid interruption.`
- 3 days before expiry: `⚠ 3 days remaining.`
- 1 day before expiry: `⚠ Expires tomorrow.`
- On expiry: `Subscription Expired — ERP is now in Read Only Mode. Renew to continue billing.`

### 19.7 Automatic unlock on renewal
Customer renews from the website → payment succeeds → subscription record updated on the server → desktop client's next server check picks up the change → license updated → app unlocks automatically. No reinstall, no new EXE required.

### 19.8 Software update flow
On every startup: client reports current version → checks server's version manifest → if up to date, opens normally → if a newer version exists, downloads the signed update package, installs it, and restarts. Behaves like a browser auto-update (Chrome-style), not like a manual patch process.

### 19.9 Database migration flow
The server tracks database schema versions per client. Example: a customer's local client is on DB version 1.2, the server is on 1.3 → server sends the migration package → client runs it automatically against its local database → version marked complete. No manual SQL import is ever required from the customer.

### 19.10 Local database
The desktop version uses a local database (SQLite, or local MySQL if justified) storing invoices, products, customers, stock, employees, and reports locally, keeping the ERP fast even without an internet connection.

### 19.11 Cloud backup
Background sync every 5 minutes: new bills and changed records are encrypted and pushed to the server as a backup. If the customer's PC crashes: reinstall → login → restore backup → continue working exactly where they left off.

### 19.12 Offline mode
If internet is lost: billing, sales, stock updates, and printing all continue working locally. When internet returns: the client uploads its changes and downloads any updates from the server, then resumes normal online-sync operation.

### 19.13 Device control
Each license specifies an allowed device count per plan (e.g., Professional plan → 2 allowed devices). If the customer tries to activate a third device, block it with a clear message; the admin can remotely deactivate an old/unused device to free up a slot.

### 19.14 Remote admin control
From the admin panel, you must be able to: suspend a license, reactivate a license, extend expiry, change plan, reset device activation, force logout, force an immediate update check, send in-app announcements, and trigger a remote backup for any specific customer.

### 19.15 Admin dashboard
Per customer/company view showing: customer name, company, plan, license status, app version, last sync timestamp, local database schema version, registered devices, storage used, subscription status with days remaining, and last successful backup status.

### 19.16 Security requirements specific to the desktop client
Never trust the local license file alone. The EXE must: encrypt the license file, encrypt the local database, verify license signatures cryptographically, perform periodic server re-checks even during an active session (not only at launch), detect tampering with local files, detect system clock rollback (a common trial-bypass trick) and respond appropriately, use HTTPS for all communication, and use JWT/refresh tokens for authenticated sessions.

### 19.17 Recommended technology for the hybrid layer
- Frontend: React + TailwindCSS (shared with the SaaS web app)
- Backend: Python Flask REST API (shared with the SaaS web app)
- Cloud database: MySQL
- Desktop local cache: SQLite (or local MySQL if the customer's environment supports running a local service)
- Desktop shell: Electron (maximizes React code reuse) or Tauri (smaller install footprint, better performance) — decide explicitly and document the decision
- Updates: auto-updater with a signed version manifest and signed update packages
- Sync: background sync queue with conflict resolution and resumable uploads

### 19.18 What this architecture guarantees
One codebase for SaaS and Desktop. Online and offline support. Automatic software updates. Automatic database migrations. Automatic subscription/license verification. Trial and paid licensing without manual admin steps. Cloud backup and restore. Centralized customer management. The ability to roll out new features without requiring any customer to reinstall anything.

---

## PART 20 — BUILD PHASES (EXECUTE IN THIS ORDER)

### Phase 1 — Cloud Backend Foundation
Build customer accounts, company/tenant model, subscription plans, license model, license auto-generation on payment success, and the core auth/subscription/license/device API endpoints from Part 5.2 and Part 16. Every endpoint validates license status server-side.
**Exit criteria:** a customer can register, subscribe, pay, and receive a valid license, fully verifiable via the API.

### Phase 2 — Core ERP Data Model & CRUD
Implement the full schema from Part 5.3 through 5.12, with full CRUD REST endpoints per Part 16 for products, customers, suppliers, purchase, sales, inventory, finance, HR, projects, and documents.
**Exit criteria:** every module in Part 11 can be created, read, updated, and soft-deleted via the API with correct validation and audit logging.

### Phase 3 — Setup Wizard & Template Engine
Build the 10-step setup wizard from Part 7, and the shared Template Designer + Variable Engine used across invoice/agreement/receipt/quotation/PO/challan templates.
**Exit criteria:** a new company can complete the wizard once and generate every document type correctly from saved templates without redesigning anything afterward.

### Phase 4 — Core ERP Frontend
Build the React frontend for every module in Part 11, including the smart billing flow (Part 9), global search and command palette (Part 10), and the full keyboard shortcut map (Part 8).
**Exit criteria:** a cashier can complete a full sale (customer lookup → line items → payment → printed invoice) in under 15 seconds using only the keyboard.

### Phase 5 — Automation & Event Bus
Implement the internal event bus (Part 15) and every rule-based automation from Part 12 as listeners on it.
**Exit criteria:** creating an invoice correctly triggers numbering, tax calculation, ledger update, and payment-status update automatically, all visible in the event log.

### Phase 6 — Reports Module
Build the 100+ reports from Part 11.12, each with date filters, drill-down, charting, and export.
**Exit criteria:** every report category listed produces correct, exportable output against realistic seeded data.

### Phase 7 — Website Purchase & Onboarding Flow
Build the public website flow from Part 19.2–19.4: registration, plan selection, payment, SaaS activation, EXE download + license file, and trial signup.
**Exit criteria:** a user can go from anonymous visitor to an active SaaS account or a downloaded EXE + license file, entirely self-service.

### Phase 8 — Desktop EXE Client & License Enforcement
Build the Electron/Tauri shell, local license verification, device registration and limits, trial countdown and expiry handling (read-only, no data loss), and automatic unlock on renewal, per Part 19.4–19.7 and 19.13.
**Exit criteria:** installing the EXE with a trial license expires correctly and safely, and unlocks automatically the moment payment succeeds — verified end to end.

### Phase 9 — Auto-Update & Migration System
Implement the signed update manifest, auto-updater, and automatic per-client database migration runner, per Part 19.8–19.9.
**Exit criteria:** shipping a new feature and schema change from the server is picked up automatically by every installed EXE on next launch, with zero customer action.

### Phase 10 — Local DB, Offline Mode & Sync
Implement the local SQLite cache, offline billing/sales/stock/printing, and the 5-minute background sync queue with conflict resolution and resumable uploads, per Part 19.10–19.12.
**Exit criteria:** a full day of offline billing syncs cleanly to the cloud with no duplicates or data loss once reconnected.

### Phase 11 — Cloud Backup & Disaster Recovery
Implement the automatic encrypted backup cycle and the reinstall-and-restore flow, per Part 19.11.
**Exit criteria:** simulating a PC crash and reinstalling recovers 100% of the customer's data from the cloud.

### Phase 12 — Remote Admin Control & Admin Dashboard
Implement every remote admin action and the full admin dashboard, per Part 19.14–19.15.
**Exit criteria:** every listed admin action takes effect on the targeted desktop client within one server-check cycle.

### Phase 13 — Security Hardening
Implement license file/database encryption, signature verification, tamper detection, clock-rollback detection, and periodic re-verification, per Part 19.16 and Part 17.
**Exit criteria:** attempting common bypass tricks (clock rollback, license file editing, license cloning to a second device) is detected and blocked server-side.

### Phase 14 — Final Integration, Testing & Deployment
Run the full end-to-end scenario: new customer → trial → expiry → purchase → auto-unlock → app update → DB migration → offline billing → sync → simulated crash → restore → admin suspends license → client goes read-only — all without manual intervention beyond the customer's own actions. Produce deployment, installation, and support-runbook documentation.
**Exit criteria:** the entire flow above completes successfully in a single test pass, and all documentation listed in Part 21 exists and is accurate.

At the end of each phase, summarize what was built, confirm the exit criteria were met, and explicitly flag any open decision (tenant isolation strategy, Electron vs Tauri, conflict-resolution strategy, payment provider choice) that needs a decision before the next phase begins. Do not silently make a major architectural decision without surfacing it.

---

## PART 21 — REQUIRED FINAL OUTPUT

Deliver, as production-ready code and documentation — not demo code:

1. Complete frontend folder structure and source (Part 4.1)
2. Complete backend folder structure and source (Part 4.2)
3. Complete desktop client structure and source (Part 4.3)
4. Full MySQL schema (SQL DDL) covering every table in Part 5, plus an ERD description
5. Full REST API implementation and OpenAPI/Swagger documentation for every endpoint
6. React pages and reusable components for every module in Part 11
7. The shared Setup Wizard and Template Designer engine (Part 7)
8. Authentication, role, and permission system (Part 6)
9. Dashboard with recent activity, favourites, and notification center
10. Settings module, including keyboard shortcut manager and feature toggles
11. Reports module with all report categories from Part 11.12
12. Billing/POS module implementing the smart billing flow (Part 9)
13. Inventory module with full stock ledger and audit workflow
15. Finance module with trial balance, balance sheet, and P&L
16. HR/payroll module
17. Project management module
18. Document management module with version history
19. SaaS multi-tenancy implementation with the chosen isolation strategy documented
20. Desktop EXE packaging setup (installer, auto-updater, license enforcement)
21. Internal event bus and all rule-based automations from Part 12
22. Admin panel with remote license/device control and the full admin dashboard
23. Deployment guide (server hosting, database hosting, update manifest hosting, code signing)
24. Installation guide for end customers (both SaaS and EXE paths)
25. Internal support runbook (manual license overrides, emergency update pushes, reading the admin dashboard during a support call)
26. Keyboard shortcut reference sheet

Build everything as modular, production-grade code: each ERP module independently toggleable, clean separation between routes/services/models, consistent naming, inline documentation, centralized error handling and input validation, structured logging throughout, and an architecture that scales to 100,000+ tenants and millions of records without a redesign.

---

## PART 22 — VERTICAL EXTENSION: CRANE & FORKLIFT (SPARE PARTS + RENTAL + AMC)

This part specifies a business-type extension of the core ERP for companies that sell crane/forklift spare parts, rent out cranes/forklifts, and manage AMC (Annual Maintenance Contracts). It builds entirely on the core system in Parts 1–21 — same auth, same setup wizard pattern, same template engine, same event bus, same reports architecture — with the additions below layered on top when `business_type = "Crane & Forklift"` is selected in Step 2 of the Setup Wizard (Part 7).

### 22.1 Business concept

Three revenue lines under one tenant, sharing the same customer base and GST/billing engine:

1. **Spare Parts** — sell crane/forklift spare parts (bearings, hydraulic parts, tyres, filters, cables, etc.) through the standard Product/Inventory/Purchase modules already defined in Parts 5 and 11
2. **Rental Service** — rent out cranes/forklifts (or attachments) to customers for a duration, tracked by equipment, dates, rate, and return condition
3. **AMC** — sell and manage Annual Maintenance Contracts against customer-owned equipment: contract period, scheduled service visits, service history, renewals

### 22.2 GST/tax specifics for this vertical

Extend the tax engine from Part 3-equivalent principles (GST settings from the Setup Wizard) with:

- HSN-based GST rates for spare parts (as already covered for Product in Part 11.1)
- SAC-based GST rates for rental income and AMC income (renting equipment and providing maintenance are both services, taxed under SAC codes, not HSN)
- CGST/SGST/IGST auto-split based on whether the customer's billing state matches the company's registered state
- Support for GST-exempt or reverse-charge scenarios on certain B2B/inter-state rentals
- A combined HSN-wise + SAC-wise GST summary report, added to the Reports module (Part 11.12), for GST filing across all three revenue lines

### 22.3 Additional database tables (extend Part 5)

- `equipment_master` — equipment type (crane/forklift/attachment), model, capacity, registration/asset number, purchase date, current status (available/rented/under-service/retired)
- `equipment_documents` — RC, insurance, fitness certificate, etc.
- `equipment_service_history`
- `rental_agreements` — customer, equipment_id, start_date, end_date, rate_type (daily/weekly/monthly), rate_amount, security_deposit, delivery_address, status
- `rental_extensions`
- `rental_returns` — return date, condition notes, damage charges if any
- `rental_invoices` — linked to a rental agreement, generated per billing cycle or on completion
- `amc_contracts` — customer, equipment_id or customer-owned-equipment reference, contract_start, contract_end, contract_value, number_of_services_included, payment_terms, status
- `amc_service_schedule` — planned service visit dates, generated automatically from contract terms
- `amc_service_visits` — actual visit date, technician assigned, work done, parts consumed (auto-deducted from stock via the standard stock ledger in Part 5.3), customer sign-off
- `amc_renewals` — renewal history linked to the original contract

All of the above follow the same conventions as every other table in Part 5: soft-delete columns, audit coverage, tenant-scoped, indexed foreign keys.

### 22.4 Additional / modified pages

- **Billing page (extends Part 9 / Part 11.5):** add a transaction-type switch at the top — **Spare Parts Sale / Rental Invoice / AMC Invoice** — so billing staff use the same screen for all three. For Rental, selecting an active rental agreement auto-pulls the rate and computes the amount due for the period. For AMC, selecting an active contract auto-pulls the contract value/schedule and generates the invoice for the relevant period or service visit.
- **Rental Service Add page (new):** create a rental agreement (customer, equipment from `equipment_master`, period, rate, deposit, delivery address). On save, equipment status auto-updates to "Rented" and becomes selectable in the Billing page's rental flow. A companion **Rental Return** screen marks equipment returned, captures condition/damage notes, and reverts equipment status to "Available."
- **AMC Management page (new):** create an AMC contract, auto-generate its service visit schedule, log each visit (with automatic parts deduction from stock), and run the renewal workflow with a pre-expiry prompt.
- **Product page (Part 11.1):** extend the product record with a "compatible equipment models" field so spare parts can be filtered/searched by which crane/forklift models they fit.
- **Reports page (Part 11.12):** add rental revenue and equipment-utilization reports (days rented vs. idle, per equipment), AMC revenue and renewal-compliance reports, and the combined HSN/SAC GST summary from 22.2.
- **Dashboard (implicit in Part 21 item 9):** add a revenue-by-line-of-business breakdown (Spare Parts / Rental / AMC), an equipment status overview (available/rented/under-service counts), AMC contracts expiring soon, and rental returns due soon.
- **Notification Centre (Part 13):** extend the existing notification center with alert rules specific to this vertical — low stock on spare parts (already covered generically in Part 12), AMC contract expiring in a configurable window (e.g., 30/15/7 days), and rental return overdue.

### 22.5 Additional automations (extend Part 12 / Part 15 event bus)

Add these as new event-bus listeners, following the exact same rule-based, no-AI pattern already defined in Part 12:

- `rental.return_due_soon` — fires as a rental agreement's end date approaches
- `rental.return_overdue` — fires if equipment isn't marked returned by the end date
- `amc.contract_expiring` — fires at 30/15/7 days before an AMC contract's end date
- `amc.service_visit_due` — fires from the `amc_service_schedule` table ahead of each planned visit
- `equipment.status_changed` — fires whenever `equipment_master.status` changes (available ↔ rented ↔ under-service), so the dashboard and reports stay live without polling

### 22.6 Superadmin considerations

No change to the superadmin architecture in Part 21 — the Crane & Forklift business type is just another tenant configuration. Superadmin still sees this tenant in the standard tenant list, with the standard suspend/reactivate/extend/plan-change/impersonate actions from the core system; no vertical-specific superadmin features are required.

### 22.7 Build phase placement

Build this vertical's specifics as an extension **after** the corresponding core phases in Part 20 are complete: equipment master and rental tables extend Phase 2 (Core ERP Data Model), the rental/AMC pages extend Phase 4 (Core ERP Frontend), the vertical's GST specifics extend Phase 3 (Setup Wizard & Template Engine), and the new automations extend Phase 5 (Automation & Event Bus) — do not build this as a separate parallel track from the core phases.

---

## APPENDIX A — BUSINESS TYPE → MODULE ENABLEMENT MATRIX

Use this as the default module-enablement rule triggered by Step 2 of the Setup Wizard (Part 7). Admins can always manually override defaults afterward.

| Business Type | Core Modules Auto-Enabled | Modules Typically Hidden by Default |
|---|---|---|
| Retail Shop | Product, POS, Inventory, Customer, Finance, Reports | Project Management, HR Payroll (unless staff tracking wanted) |
| Wholesale | Product, Purchase, Sales, Inventory, Supplier, Finance | POS quick-billing |
| Restaurant/Bakery | POS (table/order mode), Product, Inventory, Finance | Batch/expiry-heavy retail fields, Project Management |
| Spa/Salon | Customer (appointments), POS, HR (staff/shift) | Purchase, Manufacturing-style Inventory |
| Hospital/Clinic | Customer (patient), HR, Document Management, Finance | POS, Wholesale pricing tiers |
| School/College | Customer (student), HR, Finance, Document Management | Inventory, POS |
| Apartment/Hostel | Customer (resident), Finance (rent/dues) | Purchase, Manufacturing Inventory |
| Hotel/Lodge | Customer (booking), POS, Finance | Manufacturing, HR Payroll (optional) |
| Manufacturing | Product (BOM-aware), Inventory, Purchase, Finance | POS |
| Textile | Product (variant-heavy), Inventory, Sales, Purchase | Project Management |
| Finance/Lending | Customer (borrower), Finance (interest engine) | Inventory, Product |
| Construction | Project Management, Finance, HR, Document Management | POS, Inventory (unless materials tracked) |
| Repair Shop | Customer, Sales (job/repair ticket), Inventory (parts) | Manufacturing |
| Vehicle Service | Customer, Sales (job card), Inventory (parts) | Manufacturing |
| Mobile Shop | Product (IMEI/serial tracking), POS, Inventory, Finance | Project Management |
| Medical Shop | Product (batch/expiry critical), POS, Inventory, Finance | Project Management, HR Payroll |
| Jewellery | Product (weight/purity variants), POS, Customer, Finance | Manufacturing (unless in-house crafting) |
| Supermarket | Product, POS, Inventory, Customer, Finance, Reports | Project Management |
| Crane & Forklift (Spare Parts + Rental + AMC) | Product, Inventory, Purchase, Billing (multi-type), Equipment Master, Rental Service, AMC, Reports, Notifications | POS quick-billing, HR Payroll (unless staff tracking wanted) |

Implementation note: store this mapping as data (a `business_type_module_defaults` table or seed config), not as hardcoded conditional logic in the frontend — this keeps it editable without a redeploy.

---

## APPENDIX B — QA / ACCEPTANCE TEST CHECKLIST

Run this checklist before considering any phase complete.

### B.1 Functional
- [ ] Every module in Part 11 supports create, read, update, and soft-delete
- [ ] Every list screen paginates, sorts, filters, and searches correctly server-side
- [ ] Setup wizard completes end-to-end and every saved template renders correctly on first real transaction
- [ ] Smart billing flow completes a repeat-customer sale in under 15 seconds using keyboard only
- [ ] Every keyboard shortcut in Part 8 performs its documented action
- [ ] Global search (`/`) and command palette (`Ctrl+K`) return correct cross-module results
- [ ] Every automation in Part 12 fires correctly off its corresponding event
- [ ] Every report in Part 11.12 produces correct totals against seeded test data and exports cleanly to PDF and Excel

### B.2 Licensing & Hybrid Architecture
- [ ] Trial license auto-creates correctly with the 15-day/500-bill/1-company/1-user limits enforced
- [ ] Expired trial goes read-only with no data loss, and shows the correct warning screen
- [ ] Purchase completion auto-unlocks the desktop client with no reinstall
- [ ] Subscription warnings fire at exactly 7, 3, and 1 day(s) before expiry
- [ ] Device limit is enforced per plan, and admin can remotely free a device slot
- [ ] Every remote admin action (suspend, reactivate, extend, change plan, reset device, force logout, force update, announcement, remote backup) takes effect on the client within one server-check cycle
- [ ] App auto-update installs a new version with no manual customer action
- [ ] Database migration runs automatically and idempotently on the client when the server reports a newer schema version
- [ ] Offline billing for a full day syncs cleanly with no duplicate or lost records on reconnect
- [ ] Simulated PC crash + reinstall fully restores the customer's data from cloud backup

### B.3 Security
- [ ] All passwords stored hashed, never reversible
- [ ] All endpoints reject requests without a valid JWT and the correct permission
- [ ] Audit log captures old/new values on every material change
- [ ] License file and local database are encrypted at rest on the desktop client
- [ ] System clock rollback is detected and handled without allowing a trial/subscription bypass
- [ ] Cloning a license file to a second, unregistered device is detected and blocked
- [ ] All client-server traffic runs over HTTPS

### B.4 Performance & Scale
- [ ] List/search endpoints return within 300ms against realistic large-tenant data volumes
- [ ] Global search returns within 200ms
- [ ] System remains responsive with a simulated 100,000-tenant, multi-million-row dataset in staging

---

## APPENDIX C — GLOSSARY (FOR CONSISTENT NAMING ACROSS THE CODEBASE)

- **Tenant** — a paying customer account at the platform level; may own multiple companies
- **Company** — a business entity under a tenant, with its own GST number, branches, and financial year
- **Branch** — a physical or logical sub-location of a company
- **License** — the record that grants a specific device/company the right to run the ERP, tied to a subscription
- **Subscription** — the commercial plan and billing cycle a tenant has purchased
- **Device** — a specific installation of the desktop EXE, identified by a device ID
- **Event Bus** — the internal pub-sub mechanism through which automations react to record changes
- **Template Engine** — the shared system that renders invoices/agreements/receipts/quotations/POs/challans from a saved template plus live transaction data
- **Soft Delete** — marking a record as deleted (`is_deleted = true`, `deleted_at` set) without physically removing it, so it can be restored
- **Restore Bin** — the admin-facing view of soft-deleted records pending permanent purge

This glossary should be used consistently in code (variable names, table names, API field names) and in all customer-facing documentation to avoid naming drift across modules.

---

## APPENDIX D — HOW TO USE THIS PROMPT

- Paste this entire document as a single system/instruction prompt into your AI coding assistant of choice
- Ask it to begin with Phase 1 only, and to stop and report back once Phase 1's exit criteria are met, before continuing
- Keep this document itself as the single source of truth for scope — if the assistant proposes something not covered here (e.g., a different tenant isolation strategy), have it flag the decision explicitly rather than silently deciding
- Re-paste or reference this document at the start of each new session with the assistant, since long conversations can lose earlier context
- Treat every phase's "Exit criteria" line as a hard gate: do not accept a phase as done until that specific criterion has been demonstrated, not just claimed
- When in doubt about a business-type default (Appendix A) or a report definition (Part 11.12), resolve it against real customer data from that business type before finalizing the rule, rather than guessing generically
- Keep this document versioned alongside the codebase (e.g., commit it into the repo as `MASTER_PROMPT.md`) so future feature requests can be scoped as diffs against it instead of starting from a blank page

---

*End of master prompt. Total scope: 21 core parts, 14 build phases, 4 appendices — build in order, verify every exit criterion, and flag every open decision.*

---

## APPENDIX E — DYNAMIC FORM BUILDER & MS WORD-STYLE TEMPLATE DESIGNER ROADMAP

This appendix outlines the multi-phase implementation roadmap for the dynamic form customization engine and visual document layouts.

### E.1 Phase 1: Dynamic Form Builder & Inline Option Creator
1. **Database Schema**:
   - `custom_form_sections`: Group fields under tabs or sections (collapsible in form views).
   - `custom_form_fields`: Fields with attributes: label, internal key, field type (`text`, `number`, `select`, `multiselect`, `date`, `checkbox`), default value, validation rules, order.
2. **Inline Option Creator**:
   - Every select/multiselect field rendered dynamically includes a small inline `+` button.
   - Clicking this button opens a modal allowing users to instantly append a new option to the field's `options_json` schema configuration without navigating away or losing current form progress.
3. **Entity Placements**:
   - Settings page section to customize fields for: Product Add, Service Add, Rental Add, AMC Add, and POS Checkout.
   - Forms dynamically render custom fields sorted by section structure.

### E.2 Phase 2: MS Word-Style Visual Template Designer
1. **UI Canvas (Microsoft Word Aesthetic)**:
   - A drop-shadow A4 container card (`595px` width by `842px` height) centered inside a grey workspace backdrop.
   - Top layout formatting ribbon (toolbar): Font selector, font size, bold/italic/underline, text alignment, and foreground/background color pickers.
   - Element insertion buttons: Add text block, add dynamic items table, add signature placeholder, and add image block.
2. **Multiple Image Uploads & Positioning**:
   - Support dragging, resizing, and positioning multiple image assets (e.g., brand logo, watermark background, terms QR codes, signature stamps).
3. **Coordinate Engine Integration**:
   - Save block coordinates as percentages (`x_pct`, `y_pct`, `w_pct`, `h_pct`) relative to the canvas container to preserve responsiveness.
   - Backend ReportLab engine translates percentage coordinates to points relative to the bottom-left origin for precise A4 print output.

### E.3 Step-by-Step Execution Plan (Steps 1–6)
* [x] **Step 1: Backend Database Migration**
  - Create tables `custom_form_sections` and `custom_form_fields`.
  - Add `layout_json` columns to `invoice_templates`, `quotation_templates`, and `agreement_templates`.
  - Run migrations and update seed/test defaults.
* [x] **Step 2: Custom Field Builder API Development**
  - Implement models and service functions in `app/services/form_builder_service.py`.
  - Register endpoints under `/api/v1/custom-fields` for schema fetching, section/field CRUD, option updating, and field reordering.
* [x] **Step 3: Frontend Custom Form Builder UI & Inline Option Creator**
  - Construct the settings drag-and-drop workspace in React.
  - Implement section management, field properties sidebar, and the inline `+` button modal for instant dropdown option creation.
  - Integrate dynamic fields into Product Add, Service Add, Rental Add, AMC Add, and POS Checkout forms.
* [x] **Step 4: Universal MS Word-Style Template Designer UI (React)**
  - Develop the interactive A4 workspace card (`595px` x `842px`) in Settings.
  - Include top ribbon formatting toolbar, page rulers, drag-and-drop elements, dynamic variables picker, and multi-image positioning.
* [x] **Step 5: ReportLab Coordinate PDF Generation**
  - Upgrade `app/utils/pdf.py` to convert visual percentage coordinates into ReportLab points for exact A4 rendering.
  - Test visual outputs for Invoices, Quotations, and Agreements.
* [x] **Step 6: Grid Reporting Filters & Portable Exports**
  - Extend server-side column filtering, Excel exports via `openpyxl`, tabular PDF exports via ReportLab, and print stylesheets across all reporting/list grids.