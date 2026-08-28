import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiPlusCircle, FiRefreshCw, FiTruck, FiBox } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

const inputCls = "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition";
const btnGhost = "inline-flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm rounded-lg transition";

function Loading() { return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" />; }

function statCard(icon, label, value, tone) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${tone}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 uppercase font-semibold">{label}</p>
        <p className="text-xl font-bold text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

export default function MrpPlanningPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: productsRes } = useQuery({ queryKey: ['products', 'all'], queryFn: async () => (await apiClient.get('/products')).data });
  const products = productsRes?.data || [];
  const { data: suppliersRes } = useQuery({ queryKey: ['suppliers', 'all'], queryFn: async () => (await apiClient.get('/suppliers')).data });
  const suppliers = suppliersRes?.data || [];

  const { data: mrpRes, isLoading, error } = useQuery({
    queryKey: ['mrp', statusFilter],
    queryFn: async () => {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      return (await apiClient.get('/manufacturing/mrp', { params })).data;
    },
  });
  const plans = mrpRes?.data || [];

  const { data: shortagesRes } = useQuery({
    queryKey: ['mrp-shortages'],
    queryFn: async () => (await apiClient.get('/manufacturing/mrp/shortages')).data,
  });
  const shortages = shortagesRes?.data || [];

  const runMutation = useMutation({
    mutationFn: () => apiClient.post('/manufacturing/mrp/run', {}),
    onSuccess: () => { toast.success('MRP run completed'); queryClient.invalidateQueries({ queryKey: ['mrp'] }); queryClient.invalidateQueries({ queryKey: ['mrp-shortages'] }); },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'MRP run failed'),
  });

  const poMutation = useMutation({
    mutationFn: (mrpIds) => apiClient.post('/manufacturing/mrp/generate-po', { mrp_ids: mrpIds }),
    onSuccess: (res) => {
      toast.success(`Generated ${res.data?.data?.length || 0} purchase order(s)`);
      queryClient.invalidateQueries({ queryKey: ['mrp'] }); queryClient.invalidateQueries({ queryKey: ['mrp-shortages'] });
    },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Purchase order generation failed'),
  });

  const nameOf = (id) => { const p = products.find((x) => x.id === Number(id)); return p ? p.name : `#${id}`; };
  const skuOf = (id) => { const p = products.find((x) => x.id === Number(id)); return p?.sku || ''; };
  const supOf = (id) => { const s = suppliers.find((x) => x.id === Number(id)); return s ? s.name : null; };

  const { data: mappingsRes } = useQuery({
    queryKey: ['supplier-item-mappings'],
    queryFn: async () => (await apiClient.get('/manufacturing/supplier-item-mappings')).data,
  });
  const mappings = mappingsRes?.data || [];
  const supplierMap = () => {
    const m = {};
    mappings.forEach((x) => { if (!m[x.supplier_id]) m[x.supplier_id] = { lead_time_days: x.lead_time_days, min_order_qty: x.min_order_qty }; });
    return m;
  };


  const draftIds = plans.filter((p) => p.status === 'draft').map((p) => p.id);
  const totalShortage = shortages.reduce((s, p) => s + Number(p.shortage_qty || 0), 0);
  const totalSuggestedPo = shortages.reduce((s, p) => s + Number(p.suggested_po_qty || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FiBox className="w-6 h-6 text-indigo-600" /> Raw Material Shortage & Auto-PO
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Check stock vs planned work orders and generate purchase orders to suppliers.</p>
        </div>
        <div className="flex gap-3">
          <button className={btnGhost} disabled={runMutation.isLoading} onClick={() => runMutation.mutate()}>
            <FiRefreshCw className="w-4 h-4" /> Run MRP
          </button>
          <button className={btnPrimary} disabled={poMutation.isLoading || draftIds.length === 0} onClick={() => poMutation.mutate(draftIds)}>
            <FiPlusCircle className="w-4 h-4" /> Generate POs ({draftIds.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCard(<FiAlertTriangle className="w-5 h-5" />, 'Shortages', shortages.length, 'bg-red-100 text-red-600 dark:bg-red-900/40')}
        {statCard(<FiBox className="w-5 h-5" />, 'Shortage Qty', totalShortage.toFixed(1), 'bg-amber-100 text-amber-600 dark:bg-amber-900/40')}
        {statCard(<FiTruck className="w-5 h-5" />, 'Suggested PO Qty', totalSuggestedPo.toFixed(1), 'bg-green-100 text-green-600 dark:bg-green-900/40')}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800 dark:text-white">Shortage Plan</h2>
          <div className="flex gap-2">
            {['all', 'draft', 'po_generated'].map((s) => (
              <button key={s} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`} onClick={() => setStatusFilter(s)}>{s.replace('_', ' ')}</button>
            ))}
          </div>
        </div>

        {isLoading ? <Loading /> : error ? <p className="text-sm text-red-500">{error.response?.data?.errors?.[0]}</p> :
          plans.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No MRP plans yet. Click "Run MRP" to compute shortages against open work orders.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase border-b dark:border-slate-700">
                    <th className="py-2 pr-3">Raw Material</th><th className="py-2 pr-3">SKU</th>
                    <th className="py-2 pr-3 text-right">Required</th><th className="py-2 pr-3 text-right">In Stock</th>
                    <th className="py-2 pr-3 text-right">Shortage</th><th className="py-2 pr-3 text-right">Suggested PO</th>
                    <th className="py-2 pr-3">Supplier</th><th className="py-2 pr-3 text-right">Lead (days)</th><th className="py-2 pr-3 text-right">MOQ</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 pr-3 font-medium text-slate-800 dark:text-white">{nameOf(p.raw_material_id)}</td>
                      <td className="py-2 pr-3 text-slate-500">{skuOf(p.raw_material_id)}</td>
                      <td className="py-2 pr-3 text-right">{Number(p.required_qty || 0).toFixed(2)}</td>
                      <td className="py-2 pr-3 text-right">{Number(p.current_stock_qty || 0).toFixed(2)}</td>
                      <td className={`py-2 pr-3 text-right font-semibold ${Number(p.shortage_qty) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{Number(p.shortage_qty || 0).toFixed(2)}</td>
                      <td className="py-2 pr-3 text-right">{Number(p.suggested_po_qty || 0).toFixed(2)}</td>
                      <td className="py-2 pr-3">{supOf(p.supplier_id) || <span className="text-slate-400">No supplier</span>}</td>
                      <td className="py-2 pr-3 text-right">{supplierMap()[p.supplier_id]?.lead_time_days ?? '-'}</td>
                      <td className="py-2 pr-3 text-right">{supplierMap()[p.supplier_id]?.min_order_qty ?? '-'}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${p.status === 'po_generated' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}

