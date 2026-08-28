import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiShoppingBag, FiSearch, FiEye, FiPlus, FiX, 
  FiCalendar, FiBriefcase, FiTag, FiTruck, FiRotateCcw, FiPercent 
} from 'react-icons/fi';
import apiClient from '../../api/client';
import { formatINR } from '../../utils/format';
import toast from 'react-hot-toast';

export default function PurchasesPage({ isRawMaterialOnly }) {
  const location = useLocation();
  const isMfgPurchase = isRawMaterialOnly || location.pathname.startsWith('/manufacturing');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Form states
  const [supplierId, setSupplierId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [poId, setPoId] = useState('');

  // PO specific item states
  const [poProductId, setPoProductId] = useState('');
  const [poQty, setPoQty] = useState('');
  const [poRate, setPoRate] = useState('');

  // Return specific item states
  const [retProductId, setRetProductId] = useState('');
  const [retBatchNo, setRetBatchNo] = useState('');
  const [retQty, setRetQty] = useState('');

  // GRN specific states
  const [grnProductId, setGrnProductId] = useState('');
  const [grnQty, setGrnQty] = useState('');
  const [grnRate, setGrnRate] = useState('');
  const [grnBatchNo, setGrnBatchNo] = useState('');
  const [grnMfgDate, setGrnMfgDate] = useState('');
  const [grnExpiryDate, setGrnExpiryDate] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [gateEntryNo, setGateEntryNo] = useState('');

  // --- Queries ---
  const { data: purchasesResponse, isLoading } = useQuery({
    queryKey: ['purchases', searchTerm, isMfgPurchase],
    queryFn: async () => {
      const response = await apiClient.get('/purchases', { 
        params: { search: searchTerm, is_mfg: isMfgPurchase ? 'true' : 'false' } 
      });
      return response.data;
    }
  });
  const purchases = purchasesResponse?.data || [];

  const { data: productsResponse } = useQuery({
    queryKey: ['products-mini'],
    queryFn: async () => {
      const response = await apiClient.get('/products');
      return response.data;
    }
  });
  const products = productsResponse?.data || [];

  // Query BOMs list to display where raw materials are used
  const { data: bomsResponse } = useQuery({
    queryKey: ['boms-list'],
    queryFn: async () => {
      const response = await apiClient.get('/manufacturing/boms');
      return response.data;
    }
  });
  const bomsList = bomsResponse?.data || [];

  // Filter products based on mode:
  // If in Manufacturing Raw Material Purchases: show ONLY Raw Materials & Packaging items.
  // If in General Purchases: show General/Finished trading goods (no raw materials).
  const rawMaterialProducts = products.filter(p => {
    const type = (p.type || '').toLowerCase();
    const isRaw = p.is_raw_material || type === 'raw_material' || type === 'packaging';
    
    // Prevent equipment, machinery, services, rentals, AMC or assets from being purchasable here
    if (p.is_service || type.includes('equipment') || type.includes('machinery') || type.includes('asset')) {
      return false;
    }

    if (isMfgPurchase) {
      // Manufacturing raw material purchase screen -> ONLY show raw materials/ingredients/packaging
      return isRaw;
    } else {
      // General purchase screen -> ONLY show normal trading products/finished goods (no raw materials)
      return !isRaw;
    }
  });

  const { data: suppliersResponse } = useQuery({
    queryKey: ['suppliers-mini'],
    queryFn: async () => {
      const response = await apiClient.get('/suppliers');
      return response.data;
    }
  });
  const suppliers = suppliersResponse?.data || [];

  const { data: grnsResponse } = useQuery({
    queryKey: ['grns', isMfgPurchase],
    queryFn: async () => {
      const response = await apiClient.get('/purchases/grn', {
        params: { is_mfg: isMfgPurchase ? 'true' : 'false' }
      });
      return response.data;
    }
  });
  const grns = grnsResponse?.data || [];

  const { data: returnsResponse } = useQuery({
    queryKey: ['purchase-returns', isMfgPurchase],
    queryFn: async () => {
      const response = await apiClient.get('/purchases/returns', {
        params: { is_mfg: isMfgPurchase ? 'true' : 'false' }
      });
      return response.data;
    }
  });
  const returns = returnsResponse?.data || [];

  const { data: poDetailResponse, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['purchase-detail', selectedPo?.id],
    queryFn: async () => {
      if (!selectedPo?.id) return null;
      const response = await apiClient.get(`/purchases/${selectedPo.id}`);
      return response.data;
    },
    enabled: !!selectedPo?.id
  });
  const poDetail = poDetailResponse?.data;

  // --- Mutations ---
  const createPoMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/purchases', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Purchase Order registered successfully!');
      setIsAddOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    }
  });

  const createGrnMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/purchases/grn', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Goods Receipt Note & Stock Batch created successfully!');
      setIsAddOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to create GRN');
    }
  });

  const createReturnMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/purchases/returns', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Supplier Return & Debit Note logged!');
      setIsAddOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
    }
  });

  const resetForm = () => {
    setSupplierId('');
    setAmount('');
    setNotes('');
    setPoId('');
    setPoProductId('');
    setPoQty('');
    setPoRate('');
    setRetProductId('');
    setRetBatchNo('');
    setRetQty('');
    setGrnProductId('');
    setGrnQty('');
    setGrnRate('');
    setGrnBatchNo('');
    setGrnMfgDate('');
    setGrnExpiryDate('');
    setVehicleNo('');
    setGateEntryNo('');
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!supplierId) return toast.error('Please select a raw material supplier.');

    const calculatedPoAmount = poQty && poRate ? (parseFloat(poQty) * parseFloat(poRate) * 1.05) : (parseFloat(amount) || 0);

    const payload = {
      supplier_id: parseInt(supplierId),
      purchase_order_id: poId ? parseInt(poId) : null,
      total_amount: calculatedPoAmount,
      notes
    };

    if (activeTab === 'orders') {
      const selectedProd = rawMaterialProducts.find(p => p.id === parseInt(poProductId));
      const items = poProductId ? [
        {
          product_id: parseInt(poProductId),
          product_name: selectedProd?.name,
          quantity: parseFloat(poQty) || 1,
          unit_price: parseFloat(poRate) || 0
        }
      ] : [];
      createPoMutation.mutate({ ...payload, items });
    } else if (activeTab === 'grns') {
      if (!grnProductId || !grnQty) return toast.error('Please select a product and enter received quantity.');
      createGrnMutation.mutate({
        supplier_id: parseInt(supplierId),
        purchase_order_id: poId ? parseInt(poId) : null,
        vehicle_no: vehicleNo,
        gate_entry_no: gateEntryNo,
        notes,
        items: [
          {
            product_id: parseInt(grnProductId),
            received_quantity: parseInt(grnQty),
            accepted_quantity: parseInt(grnQty),
            rate: parseFloat(grnRate) || 0,
            batch_no: grnBatchNo || `RM-BATCH-${Date.now()}`,
            mfg_date: grnMfgDate || null,
            expiry_date: grnExpiryDate || null
          }
        ]
      });
    } else if (activeTab === 'returns') {
      const selectedProd = rawMaterialProducts.find(p => p.id === parseInt(retProductId));
      const returnReasonFormatted = `[Product: ${selectedProd?.name || (isMfgPurchase ? 'Raw Material' : 'Product')}, Batch: ${retBatchNo || 'N/A'}, Qty: ${retQty || 'N/A'}] ${notes}`;
      createReturnMutation.mutate({
        ...payload,
        total_amount: parseFloat(amount) || 0,
        reason: returnReasonFormatted,
        product_id: retProductId ? parseInt(retProductId) : null,
        quantity: retQty ? parseInt(retQty) : 1,
        rate: retQty ? (parseFloat(amount) / (parseInt(retQty) || 1)) : (parseFloat(amount) || 0)
      });
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header section with Premium Procurement Theme */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {isMfgPurchase ? 'Raw Material & Ingredient Procurement' : 'General Procurement & Purchases'}
            </h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              {isMfgPurchase
                ? 'Procure raw ingredients, milk, cream, sugar, flavorings, and packaging components for factory production.'
                : 'Track vendor purchase orders, receive shipments, audit replenishment lists, and update inventory.'}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAddOpen(true)}
            className="flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg"
          >
            <FiPlus className="text-lg" />
            <span>Create {activeTab === 'orders' ? 'Purchase Order' : activeTab === 'grns' ? 'GRN Note' : 'Return Log'}</span>
          </motion.button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-sm">
        {[
          { id: 'orders', label: 'Purchase Orders', icon: FiShoppingBag },
          { id: 'grns', label: 'Goods Receipt Notes (GRN)', icon: FiTruck },
          { id: 'returns', label: 'Purchase Returns', icon: FiRotateCcw },
          { id: 'debitnotes', label: 'Debit Notes Log', icon: FiPercent }
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

      {/* Main Content Area */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
        
        {activeTab === 'orders' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">PO Number</th>
                  <th className="py-4 px-6">Order Date</th>
                  <th className="py-4 px-6">Total Amount</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-4 px-6 font-semibold font-mono text-slate-900 dark:text-white">{po.po_number}</td>
                    <td className="py-4 px-6">{new Date(po.order_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">{formatINR(po.total_amount)}</td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-xs">{po.status}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button onClick={() => { setSelectedPo(po); setIsDetailOpen(true); }} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
                        <FiEye className="text-lg" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'grns' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">GRN Number</th>
                  <th className="py-4 px-6">Received Date</th>
                  <th className="py-4 px-6">Linked PO ID</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {grns.map((g) => (
                  <tr key={g.id}>
                    <td className="py-4 px-6 font-mono text-white">{g.grn_number}</td>
                    <td className="py-4 px-6">{new Date(g.received_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6 font-mono text-indigo-400">#{g.purchase_order_id || 'N/A'}</td>
                    <td className="py-4 px-6 text-emerald-400">{g.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'returns' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Return Number</th>
                  <th className="py-4 px-6">Return Date</th>
                  <th className="py-4 px-6">Reason</th>
                  <th className="py-4 px-6 text-right">Refund Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {returns.map((r) => (
                  <tr key={r.id}>
                    <td className="py-4 px-6 font-mono text-white">{r.return_number}</td>
                    <td className="py-4 px-6">{new Date(r.return_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6">{r.reason || 'N/A'}</td>
                    <td className="py-4 px-6 text-right text-rose-400">{formatINR(r.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'debitnotes' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Debit Note Ref</th>
                  <th className="py-4 px-6">Source Return</th>
                  <th className="py-4 px-6">Adjustment Date</th>
                  <th className="py-4 px-6 text-right">Debit Adjustment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {returns.map((r) => (
                  <tr key={r.id}>
                    <td className="py-4 px-6 font-mono text-indigo-400">DN-{r.return_number}</td>
                    <td className="py-4 px-6 font-mono text-white">{r.return_number}</td>
                    <td className="py-4 px-6">{new Date(r.return_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6 text-right text-rose-400 font-bold">{formatINR(r.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* CREATE PO/GRN/RETURN MODAL */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsAddOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 z-10 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Create New {activeTab === 'orders' ? 'PO' : activeTab === 'grns' ? 'GRN Note' : 'Return Log'}
                </h3>
                <button onClick={() => setIsAddOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Select Supplier</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="">{isMfgPurchase ? '-- Choose Raw Material Supplier --' : '-- Choose Supplier --'}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {activeTab === 'orders' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        {isMfgPurchase ? 'Select Raw Material / Ingredient' : 'Select Product / Item'}
                      </label>
                      <select
                        value={poProductId}
                        onChange={(e) => {
                          setPoProductId(e.target.value);
                          const prod = rawMaterialProducts.find(p => p.id.toString() === e.target.value);
                          if (prod && prod.purchase_price) setPoRate(prod.purchase_price.toString());
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                      >
                        <option value="">{isMfgPurchase ? '-- Choose Raw Material Item --' : '-- Choose Product --'}</option>
                        {rawMaterialProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit || 'Units'})</option>)}
                      </select>
                    </div>

                    {poProductId && (() => {
                      const selProd = rawMaterialProducts.find(p => p.id.toString() === poProductId);
                      const bomsUsing = bomsList.filter(bom => 
                        bom.items?.some(item => item.item_id === parseInt(poProductId))
                      );
                      return selProd ? (
                        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3.5 text-xs space-y-2 text-indigo-950 dark:text-indigo-200">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-bold text-slate-850 dark:text-white text-sm">{selProd.name}</span>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">SKU: {selProd.sku || 'N/A'} | UOM: {selProd.unit || 'Units'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-emerald-600 dark:text-emerald-400">Available Stock: {selProd.current_stock || 0} {selProd.unit || 'Units'}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">Last Cost: ₹{selProd.purchase_price || 0}</div>
                            </div>
                          </div>
                          {bomsUsing.length > 0 && (
                            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                              <div className="text-[11px] font-semibold text-slate-650 dark:text-slate-400 mb-1">Used in BOM Recipes:</div>
                              <div className="flex flex-wrap gap-1">
                                {bomsUsing.map(bom => (
                                  <span key={bom.id} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 border border-indigo-250 dark:border-indigo-900 rounded-lg text-indigo-650 dark:text-indigo-305 text-[10px] font-bold">
                                    {bom.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null;
                    })()}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Order Quantity</label>
                        <input
                          type="number"
                          value={poQty}
                          onChange={(e) => setPoQty(e.target.value)}
                          placeholder="e.g. 1000"
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Expected Rate (₹)</label>
                        <input
                          type="number"
                          value={poRate}
                          onChange={(e) => setPoRate(e.target.value)}
                          placeholder="Rate per unit"
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'grns' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        {isMfgPurchase ? 'Received Raw Material / Ingredient' : 'Received Product / Item'}
                      </label>
                      <select
                        required
                        value={grnProductId}
                        onChange={(e) => {
                          setGrnProductId(e.target.value);
                          const prod = rawMaterialProducts.find(p => p.id.toString() === e.target.value);
                          if (prod && prod.purchase_price) setGrnRate(prod.purchase_price.toString());
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                      >
                        <option value="">{isMfgPurchase ? '-- Select Raw Material / Packaging Item --' : '-- Select Product --'}</option>
                        {rawMaterialProducts.map(p => <option key={p.id} value={p.id}>{p.name} (Available Stock: {p.current_stock || 0})</option>)}
                      </select>
                    </div>

                    {grnProductId && (() => {
                      const selProd = rawMaterialProducts.find(p => p.id.toString() === grnProductId);
                      const bomsUsing = bomsList.filter(bom => 
                        bom.items?.some(item => item.item_id === parseInt(grnProductId))
                      );
                      return selProd ? (
                        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3.5 text-xs space-y-2 text-indigo-950 dark:text-indigo-200">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-bold text-slate-850 dark:text-white text-sm">{selProd.name}</span>
                              <div className="text-[11px] text-slate-550 dark:text-slate-400 mt-0.5">SKU: {selProd.sku || 'N/A'} | UOM: {selProd.unit || 'Units'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-emerald-600 dark:text-emerald-400">Available Stock: {selProd.current_stock || 0} {selProd.unit || 'Units'}</div>
                              <div className="text-[11px] text-slate-550 dark:text-slate-405">Last Cost: ₹{selProd.purchase_price || 0}</div>
                            </div>
                          </div>
                          {bomsUsing.length > 0 && (
                            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                              <div className="text-[11px] font-semibold text-slate-650 dark:text-slate-400 mb-1">Used in BOM Recipes:</div>
                              <div className="flex flex-wrap gap-1">
                                {bomsUsing.map(bom => (
                                  <span key={bom.id} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 border border-indigo-250 dark:border-indigo-900 rounded-lg text-indigo-650 dark:text-indigo-305 text-[10px] font-bold">
                                    {bom.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null;
                    })()}

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Received Qty</label>
                        <input
                          required
                          type="number"
                          value={grnQty}
                          onChange={(e) => setGrnQty(e.target.value)}
                          placeholder="Qty Received"
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Purchase Rate (₹)</label>
                        <input
                          type="number"
                          value={grnRate}
                          onChange={(e) => setGrnRate(e.target.value)}
                          placeholder="Unit Rate"
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Batch Number</label>
                        <input
                          type="text"
                          value={grnBatchNo}
                          onChange={(e) => setGrnBatchNo(e.target.value)}
                          placeholder="BATCH-MILK-001"
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-855 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Mfg Date</label>
                        <input
                          type="date"
                          value={grnMfgDate}
                          onChange={(e) => setGrnMfgDate(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Expiry Date</label>
                        <input
                          type="date"
                          value={grnExpiryDate}
                          onChange={(e) => setGrnExpiryDate(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Vehicle No (Lorry)</label>
                        <input
                          type="text"
                          value={vehicleNo}
                          onChange={(e) => setVehicleNo(e.target.value)}
                          placeholder="e.g. TN-37-AB-1234"
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Gate Entry No</label>
                        <input
                          type="text"
                          value={gateEntryNo}
                          onChange={(e) => setGateEntryNo(e.target.value)}
                          placeholder="e.g. GE-9081"
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'returns' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        {isMfgPurchase ? 'Returned Raw Material' : 'Returned Product / Item'}
                      </label>
                      <select
                        value={retProductId}
                        onChange={(e) => setRetProductId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-855 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                      >
                        <option value="">{isMfgPurchase ? '-- Choose Material Being Returned --' : '-- Choose Product Being Returned --'}</option>
                        {rawMaterialProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    {retProductId && (() => {
                      const selProd = rawMaterialProducts.find(p => p.id.toString() === retProductId);
                      const bomsUsing = bomsList.filter(bom => 
                        bom.items?.some(item => item.item_id === parseInt(retProductId))
                      );
                      return selProd ? (
                        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3.5 text-xs space-y-2 text-indigo-950 dark:text-indigo-200">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-bold text-slate-850 dark:text-white text-sm">{selProd.name}</span>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">SKU: {selProd.sku || 'N/A'} | UOM: {selProd.unit || 'Units'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-extrabold text-rose-600 dark:text-rose-400">Available Stock: {selProd.current_stock || 0} {selProd.unit || 'Units'}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">Last Cost: ₹{selProd.purchase_price || 0}</div>
                            </div>
                          </div>
                          {bomsUsing.length > 0 && (
                            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                              <div className="text-[11px] font-semibold text-slate-655 dark:text-slate-400 mb-1">Used in BOM Recipes:</div>
                              <div className="flex flex-wrap gap-1">
                                {bomsUsing.map(bom => (
                                  <span key={bom.id} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 border border-indigo-250 dark:border-indigo-900 rounded-lg text-indigo-650 dark:text-indigo-305 text-[10px] font-bold">
                                    {bom.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null;
                    })()}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Batch Number</label>
                        <input
                          type="text"
                          value={retBatchNo}
                          onChange={(e) => setRetBatchNo(e.target.value)}
                          placeholder="e.g. MILK-260825-01"
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Returned Qty</label>
                        <input
                          type="number"
                          value={retQty}
                          onChange={(e) => setRetQty(e.target.value)}
                          placeholder="e.g. 50"
                          className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Refund Value (₹)</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Estimated Debit Adjustment"
                        className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Notes / Reason</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Details..."
                    className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg text-sm transition-all hover:opacity-90">
                  Generate {activeTab === 'orders' ? 'Purchase Order' : activeTab === 'grns' ? 'GRN' : 'Return Log'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL PO MODAL */}
      <AnimatePresence>
        {isDetailOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDetailOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 z-10 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Purchase Order — {selectedPo?.po_number}</h3>
                <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-655 dark:hover:text-white transition-colors"><FiX className="w-5 h-5" /></button>
              </div>
              {isLoadingDetail ? (
                <div className="py-8 text-center text-slate-450 dark:text-slate-400">Loading details...</div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-650 dark:text-slate-400">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Supplier Details</div>
                      <div className="text-sm font-extrabold text-slate-800 dark:text-white">{poDetail?.supplier?.name || 'N/A'}</div>
                      <div className="mt-1">{poDetail?.supplier?.email || ''}</div>
                      <div>{poDetail?.supplier?.phone || ''}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Order Metadata</div>
                      <div>Date: <span className="text-slate-800 dark:text-white font-semibold">{poDetail?.order_date ? new Date(poDetail.order_date).toLocaleDateString() : 'N/A'}</span></div>
                      <div>Status: <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-300 rounded text-[10px] font-extrabold uppercase">{poDetail?.status || 'N/A'}</span></div>
                      <div className="mt-1">Total Amount: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{formatINR(poDetail?.total_amount)}</span></div>
                    </div>
                  </div>

                  {poDetail?.items && poDetail.items.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Line Items</div>
                      <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-xl">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950 text-slate-455 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                              <th className="px-4 py-2">Item</th>
                              <th className="px-4 py-2 text-right">Quantity</th>
                              <th className="px-4 py-2 text-right">Unit Rate</th>
                              <th className="px-4 py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-305">
                            {poDetail.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                                <td className="px-4 py-2 font-semibold text-slate-850 dark:text-white">{item.product?.name || 'N/A'}</td>
                                <td className="px-4 py-2 text-right">{item.quantity} {item.product?.unit || ''}</td>
                                <td className="px-4 py-2 text-right">₹{item.unit_price}</td>
                                <td className="px-4 py-2 text-right font-extrabold text-slate-850 dark:text-white">₹{item.quantity * item.unit_price}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {poDetail?.notes && (
                    <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 p-3 rounded-xl text-amber-855 dark:text-amber-300">
                      <span className="font-bold block text-[10px] uppercase tracking-wider mb-0.5">Notes</span>
                      {poDetail.notes}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button onClick={() => setIsDetailOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors">Close</button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
