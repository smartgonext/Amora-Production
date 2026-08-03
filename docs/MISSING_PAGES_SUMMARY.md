# Missing Pages & Routes — Quick Reference

## 🔴 CRITICAL (Blocking Core ERP Functionality)

### Sales Module
- ✅ `SalesListPage.jsx` (Consolidated tabbed UI) + `/api/v1/sales/...` (Quotations, Orders, Returns, Challans, Receipts)

### Purchase Module
- ✅ `PurchasesPage.jsx` (Consolidated tabbed UI) + `/api/v1/purchases/...` (PO, GRN, Returns, Debit Notes)

### Finance Module
- ✅ `FinancePage.jsx` (Consolidated tabbed UI) + `/api/v1/finance/...` (Accounts, Ledgers, Contra, Journal, Expenses, Income)
- ❌ `TrialBalancePage.jsx` + `/api/v1/finance/trial-balance`
- ❌ `BalanceSheetPage.jsx` + `/api/v1/finance/balance-sheet`
- ❌ `ProfitLossPage.jsx` + `/api/v1/finance/profit-loss`
- ❌ `CashFlowPage.jsx` + `/api/v1/finance/cash-flow`

### Inventory Module
- ✅ `InventoryPage.jsx` (Consolidated tabbed UI) + `/api/v1/inventory/...` (Transfers, Adjustments, Warehouse register, Movements)

### Keyboard System
- ✅ `KeyboardShortcutManager.jsx` (Command palette Ctrl+K, search /, F1 help overlay, global event listener)

---

## 🟡 HIGH PRIORITY (Core Modules Incomplete)

### HR/Payroll Module
- ❌ `EmployeeMasterPage.jsx`
- ❌ `AttendancePage.jsx`
- ❌ `LeaveManagementPage.jsx`
- ❌ `PayrollPage.jsx`
- ❌ `LoanAdvancePage.jsx`
- ❌ `ShiftManagementPage.jsx`
- ❌ `HolidayCalendarPage.jsx`
- ❌ `PerformanceReviewPage.jsx`

### Reports Module
- ⚠️ `ReportsPage.jsx` exists but needs 90+ report implementations
- ❌ PDF export functionality (`utils/pdf.py`)
- ❌ Excel export functionality (`utils/excel.py`)
- ❌ Chart visualization per report
- ❌ Drill-down capability

### Template Engine
- ⚠️ `SetupWizardPage.jsx` exists but verify 6 template designers:
  - Invoice Template Designer (Step 4)
  - Agreement Template Designer (Step 5)
  - Receipt Template Designer (Step 6)
  - Quotation Template Designer (Step 7)
  - PO Template Designer (Step 8)
  - Delivery Challan Designer (Step 9)
- ❌ Template variable engine (`services/template_service.py`)
- ❌ Live preview functionality

### Customization Engine
- ❌ `CustomFieldBuilder.jsx` + `/api/v1/settings/custom-fields`
- ❌ `DynamicFormBuilder.jsx`
- ❌ `ApprovalWorkflowConfig.jsx`
- ❌ `NumberSeriesConfig.jsx`
- ❌ `PriceListManager.jsx`
- ❌ `BulkImportExport.jsx`
- ❌ `FeatureToggleUI.jsx`

---

## 🟢 MEDIUM PRIORITY (Sub-Features & Enhancements)

### Product Module Enhancements
- ❌ Product variant management screen
- ❌ Product barcode management (multiple barcodes per product)
- ❌ Product image gallery (upload/manage multiple images)
- ❌ Product batch tracking
- ❌ Linked suppliers management

### Customer Module Enhancements
- ❌ Customer ledger view
- ❌ Customer document management
- ❌ Customer purchase history with drill-down
- ❌ Customer wallet/reward points management

### Supplier Module Enhancements
- ❌ Supplier ledger view
- ❌ Supplier purchase history
- ❌ Supplier document management

