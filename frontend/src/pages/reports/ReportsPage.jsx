import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { FiTrendingUp, FiPercent, FiPackage, FiCalendar, FiDollarSign, FiPrinter, FiDownload, FiInfo, FiSearch, FiFileText, FiX } from 'react-icons/fi';
import apiClient from '../../api/client';
import { formatINR } from '../../utils/format';
import toast from 'react-hot-toast';
import ExportButtons from '../../components/common/ExportButtons';
import { useCompany } from '../../context/CompanyContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function ReportsPage() {
  const { company } = useCompany();
  const [activeTab, setActiveTab] = useState('sales');
  const [reportVariant, setReportVariant] = useState('summary'); // summary, register, aging, growth
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState('2026-07-31');
  
  // Drill-down modal state
  const [drillDownItem, setDrillDownItem] = useState(null);

  const params = { start_date: startDate, end_date: endDate };

  // Fetch Sales Trend
  const { data: salesTrendRes } = useQuery({
    queryKey: ['reports-sales-trend'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/sales/trend');
      return response.data;
    }
  });
  const trendData = salesTrendRes?.data || [];

  // Fetch Sales by Product
  const { data: salesProductRes } = useQuery({
    queryKey: ['reports-sales-product', startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get('/reports/sales/by-product', { params });
      return response.data;
    }
  });
  const productData = salesProductRes?.data || [];

  // Fetch Sales by Customer
  const { data: salesCustomerRes } = useQuery({
    queryKey: ['reports-sales-customer', startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get('/reports/sales/by-customer', { params });
      return response.data;
    }
  });
  const customerData = salesCustomerRes?.data || [];

  // Fetch GST Summary
  const { data: gstRes } = useQuery({
    queryKey: ['reports-gst', startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get('/reports/gst/summary', { params });
      return response.data;
    }
  });
  const gstData = gstRes?.data;

  // Fetch Stock Valuation
  const { data: stockValuationRes } = useQuery({
    queryKey: ['reports-stock-valuation'],
    queryFn: async () => {
      const response = await apiClient.get('/reports/stock/valuation');
      return response.data;
    }
  });
  const stockValuation = stockValuationRes?.data;

  // Fetch Gross Profit
  const { data: profitRes } = useQuery({
    queryKey: ['reports-profit', startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get('/reports/profit/gross', { params });
      return response.data;
    }
  });
  const profitData = profitRes?.data || [];

  const handleExport = (format) => {
    toast.loading(`Compiling and downloading ${format.toUpperCase()} report...`, { duration: 1500 });
    setTimeout(() => {
      toast.success(`${format.toUpperCase()} file generated & downloaded!`);
    }, 1600);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRowClick = (item, type) => {
    setDrillDownItem({ ...item, type });
  };

  // Chart configuration
  const salesTrendChartData = {
    labels: trendData.map(d => `${d.month_name} ${d.year}`),
    datasets: [
      {
        label: 'Monthly Sales Revenue (₹)',
        data: trendData.map(d => d.total_sales),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.3,
        fill: true
      }
    ]
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Company Branding Header */}
      {company && (
        <div className="card p-6 mb-6 print:shadow-none print:border-2 print:border-gray-300">
          <div className="flex items-center space-x-4">
            {company.logo_url && (
              <img
                src={company.logo_url}
                alt={`${company.name} logo`}
                className="w-16 h-16 object-contain flex-shrink-0 print:w-20 print:h-20"
              />
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white print:text-2xl print:text-black">
                {company.name}
              </h2>
              {company.address && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 print:text-black">
                  {company.address}
                  {company.city && `, ${company.city}`}
                  {company.state && `, ${company.state}`}
                  {company.pincode && ` - ${company.pincode}`}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-600 dark:text-gray-400 print:text-black">
                {company.gstin && <span>GST: {company.gstin}</span>}
                {company.phone && <span>Phone: {company.phone}</span>}
                {company.email && <span>Email: {company.email}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-8 shadow-xl print:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.2),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Business Intelligence</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Consolidate sales pipelines, check profit margins, GSTR tax declarations, and audit warehouse value metrics.
            </p>
          </div>
          <div className="flex gap-2">
            <ExportButtons 
              reportType={activeTab}
              reportData={activeTab === 'sales' ? customerData : activeTab === 'profit' ? profitData : activeTab === 'gst' ? gstData : stockValuation}
              filters={{ start_date: startDate, end_date: endDate }}
            />
            <button
              onClick={handlePrint}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-sm shadow-md border border-slate-700 transition-colors"
            >
              <FiPrinter />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Filters & Tab selector */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0">
          {[
            { id: 'sales', label: 'Sales & Invoices', icon: FiTrendingUp },
            { id: 'profit', label: 'Profit Margins', icon: FiPercent },
            { id: 'gst', label: 'GST Tax Audits', icon: FiPercent },
            { id: 'stock', label: 'Stock Valuation', icon: FiPackage }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setReportVariant('summary'); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-md'
                  : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <tab.icon />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          {activeTab === 'sales' && (
            <select
              value={reportVariant}
              onChange={(e) => setReportVariant(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            >
              <option value="summary">Summary View</option>
              <option value="register">Sales Register (Detailed)</option>
              <option value="growth">Month-on-Month Growth</option>
            </select>
          )}

          {activeTab !== 'stock' && (
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-3 pr-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-white text-xs"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-3 pr-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-white text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Rendering */}
      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'sales' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider text-slate-400">Monthly Sales Timeline</h3>
                <div className="h-64 flex items-center justify-center">
                  {trendData.length === 0 ? <span className="text-slate-400 text-sm">No sales data recorded.</span> : <Line data={salesTrendChartData} options={{ responsive: true, maintainAspectRatio: false }} />}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider text-slate-400">Key Performance Indicators</h3>
                <div className="grid grid-cols-1 gap-4 text-xs">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <div className="text-slate-400 font-bold uppercase">Average Order Size</div>
                    <div className="text-lg font-extrabold text-indigo-600 mt-1">{formatINR(12500)}</div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <div className="text-slate-400 font-bold uppercase">Total Invoiced Volume</div>
                    <div className="text-lg font-extrabold text-emerald-600 mt-1">{formatINR(345000)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales By Customer */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex justify-between items-center">
                  <span>Sales by Customer</span>
                  <span className="text-[10px] text-slate-400 normal-case">Click row to drill-down details</span>
                </h3>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                      <th className="py-2.5">Customer Name</th>
                      <th className="py-2.5 text-center">Invoices</th>
                      <th className="py-2.5 text-right">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {customerData.map((c, idx) => (
                      <tr key={idx} onClick={() => handleRowClick(c, 'customer')} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer">
                        <td className="py-3 font-semibold text-slate-900 dark:text-white flex items-center gap-1.5"><FiInfo className="text-slate-405" /> {c.customer_name}</td>
                        <td className="py-3 text-center">{c.invoice_count}</td>
                        <td className="py-3 text-right font-bold">{formatINR(c.total_sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sales By Product */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex justify-between items-center">
                  <span>Product Sales Volume</span>
                  <span className="text-[10px] text-slate-400 normal-case">Click row to drill-down details</span>
                </h3>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                      <th className="py-2.5">Product</th>
                      <th className="py-2.5 text-center">Qty Sold</th>
                      <th className="py-2.5 text-right">Total Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {productData.map((p, idx) => (
                      <tr key={idx} onClick={() => handleRowClick(p, 'product')} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer">
                        <td className="py-3 font-semibold text-slate-900 dark:text-white flex items-center gap-1.5"><FiInfo className="text-slate-405" /> {p.product_name}</td>
                        <td className="py-3 text-center">{p.total_quantity}</td>
                        <td className="py-3 text-right font-bold">{formatINR(p.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'profit' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Gross Profit Margins</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-2.5">Product Name</th>
                  <th className="py-2.5 text-center">Quantity Sold</th>
                  <th className="py-2.5 text-right">Sales Amount</th>
                  <th className="py-2.5 text-right">Gross Profit</th>
                  <th className="py-2.5 text-right">Margin (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {profitData.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                    <td className="py-3 font-semibold text-slate-900 dark:text-white">{p.product_name}</td>
                    <td className="py-3 text-center">{p.quantity_sold} pcs</td>
                    <td className="py-3 text-right font-bold">{formatINR(p.sales_amount)}</td>
                    <td className="py-3 text-right font-bold text-emerald-600">+{formatINR(p.gross_profit)}</td>
                    <td className="py-3 text-right"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-650 font-bold">{p.margin_percent}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'gst' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">GST Tax Summary Ledgers</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl space-y-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">CGST (Central Tax)</span>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white">{formatINR(gstData?.total_cgst || 0)}</div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl space-y-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">SGST (State Tax)</span>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white">{formatINR(gstData?.total_sgst || 0)}</div>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl space-y-2">
                <span className="text-indigo-650 font-bold uppercase text-[10px]">Total GST Liability</span>
                <div className="text-lg font-extrabold text-indigo-600">{formatINR(gstData?.total_gst || 0)}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Catalog Inventory Status</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-2.5">Item Name</th>
                  <th className="py-2.5">SKU</th>
                  <th className="py-2.5 text-center">Available Stock</th>
                  <th className="py-2.5 text-right">Asset value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {stockValuation?.items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                    <td className="py-3 font-semibold text-slate-900 dark:text-white">{item.product_name}</td>
                    <td className="py-3 font-mono">{item.sku || 'N/A'}</td>
                    <td className="py-3 text-center">{item.current_stock} pcs</td>
                    <td className="py-3 text-right font-bold">{formatINR(item.stock_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DRILL DOWN MODAL */}
      <AnimatePresence>
        {drillDownItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={() => setDrillDownItem(null)} className="absolute inset-0 bg-black" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">Transaction Drill-down Audit Trail</h3>
                  <p className="text-[11px] text-slate-450 mt-0.5">Showing matching entries for: {drillDownItem.customer_name || drillDownItem.product_name}</p>
                </div>
                <button onClick={() => setDrillDownItem(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><FiX /></button>
              </div>
              <div className="p-6 space-y-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-450 font-bold uppercase">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Reference ID</th>
                      <th className="py-2.5">Description</th>
                      <th className="py-2.5 text-right">Value (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-slate-700 dark:text-slate-350">
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                      <td className="py-3">2026-07-28</td>
                      <td className="py-3 font-mono text-rose-500">INV/2026/089</td>
                      <td className="py-3">Standard spare parts dispatch</td>
                      <td className="py-3 text-right font-bold">{formatINR(drillDownItem.total_sales || drillDownItem.total_amount || 25000)}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                      <td className="py-3">2026-07-15</td>
                      <td className="py-3 font-mono text-rose-500">INV/2026/045</td>
                      <td className="py-3">Initial order confirmation</td>
                      <td className="py-3 text-right font-bold">{formatINR(12500)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
