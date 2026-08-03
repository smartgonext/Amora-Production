import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiGrid, FiPackage, FiUsers, FiShoppingCart, FiDollarSign, FiSettings,
  FiFileText, FiTruck, FiTool, FiCalendar, FiBarChart2, FiShield,
  FiBriefcase, FiFolder, FiFile, FiMapPin, FiUser, FiLogIn,
  FiChevronDown, FiChevronUp, FiArrowRight, FiHome, FiLayers,
  FiDatabase, FiMonitor, FiPrinter, FiDownload, FiStar
} from 'react-icons/fi';

const modules = [
  {
    id: 'login',
    title: '1. Login & Authentication',
    icon: FiLogIn,
    color: 'from-blue-500 to-indigo-600',
    description: 'Secure access to the ERP system',
    details: [
      'User login with email & password',
      'Role-based access control (Admin, Manager, Staff)',
      'Superadmin platform management',
      'Multi-tenant architecture - each company has separate data',
      'Session management & security'
    ],
    workflow: 'User → Login → Dashboard (based on role)'
  },
  {
    id: 'dashboard',
    title: '2. Dashboard',
    icon: FiGrid,
    color: 'from-emerald-400 to-teal-600',
    description: 'Central command center - overview of your business',
    details: [
      'Real-time business KPIs: Sales Revenue, Customer Count, Products, Invoices',
      'Revenue Pipeline chart - monthly sales trend visualization',
      'Weekly Activity Volume - check-ins & bookings bar chart',
      'Pinned Favourites - quick access to frequently used pages',
      'Recently Used Records - last accessed customers, invoices, projects',
      'Personal Reminders - sticky notes for daily tasks',
      'Quick Calculator tool for on-the-spot calculations',
      'System notifications & alerts banner'
    ],
    workflow: 'Login → Dashboard → View KPIs → Navigate to any module'
  },
  {
    id: 'products',
    title: '3. Products Management',
    icon: FiPackage,
    color: 'from-purple-500 to-violet-700',
    description: 'Manage your product & service catalog',
    details: [
      'Add new products with SKU, HSN code, GST rate',
      'Set purchase price & selling price',
      'Track minimum stock level & opening stock',
      'Search & filter products by name/SKU',
      'Edit product details, activate/deactivate products',
      'Delete products with confirmation',
      'View product details in a modal'
    ],
    workflow: 'Dashboard → Products → Add/Edit/View Products → Inventory updates'
  },
  {
    id: 'customers',
    title: '4. Customers',
    icon: FiUsers,
    color: 'from-sky-400 to-blue-600',
    description: 'Complete customer relationship management',
    details: [
      'Add new customers with contact details (phone, email, address)',
      'GSTIN & PAN registration for tax compliance',
      'Set credit limit & credit period for each customer',
      'Search customers by name, phone, or email',
      'View complete customer profile with all details',
      'Edit & update customer information',
      'Delete customer records with safety confirmation',
      'Filter by active/inactive status'
    ],
    workflow: 'Dashboard → Customers → Add/View/Edit Customers → Link to Sales & Billing'
  },
  {
    id: 'suppliers',
    title: '5. Suppliers',
    icon: FiTruck,
    color: 'from-amber-400 to-orange-600',
    description: 'Supplier & vendor management',
    details: [
      'Add suppliers with company details & contact info',
      'GSTIN & PAN registration for compliance',
      'Track supplier payment terms & credit limits',
      'Search & filter suppliers',
      'View supplier profiles with complete details',
      'Edit & update supplier information',
      'Link suppliers to purchase orders'
    ],
    workflow: 'Dashboard → Suppliers → Add Suppliers → Create Purchase Orders'
  },
  {
    id: 'sales',
    title: '6. Sales & Invoicing',
    icon: FiShoppingCart,
    color: 'from-green-400 to-emerald-600',
    description: 'Sales management with quotations & invoices',
    details: [
      'Create & manage sales invoices',
      'Generate quotations for customers',
      'View invoice details with line items',
      'Print invoices directly',
      'Track payment status (Paid/Unpaid/Partial)',
      'Search invoices by number or customer name',
      'Create new invoices with customer selection',
      'Invoice history & tracking'
    ],
    workflow: 'Dashboard → Sales → Create Invoice/Quotation → Customer → Payment → Finance'
  },
  {
    id: 'purchases',
    title: '7. Purchases',
    icon: FiDollarSign,
    color: 'from-rose-400 to-red-600',
    description: 'Purchase order & procurement management',
    details: [
      'Create purchase orders to suppliers',
      'Goods Receipt Notes (GRN) for received items',
      'Track purchase order status (Pending/Received/Cancelled)',
      'View purchase details with amounts',
      'Search purchases by PO number or supplier',
      'Link purchases to inventory stock updates',
      'Supplier payment tracking'
    ],
    workflow: 'Dashboard → Purchases → Create PO → Supplier → GRN → Inventory Update → Payment'
  },
  {
    id: 'inventory',
    title: '8. Inventory & Warehouse',
    icon: FiTool,
    color: 'from-cyan-400 to-teal-600',
    description: 'Stock management across warehouses',
    details: [
      'View current stock levels for all products',
      'Multiple warehouse management',
      'Stock adjustments (add/subtract with reason)',
      'Transfer stock between warehouses',
      'Low stock alerts & warnings',
      'Search products in inventory',
      'Filter by stock status (all, low stock, out of stock)',
      'Stock movement history'
    ],
    workflow: 'Dashboard → Inventory → Stock View → Adjust/Transfer → Warehouse Updates'
  },
  {
    id: 'equipment',
    title: '9. Equipment',
    icon: FiTruck,
    color: 'from-indigo-400 to-indigo-700',
    description: 'Equipment & asset tracking',
    details: [
      'Register new equipment with serial numbers',
      'Track equipment status (Available/Rented/Maintenance)',
      'Equipment specifications & documentation',
      'Search & filter equipment',
      'Link equipment to rentals & AMC contracts',
      'Maintenance schedule tracking',
      'Equipment history & usage records'
    ],
    workflow: 'Dashboard → Equipment → Add Equipment → Link to Rentals/AMC → Maintenance'
  },
  {
    id: 'rentals',
    title: '10. Rentals',
    icon: FiCalendar,
    color: 'from-pink-400 to-rose-600',
    description: 'Equipment rental management',
    details: [
      'Create rental agreements for equipment',
      'Track rental start & end dates',
      'Calculate rental charges automatically',
      'View rental status (Active/Completed/Overdue)',
      'Link rentals to customers & equipment',
      'Rental payment tracking',
      'Rental extension & return processing'
    ],
    workflow: 'Dashboard → Rentals → Create Rental → Customer Equipment → Return → Invoice'
  },
  {
    id: 'amc',
    title: '11. AMC Contracts',
    icon: FiSettings,
    color: 'from-violet-400 to-purple-700',
    description: 'Annual Maintenance Contract management',
    details: [
      'Create AMC contracts for equipment',
      'Set contract start & end dates',
      'Track contract renewal dates',
      'AMC service schedule management',
      'Link AMC to customers & equipment',
      'Contract value & payment tracking',
      'Expiry alerts & renewals'
    ],
    workflow: 'Dashboard → AMC → Create Contract → Customer Equipment → Service Schedule → Renewal'
  },
  {
    id: 'hr',
    title: '12. HR & Payroll',
    icon: FiBriefcase,
    color: 'from-blue-400 to-indigo-600',
    description: 'Human resources & employee management',
    details: [
      'Employee database management',
      'Attendance tracking & reporting',
      'Leave management system',
      'Payroll processing & salary slips',
      'Department & designation management',
      'Employee document management',
      'HR reports & analytics'
    ],
    workflow: 'Dashboard → HR → Employees → Attendance → Leave → Payroll → Reports'
  },
  {
    id: 'projects',
    title: '13. Projects',
    icon: FiFolder,
    color: 'from-teal-400 to-green-600',
    description: 'Project planning & tracking',
    details: [
      'Create & manage projects',
      'Track project status & progress',
      'Assign team members to projects',
      'Project budget & cost tracking',
      'Milestone & deadline management',
      'Link projects to customers & documents',
      'Project completion & closure'
    ],
    workflow: 'Dashboard → Projects → Create Project → Assign Team → Track Progress → Complete'
  },
  {
    id: 'documents',
    title: '14. Documents',
    icon: FiFile,
    color: 'from-yellow-400 to-amber-600',
    description: 'Document management & storage',
    details: [
      'Upload & store business documents',
      'Organize documents by categories',
      'Search documents by name or type',
      'Preview documents online',
      'Download documents',
      'Link documents to customers, projects, etc.',
      'Document version tracking'
    ],
    workflow: 'Dashboard → Documents → Upload → Categorize → Link to Records → Access Anywhere'
  },
  {
    id: 'billing',
    title: '15. Billing / POS',
    icon: FiFileText,
    color: 'from-orange-400 to-red-600',
    description: 'Point of Sale & billing system',
    details: [
      'Quick billing interface for counter sales',
      'Add products to bill with quantity & price',
      'Customer selection for billing',
      'GST calculation & tax breakdown',
      'Multiple payment methods (Cash/Card/UPI/Credit)',
      'Print bills & invoices',
      'Discount & offer management',
      'Billing history & daily sales summary'
    ],
    workflow: 'Dashboard → Billing/POS → Select Customer → Add Items → Calculate → Payment → Print Bill'
  },
  {
    id: 'finance',
    title: '16. Finance & Accounting',
    icon: FiBarChart2,
    color: 'from-emerald-400 to-green-600',
    description: 'Complete financial management',
    details: [
      'Chart of Accounts management',
      'Journal entries & voucher management',
      'Expense tracking & categorization',
      'Payment & receipt management',
      'Bank reconciliation',
      'Accounts Receivable & Payable tracking',
      'Profit & Loss overview',
      'Balance sheet & financial reports',
      'GST filing & tax management'
    ],
    workflow: 'Dashboard → Finance → Accounts → Vouchers → Expenses → Reports → GST Filing'
  },
  {
    id: 'reports',
    title: '17. Reports & Analytics',
    icon: FiBarChart2,
    color: 'from-indigo-400 to-blue-600',
    description: 'Business intelligence & reporting',
    details: [
      'Sales reports with trend analysis',
      'Product-wise sales performance',
      'Customer-wise sales reports',
      'Purchase reports & supplier analysis',
      'Inventory valuation reports',
      'Financial reports (P&L, Balance Sheet)',
      'GST reports for tax filing',
      'Export reports to PDF/Excel',
      'Date range filtering for all reports',
      'Visual charts & graphs for data analysis'
    ],
    workflow: 'Dashboard → Reports → Select Report Type → Set Date Range → View Analytics → Export'
  },
  {
    id: 'branches',
    title: '18. Branch Management',
    icon: FiMapPin,
    color: 'from-sky-400 to-blue-600',
    description: 'Multi-branch business management',
    details: [
      'Add & manage multiple business branches',
      'Branch-wise data segregation',
      'Select branch from sidebar for focused view',
      'Branch-specific reporting',
      'Centralized management across branches',
      'Branch performance comparison'
    ],
    workflow: 'Dashboard → Branches → Add Branch → Select Branch → Branch-specific Operations'
  },
  {
    id: 'users',
    title: '19. User Management',
    icon: FiUser,
    color: 'from-gray-500 to-gray-700',
    description: 'User accounts & permissions',
    details: [
      'Add & manage system users',
      'Role-based access control',
      'Assign roles & permissions',
      'User activity tracking',
      'User profile management',
      'Password & security settings'
    ],
    workflow: 'Dashboard → Users → Add User → Assign Role → Set Permissions → User Active'
  },
  {
    id: 'settings',
    title: '20. Settings & Configuration',
    icon: FiSettings,
    color: 'from-slate-500 to-slate-700',
    description: 'System configuration & preferences',
    details: [
      'Company profile & branding setup',
      'Business information & contact details',
      'Tax configuration (GST rates, HSN codes)',
      'Invoice & document templates',
      'Email & notification settings',
      'Backup & data management',
      'System preferences & defaults'
    ],
    workflow: 'Dashboard → Settings → Configure Company → Set Preferences → System Ready'
  }
];