### Project Management Enhancements
- ❌ `GanttChartView.jsx` (Gantt timeline)
- ❌ `KanbanBoard.jsx` with drag-and-drop
- ❌ `SharedCalendarView.jsx`
- ❌ Task attachments UI
- ❌ Task comments thread

### Document Management Enhancements
- ❌ Document version history UI
- ❌ Restore prior version functionality

### UX Quality-of-Life Features
- ❌ `NotificationCenter.jsx`
- ❌ `Calculator.jsx` (floating calculator)
- ❌ Auto-save draft system
- ❌ Undo/redo system
- ❌ Recently-used records widget
- ❌ Favourite menu pins

---

## 🔵 BACKEND INFRASTRUCTURE GAPS

### Missing Backend Routes
- ❌ `backend/app/routes/sales.py` (quotations, sales orders)
- ❌ `backend/app/routes/pos.py` (POS-specific endpoints)
- ❌ `backend/app/routes/inventory.py` (stock operations)
- ❌ `backend/app/routes/finance.py` (accounting endpoints)
- ❌ `backend/app/routes/settings.py` (settings management)
- ❌ `backend/app/routes/subscriptions.py` (subscription management)
- ❌ `backend/app/routes/devices.py` (device management)

### Missing Backend Services
- ❌ `services/product_service.py`
- ❌ `services/customer_service.py`
- ❌ `services/sales_service.py`
- ❌ `services/purchase_service.py`
- ❌ `services/inventory_service.py`
- ❌ `services/finance_service.py`
- ❌ `services/hr_service.py`
- ❌ `services/project_service.py`
- ❌ `services/report_service.py`
- ❌ `services/template_service.py`
- ❌ `services/notification_service.py`

### Missing Celery Tasks
- ❌ `tasks/reminders_task.py` (payment due, birthdays)
- ❌ `tasks/notifications_task.py` (email/SMS/WhatsApp)
- ❌ `tasks/exports_task.py` (async report generation)
- ❌ `tasks/archival_task.py` (old record cleanup)
- ❌ `tasks/year_end_task.py` (financial year closing)

### Missing Utilities
- ❌ `utils/pdf.py` (PDF generation with WeasyPrint/ReportLab)
- ❌ `utils/excel.py` (Excel import/export with openpyxl)
- ❌ `utils/barcode.py` (barcode/QR generation)
- ❌ `utils/email.py` (email sending)
- ❌ `utils/whatsapp.py` (WhatsApp dispatch)
- ❌ `utils/sms.py` (SMS dispatch)

### Missing Models (50+ tables)
See GAP_ANALYSIS.md for full list of missing database models across:
- Product & Inventory (8 tables)
- Purchase (8 tables)
- Sales (9 tables)
- Finance (11 tables)
- HR (11 tables)
- Projects (7 tables)
- Documents (2 tables)
- Templates (7 tables)
- Automation (3 tables)
- Audit (1 table)

---

## 📊 COMPLETION STATISTICS

| Category | Implemented | Missing | % Complete |
|----------|-------------|---------|------------|
| **Frontend Pages** | 23 | 60+ | ~28% |
| **Backend Routes** | 16 files | 7 files + 100+ endpoints | ~30% |
| **Backend Models** | 20 tables | 67 tables | ~23% |
| **Backend Services** | 2 | 11 | ~15% |
| **Utilities** | 2 | 6 | ~25% |
| **Celery Tasks** | 0 | 5 | 0% |
| **Overall** | — | — | **~40%** |

---

## 🎯 NEXT STEPS

1. **Read full GAP_ANALYSIS.md** for detailed gap descriptions
2. **Follow Implementation Roadmap** (Phases 15-18, 10-15 weeks)
3. **Start with Phase 15** (Sales, Purchase, Finance, Inventory, Keyboard)

*Refer to GAP_ANALYSIS.md for complete phase-by-phase implementation plan*
