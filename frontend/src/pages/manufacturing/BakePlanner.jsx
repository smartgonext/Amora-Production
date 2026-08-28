import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiCalendar, FiPlus, FiRefreshCw } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

const inputCls =
  "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
const btnPrimary =
  "inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50";

const STATUS_STYLES = {
  planned: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function BakePlanner() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [shift, setShift] = useState('Morning');

  const { data: plansRes, isLoading, error } = useQuery({
    queryKey: ['bake-plans', date],
    queryFn: async () => (await apiClient.get('/bakery/bake-plans', { params: { plan_date: date } })).data,
  });
  const plans = plansRes?.data || [];

  const generateMutation = useMutation({
    mutationFn: () => apiClient.post('/bakery/bake-plans', { plan_date: date, shift }),
    onSuccess: () => {
      toast.success('Bake plan generated');
      qc.invalidateQueries({ queryKey: ['bake-plans'] });
    },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed to generate plan'),
  });

  const updateLineMutation = useMutation({
    mutationFn: ({ id, payload }) => apiClient.put(`/bakery/bake-plans/items/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bake-plans'] }),
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Update failed'),
  });


  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <FiCalendar className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Daily Bake Planner</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            What do we bake today? Demand from confirmed orders + same-weekday sales history.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Bake Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Shift</label>
          <select value={shift} onChange={(e) => setShift(e.target.value)} className={inputCls}>
            <option>Morning</option>
            <option>Evening</option>
            <option>Night</option>
          </select>
        </div>
        <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className={btnPrimary}>
          <FiPlus /> {generateMutation.isPending ? 'Generating...' : 'Generate Plan'}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-500">Failed to load plans</p>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          <FiRefreshCw className="text-slate-300 dark:text-slate-600 w-10 h-10 mb-3" />
          <p className="text-sm text-slate-400">No bake plan for this date. Click 'Generate Plan'.</p>
        </div>
      ) : (
        plans.map((plan) => (
          <div key={plan.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-white">{plan.plan_date} · {plan.shift}</p>
                <p className="text-xs text-slate-400">{plan.items.length} product(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLES[plan.status] || STATUS_STYLES.planned}`}>{plan.status}</span>
                <select
                  className="text-xs border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  value={plan.status}
                  onChange={(e) => updatePlanStatus.mutate({ id: plan.id, status: e.target.value })}
                >
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-5 py-3">Product</th>
                    <th className="px-3 py-3">Order</th>
                    <th className="px-3 py-3">Forecast</th>
                    <th className="px-3 py-3">Planned</th>
                    <th className="px-3 py-3">Batch</th>
                    <th className="px-3 py-3">#Bat</th>
                    <th className="px-3 py-3">Oven</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {plan.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-5 py-3 font-semibold text-slate-800 dark:text-white">Product #{it.product_id}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{it.order_demand}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{it.forecast_qty}</td>
                      <td className="px-3 py-3 w-24">
                        <input type="number" min="0" value={it.planned_qty}
                          onChange={(e) => updateLineMutation.mutate({ id: it.id, payload: { planned_qty: Number(e.target.value) } })}
                          className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm" />
                      </td>
                      <td className="px-3 py-3 w-24">
                        <input type="number" min="1" value={it.batch_size}
                          onChange={(e) => updateLineMutation.mutate({ id: it.id, payload: { batch_size: Number(e.target.value) } })}
                          className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm" />
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{it.num_batches}</td>
                      <td className="px-3 py-3 w-28">
                        <input type="text" value={it.oven || ''} placeholder="Oven-1"
                          onChange={(e) => updateLineMutation.mutate({ id: it.id, payload: { oven: e.target.value } })}
                          className="w-24 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm" />
                      </td>
                      <td className="px-3 py-3">
                        <select className="text-xs border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          value={it.status}
                          onChange={(e) => updateLineMutation.mutate({ id: it.id, payload: { status: e.target.value } })}>
                          <option value="planned">Planned</option>
                          <option value="baking">Baking</option>
                          <option value="done">Done</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

