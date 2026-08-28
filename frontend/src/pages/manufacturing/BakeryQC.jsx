import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiShield, FiPlus, FiRefreshCw } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

const inputCls = "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50";

export default function BakeryQC() {
  const qc = useQueryClient();
  const [checkpoint, setCheckpoint] = useState({ checkpoint_name: '', recorded_value: '', spec_min: '', spec_max: '', unit: '', is_pass: true, corrective_action: '' });

  const { data: checksRes } = useQuery({ queryKey: ['haccp'], queryFn: async () => (await apiClient.get('/bakery/haccp')).data });
  const checks = checksRes?.data || [];

  const addCheck = useMutation({
    mutationFn: (payload) => apiClient.post('/bakery/haccp', payload),
    onSuccess: () => {
      toast.success('HACCP check recorded');
      setCheckpoint({ checkpoint_name: '', recorded_value: '', spec_min: '', spec_max: '', unit: '', is_pass: true, corrective_action: '' });
      qc.invalidateQueries({ queryKey: ['haccp'] });
    },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed'),
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg"><FiShield className="text-white text-xl" /></div>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">HACCP Food-Safety QC</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Record control-point checks against bake batches.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Record a control-point check</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input placeholder="Checkpoint (e.g. Oven Temp)" className={inputCls} value={checkpoint.checkpoint_name}
            onChange={(e) => setCheckpoint({ ...checkpoint, checkpoint_name: e.target.value })} />
          <input placeholder="Recorded value" className={inputCls} value={checkpoint.recorded_value}
            onChange={(e) => setCheckpoint({ ...checkpoint, recorded_value: e.target.value })} />
          <input placeholder="Spec min" className={inputCls} value={checkpoint.spec_min}
            onChange={(e) => setCheckpoint({ ...checkpoint, spec_min: e.target.value })} />
          <input placeholder="Spec max" className={inputCls} value={checkpoint.spec_max}
            onChange={(e) => setCheckpoint({ ...checkpoint, spec_max: e.target.value })} />
          <input placeholder="Unit (C, pH, %)" className={inputCls} value={checkpoint.unit}
            onChange={(e) => setCheckpoint({ ...checkpoint, unit: e.target.value })} />
          <input placeholder="Corrective action (if fail)" className={inputCls} value={checkpoint.corrective_action}
            onChange={(e) => setCheckpoint({ ...checkpoint, corrective_action: e.target.value })} />
        </div>
        <div className="flex items-center gap-4 mt-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={checkpoint.is_pass}
              onChange={(e) => setCheckpoint({ ...checkpoint, is_pass: e.target.checked })} /> Pass
          </label>
          <button onClick={() => addCheck.mutate(checkpoint)} className={btnPrimary}><FiPlus /> Save Check</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Checks</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <th className="py-2 pr-3">Checkpoint</th><th className="py-2 pr-3">Recorded</th>
              <th className="py-2 pr-3">Spec</th><th className="py-2 pr-3">Unit</th><th className="py-2">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {checks.map((c) => (
              <tr key={c.id}>
                <td className="py-2 pr-3 font-semibold text-slate-800 dark:text-white">{c.checkpoint_name}</td>
                <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{c.recorded_value || '-'}</td>
                <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{c.spec_min ?? '-'} - {c.spec_max ?? '-'}</td>
                <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{c.unit || '-'}</td>
                <td className="py-2">
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${c.is_pass ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                    {c.is_pass ? 'PASS' : 'FAIL'}
                  </span>
                </td>
              </tr>
            ))}
            {checks.length === 0 && <tr><td className="py-4 text-slate-400">No checks recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
