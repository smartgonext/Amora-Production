import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiPackage, FiSearch, FiAlertTriangle, FiPlus, FiX, FiCheck, 
  FiActivity, FiMapPin, FiTruck, FiList 
} from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isAddWhOpen, setIsAddWhOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustmentType, setAdjustmentType] = useState('add'); // 'add' or 'subtract'
  const [adjustQty, setAdjustQty] = useState(1);
  const [reason, setReason] = useState('Physical count audit');

  // Form states
  const [whName, setWhName] = useState('');
  const [whLocation, setWhLocation] = useState('');
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [transferProductId, setTransferProductId] = useState('');

  // --- Queries ---
  const { data: productsResponse, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', searchTerm],
    queryFn: async () => {
      const response = await apiClient.get('/products', { params: { search: searchTerm } });
      return response.data;
    }
  });
  const products = productsResponse?.data || [];

  const { data: warehousesResponse } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await apiClient.get('/inventory/warehouses');
      return response.data;
    }
  });
  const warehouses = warehousesResponse?.data || [];

  const { data: transfersResponse } = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => {
      const response = await apiClient.get('/inventory/transfers');
      return response.data;
    }
  });
  const transfers = transfersResponse?.data || [];

  const { data: ledgerResponse } = useQuery({
    queryKey: ['stock-ledger'],
    queryFn: async () => {
      const response = await apiClient.get('/inventory/ledger');
      return response.data;
    }
  });
  const ledger = ledgerResponse?.data || [];

  // --- Mutations ---
  const createWarehouseMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/inventory/warehouses', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Warehouse registry added successfully!');
      setIsAddWhOpen(false);
      setWhName('');
      setWhLocation('');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    }
  });

  const createTransferMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/inventory/transfers', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Stock transfer registered!');
      setIsTransferOpen(false);
      setTransferProductId('');
      setTransferQty(1);
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  const adjustStockMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/inventory/adjustments', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Stock level adjusted!');
      setIsAdjustOpen(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-ledger'] });
    }
  });

  const handleAdjustSubmit = (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const qtyDelta = adjustmentType === 'add' ? parseInt(adjustQty) : -parseInt(adjustQty);
    adjustStockMutation.mutate({
      product_id: selectedProduct.id,
      warehouse_id: warehouses[0]?.id || 1, // Default warehouse
      qty_delta: qtyDelta,
      reason
    });
  };

  const handleWhSubmit = (e) => {
    e.preventDefault();
    createWarehouseMutation.mutate({ name: whName, location: whLocation });
  };

  const handleTransferSubmit = (e) => {
    e.preventDefault();
    createTransferMutation.mutate({
      from_warehouse_id: parseInt(transferFrom),
      to_warehouse_id: parseInt(transferTo),
      product_id: parseInt(transferProductId),
      qty: parseInt(transferQty),
      notes: 'Inter-warehouse stock transfer'
    });
  };

  const filteredProducts = products.filter(p => {
    if (stockFilter === 'low' && p.current_stock > p.min_stock_level) return false;
    if (stockFilter === 'out' && p.current_stock > 0) return false;
    return true;
  });

  const totalSKUs = products.length;
  const lowStockCount = products.filter(p => p.current_stock <= p.min_stock_level).length;
  const outOfStockCount = products.filter(p => p.current_stock <= 0).length;
  const totalValuation = products.reduce((sum, p) => sum + ((p.current_stock || 0) * parseFloat(p.purchase_price || 0)), 0);

  return (
    <div className="space-y-8 pb-12">
      {/* Header section with Purple Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Inventory Registry</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Track multi-warehouse stock balances, transfer materials, log safety limits, and audit warehouse operations.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsAddWhOpen(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 text-sm flex items-center gap-1.5"
            >
              <FiPlus />
              Add Warehouse
            </button>
            <button
              onClick={() => setIsTransferOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold rounded-xl shadow-lg text-sm flex items-center gap-1.5"
            >
              <FiTruck />
              Stock Transfer
            </button>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-sm">
        {[
          { id: 'stock', label: 'SKU Stock Health', icon: FiPackage },
          { id: 'warehouses', label: 'Warehouse Hubs', icon: FiMapPin },
          { id: 'transfers', label: 'Transfers Register', icon: FiTruck },
          { id: 'history', label: 'Movement Ledger', icon: FiList }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pb-4 font-semibold border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <tab.icon />
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Cards Grid */}
      {activeTab === 'stock' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { title: 'Total SKUs', value: totalSKUs, subtitle: 'Warehouse items', icon: FiPackage, color: 'from-blue-500 to-indigo-600' },
              { title: 'Low Stock Alerts', value: lowStockCount, subtitle: 'Need urgent reorder', icon: FiAlertTriangle, color: 'from-amber-400 to-orange-500' },
              { title: 'Out of Stock', value: outOfStockCount, subtitle: 'Zero availability', icon: FiX, color: 'from-rose-500 to-red-700' },
              { title: 'Assets Value', value: `₹${totalValuation.toLocaleString('en-IN')}`, subtitle: 'Cost valuation basis', icon: FiActivity, color: 'from-violet-500 to-purple-700' }
            ].map((stat) => (
              <div key={stat.title} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-6 rounded-xl flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{stat.title}</span>
                  <h3 className="text-2xl font-black text-slate-950 dark:text-white mt-1">{stat.value}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.subtitle}</p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-md`}>
                  <stat.icon className="text-lg" />
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="relative w-full md:w-80">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search SKU or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              {['all', 'low', 'out'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStockFilter(status)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 border ${
                    stockFilter === status
                      ? 'bg-indigo-650 text-white border-transparent'
                      : 'bg-transparent text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {status === 'all' ? 'All Stock' : status === 'low' ? 'Low Stock' : 'Out of Stock'}
                </button>
              ))}
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto text-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                    <th className="py-4 px-6">Product Details</th>
                    <th className="py-4 px-6">SKU / Code</th>
                    <th className="py-4 px-6">Current Stock</th>
                    <th className="py-4 px-6">Min Limit</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredProducts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-slate-900 dark:text-white block">{p.name}</span>
                        <span className="text-xs text-slate-500">{p.description}</span>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs">{p.sku || 'N/A'}</td>
                      <td className="py-4 px-6 font-bold text-white">{p.current_stock || 0} pcs</td>
                      <td className="py-4 px-6 text-slate-400">{p.min_stock_level || 0} pcs</td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => { setSelectedProduct(p); setIsAdjustOpen(true); }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map(w => (
            <div key={w.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl space-y-2">
              <span className="text-base font-bold text-white block">{w.name}</span>
              <span className="text-xs text-slate-400 block"><FiMapPin className="inline mr-1" />{w.location || 'No location set'}</span>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                w.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
              }`}>{w.is_active ? 'Active Hub' : 'Inactive'}</span>
            </div>
          ))}
          {warehouses.length === 0 && (
            <div className="py-12 text-center text-slate-500 col-span-full">No warehouse hubs registered.</div>
          )}
        </div>
      )}

      {activeTab === 'transfers' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Doc ID</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">From WH</th>
                  <th className="py-4 px-6">To WH</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {transfers.map(t => (
                  <tr key={t.id}>
                    <td className="py-4 px-6 font-mono text-indigo-400">#{t.id}</td>
                    <td className="py-4 px-6">{new Date(t.transfer_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6">Warehouse #{t.from_warehouse_id}</td>
                    <td className="py-4 px-6">Warehouse #{t.to_warehouse_id}</td>
                    <td className="py-4 px-6 text-emerald-400">{t.status}</td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">No transfers recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">SKU / ID</th>
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Action Type</th>
                  <th className="py-4 px-6">Change</th>
                  <th className="py-4 px-6">Running Bal</th>
                  <th className="py-4 px-6">Notes / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {ledger.map(lg => (
                  <tr key={lg.id}>
                    <td className="py-4 px-6 font-mono">Product #{lg.product_id}</td>
                    <td className="py-4 px-6">{new Date(lg.transaction_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6 font-bold">{lg.type}</td>
                    <td className={`py-4 px-6 font-bold ${lg.quantity_delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {lg.quantity_delta > 0 ? `+${lg.quantity_delta}` : lg.quantity_delta} pcs
                    </td>
                    <td className="py-4 px-6 text-white font-mono">{lg.running_balance || 0}</td>
                    <td className="py-4 px-6 text-slate-400">{lg.notes || 'No description'}</td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">No transactions recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADJUST STOCK MODAL */}
      <AnimatePresence>
        {isAdjustOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsAdjustOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 z-10 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Adjust Stock Level</h3>
                <button onClick={() => setIsAdjustOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>
              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-bold">Selected Item</span>
                  <span className="text-sm font-bold text-white block mt-0.5">{selectedProduct?.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Adjustment Type</label>
                    <select
                      value={adjustmentType}
                      onChange={(e) => setAdjustmentType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    >
                      <option value="add">Add Stock (+)</option>
                      <option value="subtract">Deduct Stock (-)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Quantity</label>
                    <input
                      required
                      type="number"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Reason Code / Notes</label>
                  <input
                    required
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Physical count variance"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg text-sm">
                  Apply Adjustment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD WAREHOUSE MODAL */}
      <AnimatePresence>
        {isAddWhOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsAddWhOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 z-10 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Register Warehouse</h3>
                <button onClick={() => setIsAddWhOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>
              <form onSubmit={handleWhSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Warehouse Name</label>
                  <input
                    required
                    type="text"
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    placeholder="Main Storage Rack"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Location Address / Bin Tag</label>
                  <input
                    type="text"
                    value={whLocation}
                    onChange={(e) => setWhLocation(e.target.value)}
                    placeholder="Sector A, Row 4"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg text-sm">
                  Register Warehouse
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* STOCK TRANSFER MODAL */}
      <AnimatePresence>
        {isTransferOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsTransferOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 z-10 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Transfer Stock</h3>
                <button onClick={() => setIsTransferOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>
              <form onSubmit={handleTransferSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Select Product SKU</label>
                  <select
                    required
                    value={transferProductId}
                    onChange={(e) => setTransferProductId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">From Warehouse</label>
                    <select
                      required
                      value={transferFrom}
                      onChange={(e) => setTransferFrom(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    >
                      <option value="">-- Source --</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">To Warehouse</label>
                    <select
                      required
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    >
                      <option value="">-- Destination --</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Transfer Qty</label>
                  <input
                    required
                    type="number"
                    value={transferQty}
                    onChange={(e) => setTransferQty(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg text-sm">
                  Register Stock Transfer
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
