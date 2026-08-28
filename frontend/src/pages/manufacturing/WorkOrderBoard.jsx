import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiX, FiPlay, FiCheckCircle, FiPackage, FiTruck, FiLayers, FiCpu } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

const inputCls = "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition";
const btnGhost = "inline-flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm rounded-lg transition";
const badge = "px-2 py-1 rounded text-xs font-semibold";

function Loading() { return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" />; }

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
      <motion.div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl my-8" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
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

  const productOf = (bomId) => { const b = boms.find((x) => x.id === Number(bomId)); const p = products.find((x) => x.id === Number(b?.product_id)); return p ? p.name : 'N/A'; };
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ['work-orders'] }); queryClient.invalidateQueries({ queryKey: ['boms'] }); queryClient.invalidateQueries({ queryKey: ['mrp'] }); };

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

      <CreateWoModal open={modal === 'create'} onClose={() => setModal(null)} boms={boms} form={createForm} setForm={setCreateForm} onSubmit={() => createMutation.mutate({ bom_id: Number(createForm.bom_id), planned_qty: Number(createForm.planned_qty) })} loading={createMutation.isLoading} />
      <OpsModal open={modal === 'ops'} onClose={() => setModal(null)} wo={activeWo} startOpMutation={startOpMutation} completeOpMutation={completeOpMutation} form={opForm} setForm={setOpForm} warehouses={warehouses} />
      <ReceiptModal open={modal === 'receipt'} onClose={() => setModal(null)} wo={activeWo} form={receiptForm} setForm={setReceiptForm} warehouses={warehouses} onSubmit={() => receiptMutation.mutate({ id: activeWo.id, data: { produced_qty: Number(receiptForm.produced_qty), batch_no: receiptForm.batch_no } })} loading={receiptMutation.isLoading} />
    </div>
  );
}

function CreateWoModal({ open, onClose, boms, form, setForm, onSubmit, loading }) {
  return (
    <Modal open={open} onClose={onClose} title="New Work Order">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">BOM</label>
          <select className={inputCls} value={form.bom_id} onChange={(e) => setForm({ ...form, bom_id: e.target.value })}>
            <option value="">Select a BOM...</option>
            {boms.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.version}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Planned Quantity</label>
          <input type="number" className={inputCls} value={form.planned_qty} onChange={(e) => setForm({ ...form, planned_qty: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={!form.bom_id || loading} onClick={onSubmit}>{loading ? 'Creating...' : 'Create'}</button>
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
