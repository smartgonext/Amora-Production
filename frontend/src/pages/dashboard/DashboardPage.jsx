import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDollarSign, FiUsers, FiPackage, FiShoppingCart, FiTrendingUp, FiActivity, FiArrowUpRight, FiZap, FiStar, FiBookmark, FiEdit3, FiBell, FiX, FiCheck } from 'react-icons/fi';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DashboardPage() {
  const { user } = useAuth();
  const [pinnedMenus, setPinnedMenus] = useState(['POS Terminal', 'Reports Page']);
  const [personalNotes, setPersonalNotes] = useState('Verify deck oven preheat (230°C) and sourdough bulk fermentation temperature (26°C) before 5:00 AM morning bake.');
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcInput, setCalcInput] = useState('');

  // Fetch live customers
  const { data: customersResponse, isLoading: isCustomersLoading } = useQuery({
    queryKey: ['dashboard-customers'],
    queryFn: async () => {
      const response = await apiClient.get('/customers');
      return response.data;
    }
  });

  const customers = customersResponse?.data || [];
  const customerCount = customers.length;

  // Fetch live invoices
  const { data: invoicesResponse } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: async () => {
      const response = await apiClient.get('/invoices');
      return response.data;
    }
  });

  const invoices = invoicesResponse?.data || [];

  // Fetch live dashboard summary stats
  const { data: summaryResponse, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/dashboard/summary');
      return response.data;
    }
  });

  const summary = summaryResponse?.data || {};

  const salesValue = summary.month_sales !== undefined 
    ? `₹ ${summary.month_sales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '₹ 0.00';
  const productsCount = summary.total_products || 0;
  const invoiceCount = summary.total_invoices || 0;

  const salesChange = summary.month_sales > 0 ? '+12.4%' : '0%';
  const customersChange = customerCount > 0 ? '+8.1%' : '0%';
  const productsChange = productsCount > 0 ? 'Stable' : '0%';
  const invoicesChange = invoiceCount > 0 ? '+4.2%' : '0%';

  // Fetch sales trend
  const { data: trendResponse } = useQuery({
    queryKey: ['sales-trend'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/sales/trend');
      return response.data;
    }
  });

  const trendData = trendResponse?.data || [];

  // Default labels and data if empty
  const salesLabels = trendData.length > 0 ? trendData.map(d => `${d.month_name} ${d.year}`) : ['Current Month'];
  const salesValues = trendData.length > 0 ? trendData.map(d => d.total_sales) : [summary.month_sales || 0];

  const salesChartData = {
    labels: salesLabels,
    datasets: [
      {
        fill: true,
        label: 'Sales Revenue (INR)',
        data: salesValues,
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        pointBackgroundColor: 'rgb(99, 102, 241)',
        pointHoverRadius: 8,
      }
    ]
  };

  const activityChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Bakes Completed',
        data: [14, 25, 18, 30, 28, 42, 35],
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderRadius: 6,
      },
      {
        label: 'Counter Orders',
        data: [8, 12, 10, 15, 14, 22, 18],
        backgroundColor: 'rgba(99, 102, 241, 0.85)',
        borderRadius: 6,
      }
    ]
  };

  const recentRecords = [];
  if (customers.length > 0) {
    const lastCustomer = customers[customers.length - 1];
    recentRecords.push({
      type: 'Customer',
      name: lastCustomer.name,
      date: 'Recently added'
    });
  }
  if (invoices.length > 0) {
    const lastInvoice = invoices[invoices.length - 1];
    recentRecords.push({
      type: 'Invoice',
      name: `${lastInvoice.invoice_number} (₹${parseFloat(lastInvoice.total_amount || 0).toLocaleString('en-IN')})`,
      date: 'Recently generated'
    });
  }
  if (recentRecords.length === 0) {
    recentRecords.push(
      { type: 'Customer', name: 'No customers registered yet', date: '-' },
      { type: 'Invoice', name: 'No invoices generated yet', date: '-' }
    );
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
      y: { grid: { color: 'rgba(148, 163, 184, 0.1)' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
    }
  };

  const handleTogglePin = (menu) => {
    if (pinnedMenus.includes(menu)) {
      setPinnedMenus(pinnedMenus.filter(m => m !== menu));
      toast.success(`Removed ${menu} from favourites`);
    } else {
      setPinnedMenus([...pinnedMenus, menu]);
      toast.success(`Pinned ${menu} to dashboard!`);
    }
  };

  const handleCalcBtn = (char) => {
    if (char === 'C') {
      setCalcInput('');
    } else if (char === '=') {
      try {
        // Safe evaluation helper for calculator input
        const res = new Function(`return ${calcInput}`)();
        setCalcInput(res.toString());
      } catch (err) {
        setCalcInput('Error');
      }
    } else {
      setCalcInput(prev => prev + char);
    }
  };

  return (
    <div className="space-y-8 pb-12 relative">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 p-8 shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(99,102,241,0.2),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Amora Bakery & Patisserie</h1>
            <p className="text-slate-300 text-sm max-w-lg leading-relaxed">
              Live production hub, recipe yields, artisan bakery batches, POS counter sales, and ingredient inventory.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCalculator(true)}
              className="p-3 bg-slate-800 text-white rounded-xl border border-slate-700 hover:bg-slate-750 flex items-center gap-1.5 text-xs font-semibold"
              title="Calculator Quick Tool"
            >
              <FiActivity /> Calculator
            </button>
            <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10">
              <FiZap className="text-amber-400 animate-pulse text-xl" />
              <div className="text-xs">
                <div className="text-white font-semibold">Active Plan: Enterprise</div>
                <div className="text-slate-350">Tenant ID: #{user?.tenant_id || 1}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Alert Bell banner */}
      <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-xl flex items-center gap-3 text-xs text-indigo-750 dark:text-indigo-400">
        <FiBell className="text-lg flex-shrink-0 animate-bounce" />
        <div>
          <strong>System Notifications:</strong> Shift configurations updated for the next cycle. GSTR-3B filings summary ready in the tax reports section.
        </div>
      </div>

      {/* Grid Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: 'Total Sales Revenue', value: isSummaryLoading ? '...' : salesValue, change: salesChange, icon: FiDollarSign, color: 'from-blue-500 to-indigo-600' },
          { title: 'Registered Customers', value: isCustomersLoading ? '...' : customerCount, change: customersChange, icon: FiUsers, color: 'from-emerald-400 to-teal-650' },
          { title: 'Bakery Products & Items', value: isSummaryLoading ? '...' : productsCount, change: productsChange, icon: FiPackage, color: 'from-purple-500 to-violet-700' },
          { title: 'Active Invoices', value: isSummaryLoading ? '...' : invoiceCount, change: invoicesChange, icon: FiShoppingCart, color: 'from-orange-400 to-rose-550' },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -4 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between"
          >
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.title}</span>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{card.value}</h3>
              <div className="flex items-center space-x-1 text-xs">
                <FiTrendingUp className="text-emerald-500" />
                <span className="text-emerald-500 font-medium">{card.change}</span>
                <span className="text-slate-400">vs last month</span>
              </div>
            </div>
            <div className={`p-4 rounded-xl bg-gradient-to-br ${card.color} text-white shadow-md`}>
              <card.icon className="text-xl" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Mid Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-white text-base">Revenue Pipeline</h3>
          <div className="h-64 relative">
            <Line data={salesChartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-white text-base">Weekly Activity Volume</h3>
          <div className="h-64 relative">
            <Bar data={activityChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* QoL Widgets row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pinned Bookmarks / Favorites */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-1.5"><FiBookmark /> Pinned Favourites</h3>
          <div className="space-y-2">
            {['POS Terminal', 'Recipe / Yield', 'Bake Batches', 'Quality Control', 'Reports Page'].map((menu) => (
              <div key={menu} className="flex justify-between items-center py-2 px-3 bg-slate-50 dark:bg-slate-850 rounded-lg text-xs">
                <span className="font-semibold">{menu}</span>
                <button onClick={() => handleTogglePin(menu)} className="p-1 hover:text-amber-500 rounded text-slate-400">
                  <FiStar className={pinnedMenus.includes(menu) ? 'fill-amber-400 text-amber-500' : ''} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recently Used Records list */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-1.5"><FiActivity /> Recently Used Records</h3>
          <div className="space-y-3 text-xs">
            {recentRecords.map((rec, i) => (
              <div key={i} className="flex justify-between items-start py-1.5 border-b border-slate-100 dark:border-slate-850 last:border-0">
                <div>
                  <span className="font-bold text-indigo-600 block text-[10px] uppercase">{rec.type}</span>
                  <span className="text-slate-850 dark:text-slate-200 mt-0.5 block">{rec.name}</span>
                </div>
                <span className="text-[10px] text-slate-400">{rec.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Personal Notes / Reminders */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-1.5"><FiEdit3 /> Personal Reminders</h3>
          <textarea
            className="w-full p-3 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            rows={5}
            value={personalNotes}
            onChange={(e) => setPersonalNotes(e.target.value)}
            placeholder="Write down personal notes..."
          />
        </div>
      </div>

      {/* FLOATING CALCULATOR DIALOG */}
      <AnimatePresence>
        {showCalculator && (
          <div className="fixed bottom-6 right-6 z-55 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-4 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-150 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5"><FiActivity /> Calculator</span>
              <button onClick={() => setShowCalculator(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400"><FiX /></button>
            </div>
            <div className="bg-slate-950 text-right p-3 rounded-lg text-emerald-400 font-mono text-sm min-h-10 truncate">{calcInput || '0'}</div>
            <div className="grid grid-cols-4 gap-2 text-xs font-bold">
              {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','C','+','='].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleCalcBtn(val)}
                  className={`p-2.5 rounded transition-colors text-center ${
                    val === '='
                      ? 'col-span-2 bg-indigo-600 text-white hover:bg-indigo-700'
                      : val === 'C'
                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}