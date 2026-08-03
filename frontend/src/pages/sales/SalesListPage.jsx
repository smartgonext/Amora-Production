import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiFileText, FiSearch, FiEye, FiX, FiPrinter, FiDollarSign, 
  FiCalendar, FiCreditCard, FiPlus, FiTag, FiTruck, FiRotateCcw 
} from 'react-icons/fi';
import apiClient from '../../api/client';
import { formatINR } from '../../utils/format';
import toast from 'react-hot-toast';

export default function SalesListPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  // --- Queries ---
  const { data: invoicesResponse, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['invoices', searchTerm],
    queryFn: async () => {
      const response = await apiClient.get('/invoices', { params: { search: searchTerm } });
      return response.data;
    }
  });
  const invoices = invoicesResponse?.data || [];

  const { data: invoiceDetailResponse, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['invoice-detail', selectedInvoice?.id],
    queryFn: async () => {
      if (!selectedInvoice?.id) return null;
      const response = await apiClient.get(`/invoices/${selectedInvoice.id}`);
      return response.data;
    },
    enabled: !!selectedInvoice?.id
  });
  const invoiceDetail = invoiceDetailResponse?.data;

  const { data: customersResponse } = useQuery({
    queryKey: ['customers-mini'],
    queryFn: async () => {
      const response = await apiClient.get('/customers');
      return response.data;
    }
  });
  const customers = customersResponse?.data || [];

  const { data: quotationsResponse } = useQuery({
    queryKey: ['quotations'],
    queryFn: async () => {
      const response = await apiClient.get('/sales/quotations');
      return response.data;
    }
  });
  const quotations = quotationsResponse?.data || [];

  const { data: ordersResponse } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: async () => {
      const response = await apiClient.get('/sales/orders');
      return response.data;
    }
  });
  const orders = ordersResponse?.data || [];

  const { data: challansResponse } = useQuery({
    queryKey: ['challans'],
    queryFn: async () => {
      const response = await apiClient.get('/sales/challans');
      return response.data;
    }
  });
  const challans = challansResponse?.data || [];

  const { data: returnsResponse } = useQuery({
    queryKey: ['returns'],
    queryFn: async () => {
      const response = await apiClient.get('/sales/returns');
      return response.data;
    }
  });
  const returns = returnsResponse?.data || [];

  // --- Mutations ---
  const createQuotationMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/sales/quotations', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Quotation generated successfully!');
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/sales/orders', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Sales Order registered!');
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    }
  });

  const createChallanMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/sales/challans', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Delivery Challan generated!');
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['challans'] });
    }
  });

  const createReturnMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/sales/returns', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Sales Return / Credit Note generated!');
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['returns'] });
    }
  });

  const handlePrint = () => {
    window.print();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!customerId) return toast.error('Please select a customer.');

    const payload = {
      customer_id: parseInt(customerId),
      subtotal: parseFloat(amount) || 0,
      total_amount: parseFloat(amount) || 0,
      notes
    };

    if (activeTab === 'quotations') {
      createQuotationMutation.mutate(payload);
    } else if (activeTab === 'orders') {
      createOrderMutation.mutate(payload);
    } else if (activeTab === 'challans') {
      createChallanMutation.mutate({ ...payload, delivery_address: notes });
    } else if (activeTab === 'returns') {
      createReturnMutation.mutate({ ...payload, reason: notes });
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header section with Premium Indigo-Slate Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Sales & Receivables</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Unified workspace for Invoices, Quotations, Sales Orders, Delivery Challans, and Returns.
            </p>
          </div>
          {activeTab !== 'invoices' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg"
            >
              <FiPlus className="text-lg" />
              <span>Create {activeTab.slice(0, -1)}</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-sm">
        {[
          { id: 'invoices', label: 'Billed Invoices', icon: FiFileText },
          { id: 'quotations', label: 'Quotations / Offers', icon: FiTag },
          { id: 'orders', label: 'Sales Orders', icon: FiCreditCard },
          { id: 'challans', label: 'Delivery Challans', icon: FiTruck },
          { id: 'returns', label: 'Returns & Credits', icon: FiRotateCcw }
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

      {/* Tab Panels */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
        
        {activeTab === 'invoices' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Invoice No.</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6">Payment Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-4 px-6 font-semibold font-mono text-slate-900 dark:text-white">{inv.invoice_number}</td>
                    <td className="py-4 px-6">{new Date(inv.invoice_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6">{inv.type}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        inv.payment_status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>{inv.payment_status}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button onClick={() => { setSelectedInvoice(inv); setIsDetailOpen(true); }} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
                        <FiEye className="text-lg" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'quotations' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Quotation No.</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {quotations.map((q) => (
                  <tr key={q.id}>
                    <td className="py-4 px-6 font-mono text-white">{q.quotation_number}</td>
                    <td className="py-4 px-6">{new Date(q.quotation_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6"><span className="text-amber-400">{q.status}</span></td>
                    <td className="py-4 px-6 text-right font-bold text-white">{formatINR(q.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Order No.</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-4 px-6 font-mono text-white">{o.order_number}</td>
                    <td className="py-4 px-6">{new Date(o.order_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6"><span className="text-indigo-400">{o.status}</span></td>
                    <td className="py-4 px-6 text-right font-bold text-white">{formatINR(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'challans' && (
          <div className="overflow-x-auto text-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Challan No.</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Vehicle Number</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {challans.map((c) => (
                  <tr key={c.id}>
                    <td className="py-4 px-6 font-mono text-white">{c.challan_number}</td>
                    <td className="py-4 px-6">{new Date(c.challan_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-4 px-6">{c.vehicle_number || 'N/A'}</td>
                    <td className="py-4 px-6 text-emerald-400">{c.status}</td>
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
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Reason</th>
                  <th className="py-4 px-6 text-right">Credit Value</th>
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

      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsCreateOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 z-10 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Create New {activeTab.slice(0, -1)}</h3>
                <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Select Customer</label>
                  <select
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Estimated Total Amount (INR)</label>
                  <input
                    required
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Total Value"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">
                    {activeTab === 'challans' ? 'Delivery Address / Vehicle No.' : 'Memo / Notes'}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Details"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg text-sm">
                  Generate {activeTab.slice(0, -1)}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL INVOICE MODAL */}
      <AnimatePresence>
        {isDetailOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsDetailOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 z-10 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Invoice Details — {selectedInvoice?.invoice_number}</h3>
                <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>
              {isLoadingDetail ? (
                <div className="py-8 text-center text-slate-400">Loading details...</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 text-xs text-slate-400">
                    <div>Date: <span className="text-white font-semibold">{new Date(invoiceDetail?.invoice_date).toLocaleDateString()}</span></div>
                    <div>Payment Method: <span className="text-white font-semibold">{invoiceDetail?.payment_method}</span></div>
                    <div>Total: <span className="text-white font-semibold">{formatINR(invoiceDetail?.total_amount)}</span></div>
                  </div>
                  <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-850 text-slate-400 font-bold">
                        <tr>
                          <th className="p-2">Item</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-right">Rate</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceDetail?.items?.map(itm => (
                          <tr key={itm.id} className="border-t border-slate-800 text-slate-300">
                            <td className="p-2">{itm.description || `Product #${itm.product_id}`}</td>
                            <td className="p-2 text-right">{itm.quantity}</td>
                            <td className="p-2 text-right">{formatINR(itm.rate)}</td>
                            <td className="p-2 text-right text-white font-bold">{formatINR(itm.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={handlePrint} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5">
                      <FiPrinter /> Print Receipt
                    </button>
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
