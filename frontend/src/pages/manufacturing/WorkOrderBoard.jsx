import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiX, FiPlay, FiCheckCircle, FiPackage, FiTruck, FiLayers, FiCpu,
  FiZap, FiAlertTriangle, FiDollarSign, FiCheck, FiRefreshCw
} from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

const inputCls = "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition";
const btnGhost = "inline-flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm rounded-lg transition";
const badge = "px-2 py-1 rounded text-xs font-semibold";

function Loading() { return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" />; }

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
      <motion.div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} my-8`} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><FiX className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

const COLUMNS = [
  { key: 'planned', label: 'Planned', dot: 'bg-slate-400', border: 'border-slate-300 dark:border-slate-700' },
  { key: 'wip', label: 'WIP / Released', dot: 'bg-amber-500', border: 'border-amber-300 dark:border-amber-700' },
  { key: 'qc_pending', label: 'QC Pending', dot: 'bg-violet-500', border: 'border-violet-300 dark:border-violet-700' },
  { key: 'completed', label: 'Completed', dot: 'bg-green-500', border: 'border-green-300 dark:border-green-700' },
];

const STATUS_BADGE = {
  planned: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  wip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  qc_pending: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export default function WorkOrderBoard() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'create' | 'ops' | 'receipt'
  const [activeWo, setActiveWo] = useState(null);
  const [createForm, setCreateForm] = useState({ bom_id: '', planned_qty: 1 });
  const [opForm, setOpForm] = useState({ operation_id: '', actual_setup_time: 0, actual_run_time: 0 });
  const [receiptForm, setReceiptForm] = useState({ produced_qty: 1, batch_no: '' });

  const { data: woRes, isLoading, error } = useQuery({ queryKey: ['work-orders'], queryFn: async () => (await apiClient.get('/manufacturing/work-orders')).data });
  const wos = woRes?.data || [];
  const { data: bomsRes } = useQuery({ queryKey: ['boms', 'all'], queryFn: async () => (await apiClient.get('/manufacturing/boms')).data });
  const boms = bomsRes?.data || [];
  const { data: productsRes } = useQuery({ queryKey: ['products', 'all'], queryFn: async () => (await apiClient.get('/products')).data });
  const products = productsRes?.data || [];
  const { data: whRes } = useQuery({ queryKey: ['warehouses'], queryFn: async () => (await apiClient.get('/inventory/warehouses')).data });
  const warehouses = whRes?.data || [];

  const productOf = (bomId) => {
    const b = boms.find((x) => x.id === Number(bomId));
    const p = products.find((x) => x.id === Number(b?.product_id));
    return p ? p.name : 'N/A';
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    queryClient.invalidateQueries({ queryKey: ['boms'] });
    queryClient.invalidateQueries({ queryKey: ['mrp'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };

  const createMutation = useMutation({
    mutationFn: (p) => apiClient.post('/manufacturing/work-orders', p),
    onSuccess: () => { toast.success('Work order created'); invalidate(); setModal(null); },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed to create'),
  });
  const releaseMutation = useMutation({
    mutationFn: (id) => apiClient.post(`/manufacturing/work-orders/${id}/release`, {}),
    onSuccess: () => { toast.success('Released to WIP'); invalidate(); setModal(null); },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Release failed'),
  });
  const startOpMutation = useMutation({
    mutationFn: ({ id, opId }) => apiClient.post(`/manufacturing/work-orders/${id}/start-operation`, { operation_id: opId }),
    onSuccess: () => { toast.success('Operation started'); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Start failed'),
  });
  const completeOpMutation = useMutation({
    mutationFn: ({ id, data }) => apiClient.post(`/manufacturing/work-orders/${id}/complete-operation`, data),
    onSuccess: () => { toast.success('Operation completed'); invalidate(); setOpForm({ operation_id: '', actual_setup_time: 0, actual_run_time: 0 }); },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Complete failed'),
  });
  const receiptMutation = useMutation({
    mutationFn: ({ id, data }) => apiClient.post(`/manufacturing/work-orders/${id}/receipt`, data),
    onSuccess: (res) => { toast.success(`Production receipt done: ${res.data?.data?.generated_batch?.batch_no || 'batch'}`); invalidate(); setModal(null); setReceiptForm({ produced_qty: 1, batch_no: '' }); },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Receipt failed'),
  });
  const completeMutation = useMutation({
    mutationFn: (id) => apiClient.post(`/manufacturing/work-orders/${id}/complete`, {}),
    onSuccess: () => { toast.success('Work order completed'); invalidate(); setModal(null); },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Complete failed'),
  });

  const numOf = (v) => Number(v || 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FiCpu className="w-6 h-6 text-indigo-600" /> Work Order Board
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Release, WIP, QC and completion stages with routing operation tracking.</p>
        </div>
        <button className={btnPrimary} onClick={() => { setCreateForm({ bom_id: '', planned_qty: 1 }); setModal('create'); }}>
          <FiPlus className="w-4 h-4" /> New Work Order
        </button>
      </div>

      {isLoading ? <Loading /> : error ? <p className="text-sm text-red-500">{error.response?.data?.errors?.[0]}</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colWos = wos.filter((w) => w.status === col.key);
            return (
              <div key={col.key} className={`bg-white dark:bg-slate-900 border ${col.border} rounded-xl p-3 flex flex-col min-h-[200px]`}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wide">{col.label}</h3>
                  <span className="ml-auto text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">{colWos.length}</span>
                </div>
                <div className="space-y-2 flex-1">
                  {colWos.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Empty</p>}
                  {colWos.map((w) => (
                    <div key={w.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400">{w.wo_number}</span>
                        <span className={`${badge} ${STATUS_BADGE[w.status] || STATUS_BADGE.planned}`}>{w.status.replace('_', ' ')}</span>
                      </div>
                      <p className="mt-1 font-semibold text-slate-800 dark:text-white text-sm">{productOf(w.bom_id)}</p>
                      <div className="mt-1 text-xs text-slate-500">
                        <span>Planned <b>{numOf(w.planned_qty)}</b></span>
                        <span className="ml-3">Produced <b>{numOf(w.produced_qty)}</b></span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {w.status === 'planned' && (
                          <button className="btn-small bg-indigo-600 text-white" onClick={() => releaseMutation.mutate(w.id)}><FiPlay className="w-3 h-3" /> Release</button>
                        )}
                        {w.status === 'wip' && (
                          <>
                            <button className="btn-small bg-amber-500 text-white" onClick={() => { setActiveWo(w); setModal('ops'); }}><FiCpu className="w-3 h-3" /> Track Ops</button>
                            <button className="btn-small bg-emerald-600 text-white" onClick={() => { setActiveWo(w); setReceiptForm({ produced_qty: numOf(w.planned_qty), batch_no: '' }); setModal('receipt'); }}><FiTruck className="w-3 h-3" /> Receipt</button>
                          </>
                        )}
                        {w.status === 'qc_pending' && (
                          <button className="btn-small bg-green-600 text-white" onClick={() => completeMutation.mutate(w.id)}><FiCheckCircle className="w-3 h-3" /> Complete</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateWoModal
        open={modal === 'create'}
        onClose={() => setModal(null)}
        boms={boms}
        form={createForm}
        setForm={setCreateForm}
        onSubmit={() => createMutation.mutate({ bom_id: Number(createForm.bom_id), planned_qty: Number(createForm.planned_qty), auto_release: false })}
        onLaunch={() => createMutation.mutate({ bom_id: Number(createForm.bom_id), planned_qty: Number(createForm.planned_qty), auto_release: true })}
        loading={createMutation.isLoading}
      />
      <OpsModal open={modal === 'ops'} onClose={() => setModal(null)} wo={activeWo} startOpMutation={startOpMutation} completeOpMutation={completeOpMutation} form={opForm} setForm={setOpForm} warehouses={warehouses} />
      <ReceiptModal open={modal === 'receipt'} onClose={() => setModal(null)} wo={activeWo} form={receiptForm} setForm={setReceiptForm} warehouses={warehouses} onSubmit={() => receiptMutation.mutate({ id: activeWo.id, data: { produced_qty: Number(receiptForm.produced_qty), batch_no: receiptForm.batch_no } })} loading={receiptMutation.isLoading} />
    </div>
  );
}

function CreateWoModal({ open, onClose, boms, form, setForm, onSubmit, onLaunch, loading }) {
  const bomId = form.bom_id;
  const plannedQty = Number(form.planned_qty || 1);

  // Auto-select first BOM on modal open if not selected
  useEffect(() => {
    if (open && boms?.length > 0 && !form.bom_id) {
      setForm((f) => ({ ...f, bom_id: boms[0].id, planned_qty: f.planned_qty || 50 }));
    }
  }, [open, boms]);

  // Auto-scale API query
  const { data: scaleRes, isLoading: isScaling } = useQuery({
    queryKey: ['bom-scale-preview', bomId, plannedQty],
    queryFn: async () => {
      if (!bomId) return null;
      return (await apiClient.get(`/manufacturing/boms/${bomId}/scale`, { params: { quantity: plannedQty } })).data?.data;
    },
    enabled: !!bomId && plannedQty > 0,
  });

  const scaled = scaleRes || null;
  const quickSizes = [10, 25, 50, 100, 250, 500];

  return (
    <Modal open={open} onClose={onClose} title="Create Production Batch (Auto-Scaling Recipe)" wide={true}>
      <div className="space-y-4">
        {/* Quick Product Select Pills (Dynamic from all saved Database BOMs) */}
        {boms?.length > 0 && (
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FiZap className="text-amber-500" /> 1-Click Product Select ({boms.length} Active Recipes):
              </span>
              <span className="text-[10px] text-slate-400">Click any product to auto-populate recipe & scale ingredients</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap max-h-24 overflow-y-auto">
              {boms.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, bom_id: b.id }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    Number(form.bom_id) === Number(b.id)
                      ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-700'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                  }`}
                >
                  <FiLayers className="w-3.5 h-3.5 text-indigo-400" />
                  {b.name}
                  <span className="text-[10px] opacity-75 font-normal">(v{b.version})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Top: Select Recipe/BOM & Planned Qty */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-7">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
              Finished Product / Recipe (BOM)
            </label>
            <select
              className={inputCls}
              value={form.bom_id}
              onChange={(e) => setForm({ ...form, bom_id: e.target.value })}
            >
              <option value="">Select a Recipe / BOM...</option>
              {boms.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — (v{b.version})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Planned Production Qty
              </label>
              {scaled && (
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  Unit: {scaled.items?.[0]?.uom || 'kg'}
                </span>
              )}
            </div>
            <input
              type="number"
              min="0.1"
              step="any"
              className={`${inputCls} font-bold text-base`}
              value={form.planned_qty}
              onChange={(e) => setForm({ ...form, planned_qty: e.target.value })}
              placeholder="e.g. 100"
            />
          </div>
        </div>

        {/* Quick Batch Size Chips */}
        {form.bom_id && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-500">Quick Batch Sizes:</span>
            {quickSizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setForm({ ...form, planned_qty: size })}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  Number(form.planned_qty) === size
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {size} kg
              </button>
            ))}
          </div>
        )}

        {/* Live Auto-Scaled Raw Materials Card */}
        {form.bom_id ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
            <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                  <FiLayers className="text-indigo-600" />
                  Auto-Adjusted Raw Materials for {form.planned_qty || 1} {scaled?.product_name ? `(${scaled.product_name})` : 'Units'}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ingredients scale automatically from standard formula — zero repetitive typing required.
                </p>
              </div>

              {scaled && (
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="text-slate-600 dark:text-slate-300">
                    Est. Ingredient Cost:{' '}
                    <strong className="text-indigo-600 dark:text-indigo-400">
                      ₹{scaled.total_material_cost?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500">
                    ₹{scaled.unit_material_cost?.toFixed(2)} / unit
                  </span>
                </div>
              )}
            </div>

            {isScaling ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <FiRefreshCw className="animate-spin text-indigo-600" /> Recalculating recipe quantities...
              </div>
            ) : scaled?.items?.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Raw Material</th>
                      <th className="py-2.5 px-3">
                        Recipe Formula ({scaled.base_quantity || 1} {scaled.items?.[0]?.uom ? 'Yield' : 'Units'})
                      </th>
                      <th className="py-2.5 px-3 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-bold">
                        Batch Required Qty ({form.planned_qty || 1} Units)
                      </th>
                      <th className="py-2.5 px-3">Current Stock</th>
                      <th className="py-2.5 px-3">Feasibility</th>
                      <th className="py-2.5 px-3 text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {scaled.items.map((item) => {
                      const isShortage = item.status === 'shortage';
                      return (
                        <tr key={item.item_id} className="hover:bg-white/60 dark:hover:bg-slate-800/60 transition">
                          <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {item.name}
                            {item.sku && <span className="ml-1.5 text-[10px] text-slate-400">({item.sku})</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            {item.base_qty_in_recipe !== undefined ? item.base_qty_in_recipe : item.base_qty_per_unit} {item.uom}
                          </td>
                          <td className="py-2 px-3 bg-indigo-50/40 dark:bg-indigo-950/20 font-bold text-indigo-700 dark:text-indigo-300">
                            {item.required_qty} {item.uom}
                          </td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                            {item.current_stock} {item.uom}
                          </td>
                          <td className="py-2 px-3">
                            {isShortage ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                                <FiAlertTriangle className="w-3 h-3" /> Short (-{item.shortage_qty} {item.uom})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                <FiCheck className="w-3 h-3" /> In Stock
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300 font-medium">
                            ₹{item.estimated_cost?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                No components listed in this BOM.
              </div>
            )}

            {/* Feasibility Alert Banner */}
            {scaled && (
              <div className={`p-3 text-xs flex items-center justify-between border-t ${
                scaled.has_shortage
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
              }`}>
                <div className="flex items-center gap-2">
                  {scaled.has_shortage ? <FiAlertTriangle className="w-4 h-4 flex-shrink-0" /> : <FiCheckCircle className="w-4 h-4 flex-shrink-0" />}
                  <span>
                    {scaled.has_shortage
                      ? 'Stock shortage detected on one or more raw materials. You can save as Planned order or order via MRP.'
                      : 'All raw materials are in stock! You can instantly launch production with automatic FEFO deduction.'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center">
            <FiLayers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select a Recipe / BOM to preview auto-scaling</p>
            <p className="text-xs text-slate-400 mt-1">Once selected, all raw materials will calculate automatically based on your planned quantity.</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              className={btnGhost}
              disabled={!form.bom_id || loading}
              onClick={onSubmit}
            >
              Save as Planned Order
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition disabled:opacity-50"
              disabled={!form.bom_id || loading}
              onClick={onLaunch}
            >
              <FiZap className="w-4 h-4 text-amber-300" />
              {loading ? 'Launching...' : '⚡ 1-Click Launch Production (Auto-Issue)'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function OpsModal({ open, onClose, wo, startOpMutation, completeOpMutation, form, setForm, warehouses }) {
  const ops = wo?.operations || [];
  return (
    <Modal open={open && !!wo} onClose={onClose} title={`${wo?.wo_number} — Operations`}>
      <div className="space-y-3">
        {ops.length === 0 && <p className="text-sm text-slate-400">No routing operations on this work order. It may not have a routing in its BOM.</p>}
        {ops.map((op) => (
          <div key={op.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 dark:text-white text-sm">{op.operation_sequence} — {op.operation_name}</p>
                <p className="text-xs text-slate-400">Status: {op.status}</p>
              </div>
              {op.status === 'pending' && (
                <button className="btn-small bg-indigo-600 text-white" onClick={() => startOpMutation.mutate({ id: wo.id, opId: op.id })}><FiPlay className="w-3 h-3" /> Start</button>
              )}
              {op.status === 'in_progress' && (
                <button className="btn-small bg-green-600 text-white" onClick={() => completeOpMutation.mutate({ id: wo.id, data: { operation_id: op.id, actual_setup_time: Number(form.actual_setup_time), actual_run_time: Number(form.actual_run_time) } })}><FiCheckCircle className="w-3 h-3" /> Complete</button>
              )}
            </div>
            {op.status === 'in_progress' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div><label className="text-xs text-slate-500">Setup (min)</label><input type="number" className={inputCls} value={form.actual_setup_time} onChange={(e) => setForm({ ...form, actual_setup_time: e.target.value })} /></div>
                <div><label className="text-xs text-slate-500">Run (min)</label><input type="number" className={inputCls} value={form.actual_run_time} onChange={(e) => setForm({ ...form, actual_run_time: e.target.value })} /></div>
              </div>
            )}
          </div>
        ))}
        <div className="flex justify-end">
          <button className={btnGhost} onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

function ReceiptModal({ open, onClose, wo, form, setForm, warehouses, onSubmit, loading }) {
  return (
    <Modal open={open && !!wo} onClose={onClose} title={`${wo?.wo_number} — Production Receipt`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold uppercase text-slate-500">Produced Qty</label>
            <input type="number" className={inputCls} value={form.produced_qty} onChange={(e) => setForm({ ...form, produced_qty: e.target.value })} /></div>
          <div><label className="text-xs font-semibold uppercase text-slate-500">Batch No (optional)</label>
            <input className={inputCls} value={form.batch_no} placeholder="Auto if blank" onChange={(e) => setForm({ ...form, batch_no: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-3">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={loading} onClick={onSubmit}>{loading ? 'Processing...' : 'Receive'}</button>
        </div>
      </div>
    </Modal>
  );
}
