# 🏗️ Crane & Forklift Rental Business - Complete ERP Workflow Report

> **Prepared For:** [Client Company Name]
> **System:** SmartGoNext Universal ERP
> **Business Type:** Crane & Forklift Rental, Spare Parts Sales, AMC Services
> **Date:** July 2026

---

## 📋 Table of Contents

1. [Business Overview](#business-overview)
2. [How the System Works (Flow)](#how-the-system-works-flow)
3. [Module 1: Login & Dashboard](#module-1-login--dashboard)
4. [Module 2: Products - Spare Parts Catalog](#module-2-products---spare-parts-catalog)
5. [Module 3: Customers - Your Clients](#module-3-customers---your-clients)
6. [Module 4: Suppliers - Your Vendors](#module-4-suppliers---your-vendors)
7. [Module 5: Equipment - Cranes & Forklifts](#module-5-equipment---cranes--forklifts)
8. [Module 6: Rentals - Equipment on Hire](#module-6-rentals---equipment-on-hire)
9. [Module 7: AMC Contracts - Maintenance Service](#module-7-amc-contracts---maintenance-service)
10. [Module 8: Sales & Invoicing](#module-8-sales--invoicing)
11. [Module 9: Billing / POS - Counter Sales](#module-9-billing--pos---counter-sales)
12. [Module 10: Purchases - Buying Stock](#module-10-purchases---buying-stock)
13. [Module 11: Inventory - Spare Parts Stock](#module-11-inventory---spare-parts-stock)
14. [Module 12: HR & Payroll - Your Staff](#module-12-hr--payroll---your-staff)
15. [Module 13: Projects - Job Work](#module-13-projects---job-work)
16. [Module 14: Documents - Records & Files](#module-14-documents---records--files)
17. [Module 15: Finance & Accounting](#module-15-finance--accounting)
18. [Module 16: Reports & Analytics](#module-16-reports--analytics)
19. [Module 17: Branch Management](#module-17-branch-management)
20. [Module 18: User Management](#module-18-user-management)
21. [Module 19: Settings](#module-19-settings)
22. [Complete Business Flow Diagram](#-complete-business-flow-diagram)

---

## Business Overview

Your business deals in **3 main areas**:

### 1️⃣ Crane & Forklift Rentals
You own cranes and forklifts that you give on rent to construction companies, factories, warehouses, etc.

**Examples:**
- Mobile Crane (25 Ton) - ₹8,000/day
- Tower Crane - ₹15,000/day
- Forklift (3 Ton) - ₹3,500/day
- Forklift (10 Ton) - ₹6,000/day
- Boom Lift - ₹5,000/day

### 2️⃣ Spare Parts Sales
You sell spare parts for cranes, forklifts, and heavy equipment.

**Examples:**
- Hydraulic Oil Filter - ₹850
- Brake Pads Set - ₹2,500
- Engine Oil (5L) - ₹1,200
- Tyre (Forklift) - ₹4,500
- Lifting Chain - ₹3,200
- Hydraulic Hose Pipe - ₹1,800

### 3️⃣ AMC (Annual Maintenance Contract)
You provide maintenance service contracts for cranes and forklifts.

**Examples:**
- Monthly inspection & servicing
- Emergency breakdown support
- Spare parts replacement
- Hydraulic system check
- Engine & transmission service

---

## How the System Works (Flow)

```
                    ┌─────────────────────────────┐
                    │         LOGIN PAGE          │
                    │   (Email + Password)        │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │         DASHBOARD           │
                    │  ┌───────────────────────┐  │
                    │  │ Today's Overview:     │  │
                    │  │ • Active Rentals: 12  │  │
                    │  │ • AMC Contracts: 45   │  │
                    │  │ • Spare Parts Sold    │  │
                    │  │ • Revenue Today       │  │
                    │  └───────────────────────┘  │
                    └─────────────┬───────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────────┐
        │                         │                             │
        ▼                         ▼                             ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  MASTER DATA     │   │  TRANSACTIONS    │   │  OPERATIONS      │
│                  │   │                  │   │                  │
│ • Products       │   │ • Sales Invoice  │   │ • Rentals        │
│   (Spare Parts)  │   │ • Purchase Order │   │ • AMC Service    │
│ • Customers      │   │ • Billing/POS    │   │ • Inventory      │
│   (Contractors)  │   │ • Quotations     │   │ • HR/Staff       │
│ • Suppliers      │   │                  │   │ • Projects       │
│ • Equipment      │   │                  │   │ • Documents      │
│   (Cranes/Fork.) │   │                  │   │                  │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   FINANCE & ACCOUNTS  │
                    │   • Payments Received │
                    │   • Rental Income     │
                    │   • AMC Income        │
                    │   • Expenses          │
                    │   • GST Filing        │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   REPORTS & ANALYTICS │
                    │   • Rental Report     │
                    │   • AMC Report        │
                    │   • Stock Report      │
                    │   • P&L Statement     │
                    └───────────────────────┘
```

---

## Module 1: Login & Dashboard

### 🔐 Login Page
**What it does:** Secure entry point to the system

**Your Business Use:**
- Your office staff, managers, and admin each get their own login
- Different access levels:
  - **Admin** - Full access to everything
  - **Manager** - Can manage rentals, AMC, sales
  - **Staff** - Can only view and create records

**Workflow:**
```
Staff → Login with Email/Password → System checks role → Opens Dashboard
```

---

### 📊 Dashboard
**What it does:** Shows you the complete business status at a glance

**What you will see for YOUR business:**

| Card | What it Shows | Example |
|------|---------------|---------|
| **Total Rentals Active** | How many cranes/forklifts are currently on rent | 12 Active Rentals |
| **AMC Contracts Active** | How many maintenance contracts running | 45 AMC Contracts |
| **Spare Parts Sold Today** | Parts sold from counter | ₹12,500 Today |
| **Revenue This Month** | Total income from rentals + AMC + parts | ₹8,45,000 |

**Charts:**
- **Revenue Pipeline** - Monthly income trend (Rental + AMC + Parts Sales)
- **Weekly Activity** - How many rentals started, AMC visits done

**Quick Tools:**
- Pinned Favourites - Bookmark Rental page, AMC page
- Recent Records - Last customer, last rental created
- Personal Notes - "Call ABC Construction for rental renewal"

**Workflow:**
```
Login → Dashboard → See business status → Click any module to work
```

---

## Module 2: Products - Spare Parts Catalog

**What it does:** Manage all spare parts you sell

**Your Business Use:**
You sell spare parts for cranes, forklifts, and heavy equipment. This module is your product catalog.

**What you can add:**

| Field | Example for Your Business |
|-------|--------------------------|
| Product Name | Hydraulic Oil Filter |
| SKU (Code) | HOF-001 |
| HSN Code | 8421 (for GST) |
| GST Rate | 18% |
| Purchase Price | ₹600 (what you paid) |
| Selling Price | ₹850 (what customer pays) |
| Min Stock Level | 10 (alert when low) |
| Opening Stock | 50 pieces |

**Examples of your spare parts:**
```
🔧 Hydraulic Parts: Oil Filter, Hose Pipe, Seal Kit, Pump
🔧 Engine Parts: Oil Filter, Air Filter, Fuel Filter, Belt
🔧 Brake Parts: Brake Pads, Brake Drum, Brake Fluid
🔧 Electrical: Battery, Alternator, Starter Motor, Cable
🔧 Tyres & Wheels: Forklift Tyre (Solid), Crane Tyre
🔧 Lifting: Chain, Hook, Wire Rope, Shackle
🔧 Lubricants: Engine Oil 5L, Hydraulic Oil, Grease
```

**Workflow:**
```
Dashboard → Products → Add New Part → Set Price & GST → Save → Available for Sale
```

---

## Module 3: Customers - Your Clients

**What it does:** Store all your customer information

**Your Business Use:**
Your customers are construction companies, factories, warehouses, and contractors who:
- Rent cranes/forklifts from you
- Buy spare parts from you
- Take AMC service from you

**What you store for each customer:**

| Field | Example |
|-------|---------|
| Company Name | ABC Construction Pvt Ltd |
| Contact Person | Mr. Rajesh Sharma |
| Phone | 9876543210 |
| Email | info@abcconstruction.com |
| Address | Site Office, Sector 62, Noida |
| GSTIN | 09AABCC1234D1Z5 |
| PAN | AABCC1234D |
| Credit Limit | ₹2,00,000 |
| Credit Period | 30 days |

**Workflow:**
```
Dashboard → Customers → Add Customer → Enter Details → Save → 
Now you can: Create Rental / Sell Parts / Make AMC for this customer
```

---

## Module 4: Suppliers - Your Vendors

**What it does:** Manage all your suppliers/vendors

**Your Business Use:**
Your suppliers are companies who supply you:
- Spare parts (OEM parts, lubricants, tyres)
- Equipment (new cranes, forklifts)
- Services (transport, insurance)

**What you store:**

| Field | Example |
|-------|---------|
| Company Name | Tata Motors Ltd |
| Contact | Mr. Amit Singh |
| Phone | 9876543210 |
| GSTIN | 27AAACT1234D1Z5 |
| Payment Terms | 15 days |
| Supply Items | Forklift Parts, Engine Parts |

**Workflow:**
```
Dashboard → Suppliers → Add Supplier → Save → Create Purchase Orders
```

---

## Module 5: Equipment - Cranes & Forklifts

**⭐ THIS IS THE MOST IMPORTANT MODULE FOR YOUR BUSINESS**

**What it does:** Register and track all your cranes, forklifts, and heavy equipment

**What you register for each equipment:**

| Field | Example 1 | Example 2 |
|-------|-----------|-----------|
| Equipment Name | Mobile Crane | Forklift |
| Equipment Type | Crane | Forklift |
| Model Number | AC-250 | FD-30T |
| Capacity | 25 Ton | 3 Ton |
| Registration No | UP14-1234 | UP14-5678 |
| Hourly Rate | ₹1,500/hr | ₹500/hr |
| Daily Rate | ₹8,000/day | ₹3,500/day |
| Status | Available | On Rent |

**Equipment Types you can add:**
```
🏗️ CRANES:
  • Mobile Crane (25 Ton, 50 Ton, 100 Ton)
  • Tower Crane
  • Crawler Crane
  • Pick & Carry Crane
  • Boom Lift

🛠️ FORKLIFTS:
  • Forklift 3 Ton
  • Forklift 5 Ton
  • Forklift 10 Ton
  • Reach Truck
  • Pallet Stacker
```

**Equipment Status Tracking:**
```
🟢 Available - Ready to rent
🟡 On Rent - Currently with customer
🔴 Under Maintenance - In workshop
🟠 Reserved - Booked for upcoming date
```

**Workflow:**
```
Dashboard → Equipment → Add New Equipment → 
Enter Name, Type, Capacity, Rates → Save → 
Now available for Rentals & AMC
```

---

## Module 6: Rentals - Equipment on Hire

**⭐ CORE BUSINESS MODULE - Your Main Income**

**What it does:** Manage all equipment rental transactions

**How Rental Works in Your Business:**

```
Customer calls → "I need a 25 Ton Crane for 5 days"
You check → Equipment is Available
You create → Rental Agreement in system
Equipment goes → To customer site
After rental → Equipment returns → Generate Invoice
Customer pays → Rental charges
```

**What you record in each Rental:**

| Field | Example |
|-------|---------|
| Customer | ABC Construction |
| Equipment | Mobile Crane (25 Ton) |
| Start Date | 15-July-2026 |
| End Date | 20-July-2026 |
| Duration | 5 Days |
| Rate | ₹8,000/day |
| Total Amount | ₹40,000 |
| Status | Active |
| Delivery Location | Site Office, Noida |
| Operator Name | Suresh (your driver) |

**Rental Status:**
```
📝 Pending - Created but not yet started
✅ Active - Equipment is with customer
⏰ Overdue - Return date passed
✔️ Completed - Equipment returned
💰 Paid - Payment received
```

**Workflow:**
```
Dashboard → Rentals → Create Rental → 
Select Customer → Select Equipment → 
Set Dates & Rates → Save → 
Equipment Status changes to "On Rent" →
When returned → Mark Complete → Generate Invoice
```

---

## Module 7: AMC Contracts - Maintenance Service

**⭐ IMPORTANT - Recurring Income Module**

**What it does:** Manage Annual Maintenance Contracts for cranes and forklifts

**Your AMC Services:**
```
🔧 Monthly Inspection - Check all systems
🔧 Oil & Filter Change - Every 3 months
🔧 Hydraulic System Check - Every 6 months
🔧 Brake & Safety Check - Every month
🔧 Emergency Breakdown - 24/7 support
🔧 Full Overhaul - Annual
```

**What you record in each AMC:**

| Field | Example |
|-------|---------|
| Customer | ABC Construction |
| Equipment | Forklift 3 Ton (Reg: UP14-5678) |
| Contract Start | 01-Jan-2026 |
| Contract End | 31-Dec-2026 |
| Contract Value | ₹36,000/year |
| Payment Terms | ₹3,000/month |
| Service Frequency | Monthly |
| Status | Active |

**AMC Status:**
```
✅ Active - Contract running
⏰ Expiring Soon - Renewal needed (30 days before)
❌ Expired - Contract over
🔄 Renewed - New contract created
```

**Workflow:**
```
Dashboard → AMC → Create Contract → 
Select Customer → Select Equipment → 
Set Start/End Date → Set Service Schedule → 
Save → System sends alerts for:
  • Monthly service due
  • Contract expiring soon
  • Payment due
```

---

## Module 8: Sales & Invoicing

**What it does:** Create invoices for all your business transactions

**Types of Invoices you will create:**

| Invoice Type | For What? | Example Amount |
|-------------|-----------|----------------|
| **Rental Invoice** | When customer returns equipment | ₹40,000 (5 days rental) |
| **Parts Invoice** | When customer buys spare parts | ₹8,500 (parts sold) |
| **AMC Invoice** | Monthly/Yearly AMC payment | ₹3,000 (monthly AMC) |
| **Service Invoice** | Repair/Service charges | ₹5,000 (repair job) |

**What an Invoice contains:**
```
INVOICE NO: INV/2026/089
Date: 20-July-2026
Customer: ABC Construction

Items:
1. Mobile Crane Rental (5 days × ₹8,000) = ₹40,000
2. Hydraulic Oil Filter (2 × ₹850) = ₹1,700
3. Service Charges = ₹2,000
----------------------------------------
Subtotal: ₹43,700
GST (18%): ₹7,866
Total: ₹51,566
----------------------------------------
Status: Unpaid
```

**Workflow:**
```
Dashboard → Sales → Create Invoice → 
Select Customer → Add Items (Rental/Parts/Service) → 
Calculate GST → Save → Print Invoice → 
Send to Customer → Track Payment
```

---

## Module 9: Billing / POS - Counter Sales

**What it does:** Quick billing for walk-in customers who buy spare parts

**Your Business Use:**
When a customer walks into your shop to buy spare parts:
```
Customer walks in → "I need a Hydraulic Oil Filter"
You check stock → Available (₹850)
You create bill → Quick POS billing
Customer pays → Cash/Card/UPI
You give parts → Customer leaves
```

**Features:**
- Add items quickly by searching product name
- GST auto-calculated
- Multiple payment methods: Cash / Card / UPI / Credit
- Print bill instantly
- Daily sales summary

**Workflow:**
```
Dashboard → Billing/POS → Search Part → 
Add Quantity → Select Customer (optional) → 
Calculate → Take Payment → Print Bill
```

---

## Module 10: Purchases - Buying Stock

**What it does:** Record all your purchases from suppliers

**Your Business Use:**
When you buy spare parts or equipment from suppliers:
```
You order → 50 Hydraulic Oil Filters from Supplier
Supplier delivers → You receive goods
You record → Purchase Order in system
You pay → Supplier payment
Stock updates → Automatically added to inventory
```

**What you record:**

| Field | Example |
|-------|---------|
| Supplier | Tata Motors Ltd |
| Items | 50 × Hydraulic Oil Filter @ ₹600 |
| Total Amount | ₹30,000 |
| PO Number | PO/2026/045 |
| Status | Received |
| Payment | Pending |

**Purchase Status:**
```
📝 Pending - Order placed, not yet received
📦 Received - Goods received (GRN done)
❌ Cancelled - Order cancelled
```

**Workflow:**
```
Dashboard → Purchases → Create PO → 
Select Supplier → Add Items & Quantities → 
Save → When goods arrive → Mark Received → 
Stock auto-updates → Pay Supplier
```

---

## Module 11: Inventory - Spare Parts Stock

**What it does:** Track all your spare parts stock in real-time

**Your Business Use:**
You need to know at all times:
- How many Hydraulic Oil Filters are in stock?
- Which parts are running low?
- Where is the stock stored? (Main shop / Warehouse)

**What you see:**

| Product | Current Stock | Min Level | Status |
|---------|--------------|-----------|--------|
| Hydraulic Oil Filter | 45 | 10 | ✅ OK |
| Brake Pads Set | 3 | 10 | ⚠️ LOW STOCK |
| Forklift Tyre | 0 | 5 | ❌ OUT OF STOCK |
| Engine Oil 5L | 20 | 15 | ✅ OK |

**Features:**
- **Low Stock Alerts** - System warns when stock is low
- **Stock Transfer** - Move stock between warehouses
- **Stock Adjustment** - Add/remove stock (for damaged/lost items)
- **Multiple Warehouses** - Main Store + Branch Store

**Workflow:**
```
Dashboard → Inventory → View Stock → 
Check low stock items → Create Purchase Order → 
Or Transfer stock between locations
```

---

## Module 12: HR & Payroll - Your Staff

**What it does:** Manage your employees

**Your Business Use:**
Your staff includes:
```
👨‍🔧 Operators - Who drive cranes/forklifts on rental sites
👨‍🔧 Mechanics - Who do AMC service & repairs
👨‍💼 Office Staff - Who handle billing, customers, calls
👨‍💼 Managers - Who oversee operations
```

**Features:**
- Employee database (name, phone, salary, role)
- Attendance tracking (who is on site today?)
- Leave management
- Payroll & salary slips
- Department management

**Workflow:**
```
Dashboard → HR → Add Employee → 
Set Salary & Role → Track Attendance → 
Process Monthly Payroll
```

---

## Module 13: Projects - Job Work

**What it does:** Track specific jobs/projects

**Your Business Use:**
When you get a big contract that involves multiple things:
```
Example: ABC Construction needs for 1 month:
  • 1 Crane (25 Ton) on rent
  • 1 Forklift (5 Ton) on rent
  • Monthly AMC for both
  • Spare parts as needed

You create a PROJECT to track everything together
```

**Workflow:**
```
Dashboard → Projects → Create Project → 
Link Customer → Add Rentals/AMC/Parts → 
Track Progress → Complete
```

---

## Module 14: Documents - Records & Files

**What it does:** Store all important documents

**Your Business Use:**
```
📄 Rental Agreements - Signed contracts
📄 AMC Contracts - Signed maintenance agreements
📄 Insurance Papers - Equipment insurance
📄 GST Returns - Filed returns
📄 Purchase Invoices - From suppliers
📄 Equipment Manuals - PDF manuals
📄 Customer PO - Purchase orders from customers
```

**Workflow:**
```
Dashboard → Documents → Upload File → 
Name it → Categorize → Link to Customer/Equipment → 
Access anytime
```

---

## Module 15: Finance & Accounting

**What it does:** Complete financial management

**Your Business Income Sources:**
```
💰 Rental Income - From equipment rentals
💰 AMC Income - From maintenance contracts
💰 Parts Sales - From spare parts sales
💰 Service Income - From repair jobs
```

**Your Business Expenses:**
```
📤 Supplier Payments - For spare parts purchase
📤 Employee Salaries - Staff wages
📤 Equipment Maintenance - Your own repair costs
📤 Fuel & Transport - For delivering equipment
📤 Rent & Utilities - Office/warehouse rent
📤 Insurance - Equipment insurance premiums
```

**Features:**
- Track all income & expenses
- Accounts Receivable (who owes you money)
- Accounts Payable (who you need to pay)
- Bank reconciliation
- **GST Filing** - Auto-calculated for returns
- Profit & Loss statement

**Workflow:**
```
Dashboard → Finance → 
Record Income (Rental/AMC/Parts) → 
Record Expenses → 
View P&L → File GST
```

---

## Module 16: Reports & Analytics

**What it does:** See how your business is performing

**Reports you will use most:**

| Report | What it Shows | Why Important |
|--------|---------------|---------------|
| 📊 **Rental Report** | Which equipment rented most, revenue | Know which cranes/forklifts are most profitable |
| 📊 **AMC Report** | Active contracts, renewals due | Don't miss contract renewals |
| 📊 **Stock Report** | Low stock, fast-moving parts | Never run out of important parts |
| 📊 **Customer Report** | Top customers, outstanding payments | Follow up on payments |
| 📊 **Sales Report** | Daily/monthly sales trend | Track business growth |
| 📊 **GST Report** | Tax collected & paid | Easy GST filing |
| 📊 **P&L Statement** | Profit or Loss | Know if business is profitable |

**Workflow:**
```
Dashboard → Reports → Select Report → 
Set Date Range → View Charts → 
Export to PDF/Excel → Share with management
```

---

## Module 17: Branch Management

**What it does:** Manage multiple business locations

**Your Business Use:**
If you have multiple branches:
```
🏢 Main Office - Noida (Head Office)
🏢 Branch 1 - Ghaziabad (Rental Yard)
🏢 Branch 2 - Delhi (Spare Parts Shop)
🏢 Branch 3 - Gurgaon (Service Center)
```

**Features:**
- Each branch can have its own stock
- Rentals can be managed branch-wise
- Reports can be seen per branch or combined
- Switch branch from sidebar

**Workflow:**
```
Dashboard → Branches → Add Branch → 
Select Branch from dropdown → 
Work with that branch's data
```

---

## Module 18: User Management

**What it does:** Control who can access what

**Your Business Users:**

| Role | Who | What They Can Do |
|------|-----|------------------|
| 👑 **Admin** | Owner/Director | Everything - full access |
| 👔 **Manager** | Branch Manager | Create rentals, AMC, sales, view reports |
| 👨‍💼 **Staff** | Office Staff | Create records, billing, but cannot delete |
| 👨‍🔧 **Operator** | Crane/Forklift Driver | View assigned rentals only |

**Workflow:**
```
Dashboard → Users → Add User → 
Set Name, Email, Password → 
Assign Role (Admin/Manager/Staff) → 
User can login with their access
```

---

## Module 19: Settings

**What it does:** Configure your company details

**What you set up:**

| Setting | What to Enter |
|---------|---------------|
| Company Name | Your Company Name |
| Logo | Upload your company logo |
| Address | Your office address |
| GSTIN | Your GST number |
| PAN | Your PAN number |
| Phone | Your contact number |
| Email | Your email |
| Invoice Prefix | INV/2026/ (auto for invoices) |
| Tax Rates | Set GST rates (5%, 12%, 18%, 28%) |

**Workflow:**
```
Dashboard → Settings → Enter Company Details → 
Set Preferences → System Ready for Use
```

---

## 🔄 Complete Business Flow Diagram

```
                    ┌─────────────────────────────┐
                    │         LOGIN               │
                    │   (Admin / Manager / Staff) │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │         DASHBOARD           │
                    │  ┌───────────────────────┐  │
                    │  │ TODAY'S BUSINESS      │  │
                    │  │ • 12 Rentals Active   │  │
                    │  │ • 45 AMC Contracts    │  │
                    │  │ • ₹12,500 Parts Sold  │  │
                    │  │ • ₹8,45,000 Revenue   │  │
                    │  └───────────────────────┘  │
                    └─────────────┬───────────────┘
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    │                             │                             │
    ▼                             ▼                             ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  MASTER DATA     │   │  TRANSACTIONS    │   │  OPERATIONS      │
│                  │   │                  │   │                  │
│  ┌────────────┐  │   │  ┌────────────┐  │   │  ┌────────────┐  │
│  │ PRODUCTS   │  │   │  │ SALES      │  │   │  │ RENTALS    │  │
│  │ (Spare     │  │   │  │ (Invoices) │  │   │  │ (Crane/    │  │
│  │  Parts)    │  │   │  └────────────┘  │   │  │  Forklift) │  │
│  └────────────┘  │   │  ┌────────────┐  │   │  └────────────┘  │
│  ┌────────────┐  │   │  │ BILLING/   │  │   │  ┌────────────┐  │
│  │ CUSTOMERS  │  │   │  │ POS        │  │   │  │ AMC        │  │
│  │ (Contract- │  │   │  │ (Counter   │  │   │  │ (Mainten-  │  │
│  │  ors)      │  │   │  │  Sales)    │  │   │  │  ance)     │  │
│  └────────────┘  │   │  └────────────┘  │   │  └────────────┘  │
│  ┌────────────┐  │   │  ┌────────────┐  │   │  ┌────────────┐  │
│  │ SUPPLIERS  │  │   │  │ PURCHASES  │  │   │  │ INVENTORY  │  │
│  │ (Vendors)  │  │   │  │ (Buy Stock)│  │   │  │ (Stock     │  │
│  └────────────┘  │   │  └────────────┘  │   │  │  Control)  │  │
│  ┌────────────┐  │   │                  │   │  └────────────┘  │
│  │ EQUIPMENT  │  │   │                  │   │  ┌────────────┐  │
│  │ (Cranes &  │  │   │                  │   │  │ HR/STAFF   │  │
│  │  Forklifts)│  │   │                  │   │  └────────────┘  │
│  └────────────┘  │   │                  │   │  ┌────────────┐  │
│                  │   │                  │   │  │ PROJECTS   │  │
│                  │   │                  │   │  └────────────┘  │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   FINANCE & ACCOUNTS  │
                    │                       │
                    │  INCOME:              │
                    │  • Rental Income      │
                    │  • AMC Income         │
                    │  • Parts Sales        │
                    │  • Service Income     │
                    │                       │
                    │  EXPENSES:            │
                    │  • Supplier Payments  │
                    │  • Salaries           │
                    │  • Maintenance        │
                    │  • Fuel/Transport     │
                    │  • Rent/Utilities     │
                    │  • Insurance          │
                    │                       │
                    │  • GST Filing         │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   REPORTS             │
                    │                       │
                    │  📊 Rental Report     │
                    │  📊 AMC Report        │
                    │  📊 Stock Report      │
                    │  📊 Customer Report   │
                    │  📊 Sales Report      │
                    │  📊 GST Report        │
                    │  📊 P&L Statement     │
                    └───────────────────────┘
```

---

## 📊 Quick Summary Table

| # | Module | What It Does For Your Business |
|---|--------|-------------------------------|
| 1 | **Login** | Secure access for staff |
| 2 | **Dashboard** | See business status at a glance |
| 3 | **Products** | Manage spare parts catalog |
| 4 | **Customers** | Store client information |
| 5 | **Suppliers** | Manage vendors |
| 6 | **Equipment** | Register cranes & forklifts |
| 7 | **Rentals** | Manage equipment on hire |
| 8 | **AMC** | Maintenance contracts |
| 9 | **Sales** | Create invoices |
| 10 | **Billing/POS** | Quick counter billing |
| 11 | **Purchases** | Buy stock from suppliers |
| 12 | **Inventory** | Track spare parts stock |
| 13 | **HR** | Manage employees |
| 14 | **Projects** | Track big jobs |
| 15 | **Documents** | Store files & contracts |
| 16 | **Finance** | Accounting & GST |
| 17 | **Reports** | Business analytics |
| 18 | **Branches** | Multi-location management |
| 19 | **Users** | Staff access control |
| 20 | **Settings** | Company configuration |

---

## ✅ Key Benefits For Your Business

### 🏗️ For Rentals:
- Know which cranes/forklifts are available right now
- Track which customer has which equipment
- Auto-calculate rental charges
- Get alerts when rental is overdue
- Generate rental invoices automatically

### 🔧 For Spare Parts:
- Know stock levels in real-time
- Get alerts when parts are running low
- Quick billing for walk-in customers
- Track which parts sell the most

### 📋 For AMC:
- Track all maintenance contracts
- Get alerts for service due dates
- Know when contracts are expiring
- Auto-generate renewal invoices

### 💰 For Finance:
- See total income from rentals + AMC + parts
- Track who hasn't paid yet
- Easy GST filing
- Know if business is profitable

---

## 📝 Notes

- All modules are **connected** - when you create a rental, it automatically updates equipment status, creates an invoice, and records in finance
- The system is **customizable** for your specific crane & forklift business needs
- **Training** can be provided to your staff
- **Support** available for any issues

---

*SmartGoNext Universal ERP - Tailored for Crane & Forklift Rental Business*
*For questions or demo, contact our team*

---

> **Document Version:** 1.0
> **Last Updated:** July 2026
> **Prepared For:** [Client Company Name]