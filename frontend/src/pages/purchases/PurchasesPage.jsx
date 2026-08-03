import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiShoppingBag, FiSearch, FiEye, FiPlus, FiX, 
  FiCalendar, FiBriefcase, FiTag, FiTruck, FiRotateCcw, FiPercent 
} from 'react-icons/fi';
import apiClient from '../../api/client';
import { formatINR } from '../../utils/format';
import toast from 'react-hot-toast';

export default function PurchasesPage() {
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

  // --- Queries ---
  const { data: purchasesResponse, isLoading } = useQuery({
    queryKey: ['purchases', searchTerm],
    queryFn: async () => {
      const response = await apiClient.get('/purchases', { params: { search: searchTerm } });
      return response.data;
    }
  });
  const purchases = purchasesResponse?.data || [];

  const { data: suppliersResponse } = useQuery({
    queryKey: ['suppliers-mini'],
    queryFn: async () => {
      const response = await apiClient.get('/suppliers');
      return response.data;
    }
  });
  const suppliers = suppliersResponse?.data || [];

  const { data: grnsResponse } = useQuery({
    queryKey: ['grns'],
    queryFn: async () => {
      const response = await apiClient.get('/purchases/grn');
      return response.data;
    }
  });
  const grns = grnsResponse?.data || [];

  const { data: returnsResponse } = useQuery({
    queryKey: ['purchase-returns'],
    queryFn: async () => {
      const response = await apiClient.get('/purchases/returns');
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
      toast.success('Goods Receipt Note logged!');
      setIsAddOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['grns'] });
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
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!supplierId && activeTab !== 'grns') return toast.error('Please select a supplier.');

    const payload = {
      supplier_id: parseInt(supplierId),
      purchase_order_id: poId ? parseInt(poId) : null,
      total_amount: parseFloat(amount) || 0,
      notes
    };

    if (activeTab === 'orders') {
      createPoMutation.mutate(payload);
    } else if (activeTab === 'grns') {
      createGrnMutation.mutate({
        purchase_order_id: poId ? parseInt(poId) : null,
        notes
      });
    } else if (activeTab === 'returns') {
      createReturnMutation.mutate({
        ...payload,
        reason: notes
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
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Procurement & Purchases</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Track vendor purchase orders, receive shipments, audit replenishment lists, and update inventory.
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
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Create New {activeTab === 'orders' ? 'PO' : activeTab === 'grns' ? 'GRN Note' : 'Return Log'}</h3>
                <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                
                {activeTab !== 'grns' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Select Supplier</label>
                    <select
                      required
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                {activeTab !== 'orders' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Linked Purchase Order ID</label>
                    <select
                      required
                      value={poId}
                      onChange={(e) => setPoId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    >
                      <option value="">-- Choose PO --</option>
                      {purchases.map(p => <option key={p.id} value={p.id}>{p.po_number}</option>)}
                    </select>
                  </div>
                )}

                {activeTab !== 'grns' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Total Invoice Value (INR)</label>
                    <input
                      required
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Total Value"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Notes / Reason</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Details"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg text-sm">
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
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsDetailOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 z-10 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Purchase Order — {selectedPo?.po_number}</h3>
                <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>
              {isLoadingDetail ? (
                <div className="py-8 text-center text-slate-400">Loading details...</div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 text-slate-400">
                    <div>Date: <span className="text-white font-semibold">{new Date(poDetail?.order_date).toLocaleDateString()}</span></div>
                    <div>Total Amount: <span className="text-white font-semibold">{formatINR(poDetail?.total_amount)}</span></div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button onClick={() => setIsDetailOpen(false)} className="px-4 py-2 bg-slate-850 text-slate-400 hover:text-white rounded-lg text-xs">Close</button>
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