const systemFlow = [
  { step: 'User Login', icon: FiLogIn, desc: 'Secure authentication' },
  { step: 'Dashboard', icon: FiHome, desc: 'Business overview & KPIs' },
  { step: 'Master Data', icon: FiDatabase, desc: 'Products, Customers, Suppliers' },
  { step: 'Transactions', icon: FiLayers, desc: 'Sales, Purchases, Billing' },
  { step: 'Operations', icon: FiMonitor, desc: 'Inventory, Rentals, AMC, HR' },
  { step: 'Finance', icon: FiDollarSign, desc: 'Accounting & Reports' },
];

export default function WorkflowReportPage() {
  const [expandedModule, setExpandedModule] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleModule = (id) => {
    setExpandedModule(expandedModule === id ? null : id);
  };

  const filteredModules = modules.filter(mod =>
    mod.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mod.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 p-8 shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(99,102,241,0.2),transparent)] pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl">
              <FiLayers className="text-3xl text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">ERP System Workflow Report</h1>
              <p className="text-slate-300 text-sm mt-1">Complete guide to understand how the ERP system works - module by module</p>
            </div>
          </div>
          
          {/* System Overview Flow */}
          <div className="mt-6 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <FiArrowRight className="text-indigo-400" /> System Flow Overview
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {systemFlow.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-xs text-white">
                    <item.icon className="text-indigo-400" />
                    <span>{item.step}</span>
                  </div>
                  {idx < systemFlow.length - 1 && (
                    <FiArrowRight className="text-slate-500 text-xs" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search modules..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
        />
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredModules.map((mod, index) => (
          <motion.div
            key={mod.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            {/* Module Header */}
            <button
              onClick={() => toggleModule(mod.id)}
              className="w-full p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${mod.color} text-white shadow-md`}>
                  <mod.icon className="text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-base">{mod.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{mod.description}</p>
                </div>
              </div>
              <div className="text-slate-400">
                {expandedModule === mod.id ? <FiChevronUp /> : <FiChevronDown />}
              </div>
            </button>

            {/* Expanded Details */}
            <AnimatePresence>
              {expandedModule === mod.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-0 border-t border-slate-100 dark:border-slate-800">
                    {/* Workflow */}
                    <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
                        <FiArrowRight /> Workflow Path
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                        {mod.workflow}
                      </p>
                    </div>

                    {/* Features List */}
                    <div className="mt-3 space-y-2">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Key Features</h4>
                      {mod.details.map((detail, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Summary Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-xl p-6 border border-indigo-100 dark:border-indigo-900/50">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <FiStar className="text-amber-500" /> System Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-indigo-600">{modules.length}</div>
            <div className="text-xs text-slate-500 mt-1">Total Modules</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-emerald-600">3</div>
            <div className="text-xs text-slate-500 mt-1">User Roles</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-amber-600">Multi</div>
            <div className="text-xs text-slate-500 mt-1">Branch Support</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-rose-600">GST</div>
            <div className="text-xs text-slate-500 mt-1">Tax Compliant</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-4 border-t border-slate-100 dark:border-slate-800">
        <p>SmartGoNext Universal ERP - Complete Business Management Solution</p>
        <p className="mt-1">This report provides an overview of all system modules and their workflows</p>
      </div>
    </div>
  );
}