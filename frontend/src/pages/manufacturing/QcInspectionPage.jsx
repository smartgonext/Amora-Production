import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheckCircle, FiPlus, FiX, FiTrash2, FiShield } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

const inputCls = "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition";
const btnGhost = "inline-flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm rounded-lg transition";

function Loading() { return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" />; }

const STATUS_STYLE = {
  passed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  conditional: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

export default function QcInspectionPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    reference_type: 'work_order', reference_id: '', passed_qty: 0, failed_qty: 0,
    qc_status: 'passed', remarks: '', check_parameters: [{ name: '', standard: '', actual: '', result: 'pending' }],
  });

  const { data: qcRes, isLoading, error } = useQuery({ queryKey: ['qc-inspections'], queryFn: async () => (await apiClient.get('/manufacturing/qc/inspections')).data });
  const inspections = qcRes?.data || [];
  const { data: woRes } = useQuery({ queryKey: ['work-orders'], queryFn: async () => (await apiClient.get('/manufacturing/work-orders')).data });
  const wos = woRes?.data || [];

  const createMutation = useMutation({
    mutationFn: (p) => apiClient.post('/manufacturing/qc/inspections', p),
    onSuccess: () => { toast.success('Inspection recorded'); queryClient.invalidateQueries({ queryKey: ['qc-inspections'] }); queryClient.invalidateQueries({ queryKey: ['work-orders'] }); setIsCreateOpen(false); },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed to record inspection'),
  });

  const setParams = (cb) => setForm((f) => ({ ...f, check_parameters: cb(f.check_parameters) }));
  const refLabel = (i) => i.reference_type === 'work_order' ? (wos.find((w) => w.id === Number(i.reference_id))?.wo_number || `WO #${i.reference_id}`) : `Receipt #${i.reference_id}`;

  const submit = () => {
    createMutation.mutate({
      reference_type: form.reference_type, reference_id: Number(form.reference_id),
      passed_qty: Number(form.passed_qty || 0), failed_qty: Number(form.failed_qty || 0),
      qc_status: form.qc_status, remarks: form.remarks,
      check_parameters: form.check_parameters.filter((p) => p.name),
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><FiShield className="w-6 h-6 text-indigo-600" /> Quality Inspections</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Record QC inspections with custom parameter checklists against work orders.</p>
        </div>
        <button className={btnPrimary} onClick={() => setIsCreateOpen(true)}><FiPlus className="w-4 h-4" /> New Inspection</button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-slate-800 dark:text-white">QC Register</h2><span className="text-xs text-slate-400">{inspections.length} record(s)</span></div>
        {isLoading ? <Loading /> : error ? <p className="text-sm text-red-500">{error.response?.data?.errors?.[0]}</p> :
          inspections.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No inspections recorded.</p> : (
            <div className="space-y-3">
              {inspections.map((i) => (
                <div key={i.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_STYLE[i.qc_status] || STATUS_STYLE.conditional}`}>{i.qc_status}</span>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-white text-sm">{refLabel(i)}</p>
                        <p className="text-xs text-slate-400">{i.reference_type} • inspected {(i.inspection_date || '').replace('T', ' ').slice(0, 19)}</p>
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="text-green-600 dark:text-green-400 font-semibold">P {Number(i.passed_qty || 0)}</span>
                      <span className="ml-3 text-red-600 dark:text-red-400 font-semibold">F {Number(i.failed_qty || 0)}</span>
                    </div>
                  </div>
                  {(i.check_parameters || []).length > 0 && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                      {i.check_parameters.map((p, idx) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 text-xs">
                          <p className="font-semibold text-slate-700 dark:text-white">{p.name}</p>
                          <p className="text-slate-400">Std: {p.standard} | Act: {p.actual}</p>
                          <p className={`font-semibold ${p.result === 'ok' || p.result === 'pass' ? 'text-green-600' : p.result === 'fail' ? 'text-red-600' : 'text-amber-600'}`}>{p.result || 'pending'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {i.remarks && <p className="mt-2 text-xs text-slate-500">{i.remarks}</p>}
                </div>
              ))}
            </div>
          )}
      </div>

      {/** Create inspection modal with checklist */}
      <AnimatePresence>
      {isCreateOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setIsCreateOpen(false)}>
          <motion.div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl my-8" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">New Quality Inspection</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600"><FiX /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold uppercase text-slate-500">Reference Type</label>
                  <select className={inputCls} value={form.reference_type} onChange={(e) => setForm({ ...form, reference_type: e.target.value, reference_id: '' })}>
                    <option value="work_order">Work Order</option><option value="purchase_receipt">Purchase Receipt</option>
                  </select></div>
                <div><label className="text-xs font-semibold uppercase text-slate-500">Reference</label>
                  {form.reference_type === 'work_order' ? (
                    <select className={inputCls} value={form.reference_id} onChange={(e) => setForm({ ...form, reference_id: e.target.value })}>
                      <option value="">Select work order...</option>{wos.map((w) => <option key={w.id} value={w.id}>{w.wo_number}</option>)}
                    </select>
                  ) : (
                    <input type="number" className={inputCls} placeholder="Receipt ID" value={form.reference_id} onChange={(e) => setForm({ ...form, reference_id: e.target.value })} />
                  )}</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-semibold uppercase text-slate-500">Passed Qty</label><input type="number" className={inputCls} value={form.passed_qty} onChange={(e) => setForm({ ...form, passed_qty: e.target.value })} /></div>
                <div><label className="text-xs font-semibold uppercase text-slate-500">Failed Qty</label><input type="number" className={inputCls} value={form.failed_qty} onChange={(e) => setForm({ ...form, failed_qty: e.target.value })} /></div>
                <div><label className="text-xs font-semibold uppercase text-slate-500">Status</label>
                  <select className={inputCls} value={form.qc_status} onChange={(e) => setForm({ ...form, qc_status: e.target.value })}>
                    <option value="passed">Passed</option><option value="failed">Failed</option><option value="conditional">Conditional</option>
                  </select></div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-white">Check Parameters</h4>
                  <button className={btnGhost} onClick={() => setParams((a) => [...a, { name: '', standard: '', actual: '', result: 'pending' }])}>Add Parameter</button>
                </div>
                {form.check_parameters.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                    <div className="col-span-4"><input className={inputCls} placeholder="Parameter name" value={p.name} onChange={(e) => setParams((a) => a.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} /></div>
                    <div className="col-span-3"><input className={inputCls} placeholder="Standard" value={p.standard} onChange={(e) => setParams((a) => a.map((x, i) => i === idx ? { ...x, standard: e.target.value } : x))} /></div>
                    <div className="col-span-3"><input className={inputCls} placeholder="Actual" value={p.actual} onChange={(e) => setParams((a) => a.map((x, i) => i === idx ? { ...x, actual: e.target.value } : x))} /></div>
                    <div className="col-span-1"><select className={inputCls} value={p.result} onChange={(e) => setParams((a) => a.map((x, i) => i === idx ? { ...x, result: e.target.value } : x))}><option value="pass">Pass</option><option value="fail">Fail</option><option value="pending">Pending</option></select></div>
                    <div className="col-span-1"><button onClick={() => setParams((a) => a.filter((_, i) => i !== idx))} className="text-red-500"><FiTrash2 /></button></div>
                  </div>
                ))}
              </div>

              <div><label className="text-xs font-semibold uppercase text-slate-500">Remarks</label>
                <input className={inputCls} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>

              <div className="flex justify-end gap-3">
                <button className={btnGhost} onClick={() => setIsCreateOpen(false)}>Cancel</button>
                <button className={btnPrimary} disabled={!form.reference_id || createMutation.isLoading} onClick={submit}>{createMutation.isLoading ? 'Saving...' : 'Save Inspection'}</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
