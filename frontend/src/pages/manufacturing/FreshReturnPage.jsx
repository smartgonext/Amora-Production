import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiTruck, FiPlus } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

const inputCls = "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50";

const STATUS_CLS = {
  fresh: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  near_expiry: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  planned: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  in_transit: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function FreshReturnPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const { data: fefoRes } = useQuery({ queryKey: ['fefo'], queryFn: async () => (await apiClient.get('/bakery/fefo')).data });
  const fefo = fefoRes?.data || [];
  const { data: routesRes } = useQuery({ queryKey: ['delivery-routes', date], queryFn: async () => (await apiClient.get('/bakery/delivery-routes', { params: { route_date: date } })).data });
  const routes = routesRes?.data || [];

  const createRoute = useMutation({
    mutationFn: (p) => apiClient.post('/bakery/delivery-routes', p),
    onSuccess: () => { toast.success('Route created'); qc.invalidateQueries({ queryKey: ['delivery-routes'] }); },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed'),
  });
  const updateRouteStatus = useMutation({
    mutationFn: ({ id, status }) => apiClient.put(`/bakery/delivery-routes/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-routes'] }),
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg"><FiTruck className="text-white text-xl" /></div>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Fresh Returns &amp; Delivery</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">FEFO freshness and daily delivery routes.</p>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">FEFO — Stock by Expiry</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <th className="py-2 pr-3">Product</th><th className="py-2 pr-3">Batch</th><th className="py-2 pr-3">Qty</th><th className="py-2 pr-3">Expiry</th><th className="py-2 pr-3">Days</th><th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {fefo.map((b) => (
              <tr key={b.batch_id}>
                <td className="py-2 pr-3 font-semibold text-slate-800 dark:text-white">{b.product_name || `Product #${b.product_id}`}</td>
                <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{b.batch_no}</td>
                <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{b.quantity}</td>
                <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{b.expiry_date || '-'}</td>
                <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{b.days_to_expiry ?? '-'}</td>
                <td className="py-2"><span className={`px-2 py-1 rounded-lg text-xs font-semibold ${STATUS_CLS[b.status] || 'bg-slate-100 text-slate-600'}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Route Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <button onClick={() => createRoute.mutate({ route_date: date, driver: 'Driver', customer_ids: [] })} className={btnPrimary}><FiPlus /> New Route</button>
        </div>
        {routes.length === 0 ? (
          <p className="text-sm text-slate-400">No routes for this date.</p>
        ) : (
          <div className="space-y-3">
            {routes.map((r) => (
              <div key={r.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{r.route_date} · {r.vehicle_no || 'No vehicle'} · {r.driver || 'No driver'}</p>
                    <p className="text-xs text-slate-400">{r.stops.length} stop(s)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${STATUS_CLS[r.status] || 'bg-slate-100 text-slate-600'}`}>{r.status}</span>
                    <select className="text-xs border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300" value={r.status} onChange={(e) => updateRouteStatus.mutate({ id: r.id, status: e.target.value })}>
                      <option value="planned">Planned</option><option value="in_transit">In Transit</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
