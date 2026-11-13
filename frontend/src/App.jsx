import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useContext } from 'react';
import { useAuth } from './context/AuthContext';
import { useManufacturingConfig } from './hooks/useManufacturingConfig';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import SetupWizardPage from './pages/setup/SetupWizardPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CustomersPage from './pages/customers/CustomersPage';
import ProductsPage from './pages/products/ProductsPage';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import BillingPage from './pages/pos/BillingPage';
import SalesListPage from './pages/sales/SalesListPage';
import PurchasesPage from './pages/purchases/PurchasesPage';
import InventoryPage from './pages/inventory/InventoryPage';
import FinancePage from './pages/finance/FinancePage';
import ReportsPage from './pages/reports/ReportsPage';
import SettingsPage from './pages/settings/SettingsPage';
import HrPage from './pages/hr/HrPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import EquipmentPage from './pages/equipment/EquipmentPage';
import BomDesignerPage from './pages/manufacturing/BomDesigner';
import RawMaterialsPage from './pages/manufacturing/RawMaterialsPage';
import MrpPlanningPage from './pages/manufacturing/MrpPlanningPage';
import WorkOrderBoard from './pages/manufacturing/WorkOrderBoard';
import JobWorkPage from './pages/manufacturing/JobWorkPage';
import QcInspectionPage from './pages/manufacturing/QcInspectionPage';
import RecipeScaler from './pages/manufacturing/RecipeScaler';
import BakePlanner from './pages/manufacturing/BakePlanner';
import FreshReturnPage from './pages/manufacturing/FreshReturnPage';
import BakeryQC from './pages/manufacturing/BakeryQC';
import DayCostReport from './pages/manufacturing/DayCostReport';
import CakeOrdersPage from './pages/manufacturing/CakeOrdersPage';
import RentalsPage from './pages/rentals/RentalsPage';
import AmcPage from './pages/amc/AmcPage';
import BranchesPage from './pages/branches/BranchesPage';
import UsersPage from './pages/users/UsersPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import TenantDetailPage from './pages/admin/TenantDetailPage';
import LandingPage from './pages/LandingPage';
import KeyboardShortcutManager from './components/common/KeyboardShortcutManager';
import EnterToNextNav from './components/common/EnterToNextNav';
import { Toaster } from 'react-hot-toast';

// Context for sharing collapsed state between Sidebar and main layout
import { createContext } from 'react';
export const SidebarContext = createContext({ collapsed: false });

function ProtectedLayout({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  // Persist collapse preference
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', collapsed.toString());
  }, [collapsed]);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Sidebar />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-64'
          }`}>
          <Navbar />
          <main className="flex-1 overflow-y-auto p-6 pt-20 bg-gray-50 dark:bg-gray-900">
            {children}
          </main>
        </div>
        <KeyboardShortcutManager />
      </div>
    </SidebarContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

function SuperadminRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.is_superadmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function P(Page) {
  return (
    <ProtectedRoute>
      <ProtectedLayout>
        <Page />
      </ProtectedLayout>
    </ProtectedRoute>
  );
}

function ManufacturingRoute({ children }) {
  const { config, isLoading } = useManufacturingConfig();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }
  if (!config) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function PM(Page) {
  return (
    <ProtectedRoute>
      <ManufacturingRoute>
        <ProtectedLayout>
          <Page />
        </ProtectedLayout>
      </ManufacturingRoute>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <EnterToNextNav />
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        {/* Setup (protected, no sidebar) */}
        <Route path="/setup" element={<ProtectedRoute><SetupWizardPage /></ProtectedRoute>} />

        {/* Core ERP */}
        <Route path="/dashboard" element={P(DashboardPage)} />
        <Route path="/products" element={P(ProductsPage)} />
        <Route path="/customers" element={P(CustomersPage)} />
        <Route path="/suppliers" element={P(SuppliersPage)} />
        <Route path="/sales" element={P(SalesListPage)} />
        <Route path="/purchases" element={P(PurchasesPage)} />
        <Route path="/inventory" element={P(InventoryPage)} />
        <Route path="/billing" element={P(BillingPage)} />
        <Route path="/finance" element={P(FinancePage)} />
        <Route path="/reports" element={P(ReportsPage)} />
        <Route path="/hr" element={P(HrPage)} />
        <Route path="/projects" element={P(ProjectsPage)} />
        <Route path="/documents" element={P(DocumentsPage)} />
        <Route path="/equipment" element={P(EquipmentPage)} />
        <Route path="/manufacturing/materials" element={PM(RawMaterialsPage)} />
        <Route path="/manufacturing/purchases" element={PM(PurchasesPage)} />
        <Route path="/manufacturing/bom" element={PM(BomDesignerPage)} />
        <Route path="/manufacturing/mrp" element={PM(MrpPlanningPage)} />
        <Route path="/manufacturing/work-orders" element={PM(WorkOrderBoard)} />
        <Route path="/manufacturing/job-work" element={PM(JobWorkPage)} />
        <Route path="/manufacturing/qc" element={PM(QcInspectionPage)} />
        <Route path="/manufacturing/recipe-scaler" element={PM(RecipeScaler)} />
        <Route path="/manufacturing/bake-planner" element={PM(BakePlanner)} />
        <Route path="/manufacturing/fresh-returns" element={PM(FreshReturnPage)} />
        <Route path="/manufacturing/bakery-qc" element={PM(BakeryQC)} />
        <Route path="/manufacturing/cake-orders" element={PM(CakeOrdersPage)} />
        <Route path="/manufacturing/day-cost" element={PM(DayCostReport)} />
        <Route path="/rentals" element={P(RentalsPage)} />
        <Route path="/amc" element={P(AmcPage)} />
        <Route path="/settings" element={P(SettingsPage)} />

        {/* Multi-branch & user management */}
        <Route path="/branches" element={P(BranchesPage)} />
        <Route path="/users" element={P(UsersPage)} />

        {/* Superadmin */}
        <Route path="/admin" element={
          <SuperadminRoute><ProtectedLayout><AdminDashboardPage /></ProtectedLayout></SuperadminRoute>
        } />
        <Route path="/admin/tenants/:tenantId" element={
          <SuperadminRoute><ProtectedLayout><TenantDetailPage /></ProtectedLayout></SuperadminRoute>
        } />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
