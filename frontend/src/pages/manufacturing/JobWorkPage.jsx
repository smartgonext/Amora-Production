import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiTruck, FiPlus, FiX, FiCheckCircle, FiRepeat } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

const inputCls = "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition";
const btnGhost = "inline-flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm rounded-lg transition";
const badge = "px-2 py-1 rounded text-xs font-semibold";

function Loading() { return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" />; }

const STATUS_BADGE = {
  sent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  partially_received: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

export default function JobWorkPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({ vendor_id: '', work_order_id: '', issue_challan_no: '', materials_sent: '', expected_return_date: '', service_cost: 0 });

  const { data: jwRes, isLoading, error } = useQuery({ queryKey: ['job-orders'], queryFn: async () => (await apiClient.get('/manufacturing/job-orders')).data });
  const jws = jwRes?.data || [];
  const { data: suppliersRes } = useQuery({ queryKey: ['suppliers', 'job-work'], queryFn: async () => (await apiClient.get('/suppliers', { params: { is_job_work_vendor: 'true' } })).data });
  const suppliers = suppliersRes?.data || [];
  const { data: woRes } = useQuery({ queryKey: ['work-orders'], queryFn: async () => (await apiClient.get('/manufacturing/work-orders')).data });
  const wos = woRes?.data || [];

  const createMutation = useMutation({
    mutationFn: (p) => apiClient.post('/manufacturing/job-orders', p),
    onSuccess: () => { toast.success('Job work order sent'); queryClient.invalidateQueries({ queryKey: ['job-orders'] }); setIsCreateOpen(false); },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed to create'),
  });
  const receiveMutation = useMutation({
    mutationFn: ({ id, data }) => apiClient.post(`/manufacturing/job-orders/${id}/receive`, data),
    onSuccess: () => { toast.success('Job work received'); queryClient.invalidateQueries({ queryKey: ['job-orders'] }); },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Receive failed'),
  });

  const vendorOf = (id) => { const s = suppliers.find((x) => x.id === Number(id)); return s ? s.name : `#${id}`; };

  const submit = () => {
    let materials_sent = [];
    try { materials_sent = form.materials_sent ? JSON.parse(form.materials_sent) : []; } catch { toast.error('materials_sent must be valid JSON array'); return; }
    createMutation.mutate({
      vendor_id: Number(form.vendor_id), work_order_id: form.work_order_id ? Number(form.work_order_id) : null,
      issue_challan_no: form.issue_challan_no, materials_sent,
      expected_return_date: form.expected_return_date || null, service_cost: Number(form.service_cost || 0),
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><FiTruck className="w-6 h-6 text-indigo-600" /> Job Work & Subcontracting</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Outward / inward challans for subcontractor vendor assignments.</p>
        </div>
        <button className={btnPrimary} onClick={() => setIsCreateOpen(true)}><FiPlus className="w-4 h-4" /> New Job Work Order</button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800 dark:text-white">Job Work Orders</h2><span className="text-xs text-slate-400">{jws.length} record(s)</span>
        </div>
        {isLoading ? <Loading /> : error ? <p className="text-sm text-red-500">{error.response?.data?.errors?.[0]}</p> :
          jws.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No job work orders yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 uppercase border-b dark:border-slate-700">
                  <th className="py-2 pr-3">Challan</th><th className="py-2 pr-3">Vendor</th><th className="py-2 pr-3">Work Order</th>
                  <th className="py-2 pr-3">Materials</th><th className="py-2 pr-3">Service Cost</th><th className="py-2 pr-3">Expected Return</th><th className="py-2 pr-3">Status</th><th className="py-2">Action</th>
                </tr></thead>
                <tbody>
                  {jws.map((j) => (
                    <tr key={j.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 pr-3 font-mono text-indigo-600 dark:text-indigo-400">{j.issue_challan_no}</td>
                      <td className="py-2 pr-3 font-medium text-slate-800 dark:text-white">{vendorOf(j.vendor_id)}</td>
                      <td className="py-2 pr-3">{j.work_order_id ? `#${j.work_order_id}` : '-'}</td>
                      <td className="py-2 pr-3">{(j.materials_sent || []).length} item(s)</td>
                      <td className="py-2 pr-3">{Number(j.service_cost || 0).toFixed(2)}</td>
                      <td className="py-2 pr-3">{(j.expected_return_date || '').slice(0, 10)}</td>
                      <td className="py-2 pr-3"><span className={`${badge} ${STATUS_BADGE[j.status] || STATUS_BADGE.sent}`}>{j.status.replace('_', ' ')}</span></td>
                      <td className="py-2">
                        {j.status !== 'completed' && (
                          <button className="btn-small bg-green-600 text-white" onClick={() => receiveMutation.mutate({ id: j.id, data: { received_units: (j.materials_sent || []).length } })}><FiCheckCircle className="w-3 h-3" /> Receive</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/** Create modal */}
      <AnimatePresence>
      {isCreateOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setIsCreateOpen(false)}>
          <motion.div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg my-8" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">New Job Work Order</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600"><FiX /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="text-xs font-semibold uppercase text-slate-500">Vendor (Job Worker)</label>
                <select className={inputCls} value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}><option value="">Select vendor...</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold uppercase text-slate-500">Issue Challan No</label><input className={inputCls} value={form.issue_challan_no} onChange={(e) => setForm({ ...form, issue_challan_no: e.target.value })} /></div>
                <div><label className="text-xs font-semibold uppercase text-slate-500">Related Work Order</label>
                  <select className={inputCls} value={form.work_order_id} onChange={(e) => setForm({ ...form, work_order_id: e.target.value })}><option value="">None</option>{wos.map((w) => <option key={w.id} value={w.id}>{w.wo_number}</option>)}</select></div>
              </div>
              <div><label className="text-xs font-semibold uppercase text-slate-500">Materials Sent (JSON)</label>
                <textarea rows={3} className={inputCls} placeholder='[{"item_id":1,"qty":2,"uom":"Pcs"}]' value={form.materials_sent} onChange={(e) => setForm({ ...form, materials_sent: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold uppercase text-slate-500">Expected Return</label><input type="date" className={inputCls} value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} /></div>
                <div><label className="text-xs font-semibold uppercase text-slate-500">Service Cost</label><input type="number" className={inputCls} value={form.service_cost} onChange={(e) => setForm({ ...form, service_cost: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-3">
                <button className={btnGhost} onClick={() => setIsCreateOpen(false)}>Cancel</button>
                <button className={btnPrimary} disabled={!form.vendor_id || !form.issue_challan_no} onClick={submit}><FiTruck className="w-4 h-4" /> Send to Vendor</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
