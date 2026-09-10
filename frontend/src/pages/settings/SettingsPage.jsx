import { useState } from 'react';
import { FiHome, FiGrid, FiFileText, FiShoppingBag } from 'react-icons/fi';
import CompanySettingsPage from './CompanySettingsPage';
import CustomFormBuilderPage from './CustomFormBuilderPage';
import TemplateDesignerPage from './TemplateDesignerPage';
import StoreChannelPage from './StoreChannelPage';

const TABS = [
  { key: 'company', label: 'Company Settings', icon: FiHome, component: CompanySettingsPage },
  { key: 'forms', label: 'Form Builder', icon: FiGrid, component: CustomFormBuilderPage },
  { key: 'templates', label: 'Template Designer', icon: FiFileText, component: TemplateDesignerPage },
  { key: 'store', label: 'Store / Restaurant', icon: FiShoppingBag, component: StoreChannelPage },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company');
  const ActiveComponent = TABS.find((t) => t.key === activeTab).component;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Configure company profile, dynamic forms, and visual document templates
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-1.5 flex flex-wrap gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div key={activeTab} className="animate-fadeIn">
        <ActiveComponent />
      </div>
    </div>
  );
}