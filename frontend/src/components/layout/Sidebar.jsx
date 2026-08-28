import { NavLink } from 'react-router-dom';
import { useContext } from 'react';
import {
  FiGrid, FiPackage, FiUsers, FiShoppingCart, FiDollarSign, FiSettings,
  FiFileText, FiTruck, FiTool, FiCalendar, FiBarChart2, FiLogOut, FiShield,
  FiBriefcase, FiFolder, FiFile, FiChevronLeft, FiChevronRight, FiMapPin,
  FiUser, FiLayers, FiCpu, FiBox, FiCheckCircle
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { SidebarContext } from '../../App';
import { useCatalogSettings } from '../../hooks/useCatalogSettings';
import { useManufacturingConfig, buildManufacturingMenu } from '../../hooks/useManufacturingConfig';
import { useUiConfig } from '../../hooks/useUiConfig';
import ThemeToggle from '../common/ThemeToggle';

// Each top-level nav item is tied to a module code so the Sidebar can be
// filtered by the company's business type (Company-Type driven gating).
const menuItems = [
  { path: '/dashboard',  label: 'Dashboard',     icon: FiGrid,        module: 'dashboard' },
  { path: '/products',   label: 'Products',       icon: FiPackage,     module: 'products' },
  { path: '/customers',  label: 'Customers',      icon: FiUsers,       module: 'customers' },
  { path: '/suppliers',  label: 'Suppliers',      icon: FiTruck,       module: 'suppliers' },
  { path: '/sales',      label: 'Sales',          icon: FiShoppingCart, module: 'sales' },
  { path: '/purchases',  label: 'Purchases',      icon: FiDollarSign,  module: 'purchases' },
  { path: '/inventory',  label: 'Inventory',      icon: FiTool,        module: 'inventory' },
  { path: '/equipment',  label: 'Equipment',      icon: FiTruck,       module: 'equipment' },
  { path: '/rentals',    label: 'Rentals',        icon: FiCalendar,    module: 'rentals' },
  { path: '/amc',        label: 'AMC Contracts',  icon: FiSettings,    module: 'amc' },
  { path: '/hr',         label: 'HR / Payroll',   icon: FiBriefcase,   module: 'hr' },
  { path: '/projects',   label: 'Projects',       icon: FiFolder,      module: 'projects' },
  { path: '/documents',  label: 'Documents',      icon: FiFile,        module: 'documents' },
  { path: '/billing',    label: 'Billing / POS',  icon: FiFileText,    module: 'billing' },
  { path: '/finance',    label: 'Finance',        icon: FiBarChart2,   module: 'finance' },
  { path: '/reports',    label: 'Reports',        icon: FiCalendar,    module: 'reports' },
];

const adminMenuItems = [
  { path: '/branches', label: 'Branches', icon: FiMapPin },
  { path: '/users',    label: 'Users',    icon: FiUser },
  { path: '/settings', label: 'Settings', icon: FiSettings },
];

const manufacturingMenuItems = [
  { path: '/manufacturing/materials',    label: 'Raw Materials', icon: FiPackage },
  { path: '/manufacturing/purchases',    label: 'Raw Material Purchases', icon: FiDollarSign },
  { path: '/manufacturing/bom',          label: 'BOM & Routing', icon: FiLayers },
  { path: '/manufacturing/work-orders',  label: 'Work Orders',   icon: FiCpu },
  { path: '/manufacturing/mrp',          label: 'MRP / Shortage', icon: FiBox },
  { path: '/manufacturing/job-work',     label: 'Job Work',      icon: FiTruck },
  { path: '/manufacturing/qc',           label: 'Quality Control', icon: FiCheckCircle },
];

export default function Sidebar() {
  const { logout, user } = useAuth();
  const { company, branches, selectedBranch, selectBranch } = useCompany();
  const { catalogLabel } = useCatalogSettings();
  const { config: mfgConfig } = useManufacturingConfig();
  const { isModuleEnabled } = useUiConfig();
  const { collapsed, setCollapsed } = useContext(SidebarContext);

  const navClass = (isActive) =>
    `flex items-center ${collapsed ? 'justify-center px-0' : 'space-x-3 px-3'} py-2.5 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-primary-600 text-white'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <aside
      className={`${
        collapsed ? 'w-20' : 'w-64'
      } bg-sidebar-light dark:bg-sidebar-dark text-white flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300 shadow-xl`}
    >
      {/* ── Company Header ── */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0">
        {/* Logo + name row (expanded) */}
        {!collapsed && (
          <div className="flex items-center space-x-3 mb-3 min-w-0">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0">
                {company?.name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold truncate leading-tight">
                {company?.name || 'SmartGoNext'}
              </p>
              <p className="text-xs text-gray-400 truncate">Universal ERP</p>
            </div>
          </div>
        )}

        {/* Logo icon only (collapsed) */}
        {collapsed && (
          <div className="flex justify-center mb-3">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-10 h-10 rounded-lg object-cover"
                title={company.name}
              />
            ) : (
              <div
                className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center font-bold text-lg"
                title={company?.name || 'SmartGoNext'}
              >
                {company?.name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
            )}
          </div>
        )}

        {/* Controls row: theme toggle + collapse button */}
        <div className={`flex items-center ${collapsed ? 'justify-center space-x-2' : 'justify-between'}`}>
          <ThemeToggle />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <FiChevronRight className="w-4 h-4" />
              : <FiChevronLeft className="w-4 h-4" />
            }
          </button>
        </div>

        {/* Branch selector (expanded only) */}
        {!collapsed && branches.length > 0 && (
          <div className="mt-3">
            <select
              value={selectedBranch || ''}
              onChange={(e) => selectBranch(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {menuItems
          .filter((item) => isModuleEnabled(item.module))
          .map((item) => {
          const displayLabel = item.path === '/products' ? catalogLabel : item.label;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? displayLabel : undefined}
              className={({ isActive }) => navClass(isActive)}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{displayLabel}</span>}
            </NavLink>
          );
        })}

        {/* Manufacturing section (adaptive to tenant config + business type) */}
        {isModuleEnabled('manufacturing') && (() => {
          const mfgItems = buildManufacturingMenu(mfgConfig, manufacturingMenuItems);
          if (mfgItems.length === 0) return null;
          return (
            <div className="pt-2 mt-2 border-t border-gray-700">
              {!collapsed && (
                <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Manufacturing {mfgConfig ? `• ${mfgConfig.mfg_type}` : ''}
                </p>
              )}
              {mfgItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => navClass(isActive)}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          );
        })()}

        {/* Admin section */}
        <div className="pt-2 mt-2 border-t border-gray-700">
          {!collapsed && (
            <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Admin
            </p>
          )}
          {adminMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => navClass(isActive)}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Superadmin */}
        {user?.is_superadmin && (
          <div className="pt-2 mt-2 border-t border-gray-700">
            {!collapsed && (
              <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Platform
              </p>
            )}
            <NavLink
              to="/admin"
              title={collapsed ? 'Admin Panel' : undefined}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center px-0' : 'space-x-3 px-3'} py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-indigo-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <FiShield className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Admin Panel</span>}
            </NavLink>
          </div>
        )}
      </nav>

      {/* ── User info + Logout ── */}
      <div className="p-3 border-t border-gray-700 flex-shrink-0">
        {!collapsed && user && (
          <div className="flex items-center space-x-2 px-3 mb-2">
            <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-200 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.role || user.role_name}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={`flex items-center ${
            collapsed ? 'justify-center w-full' : 'space-x-3 px-3 w-full'
          } py-2.5 rounded-lg text-sm text-gray-300 hover:bg-red-600 hover:text-white transition-colors`}
        >
          <FiLogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
