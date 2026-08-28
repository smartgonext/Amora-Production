import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiBarChart2, FiRefreshCw } from 'react-icons/fi';
import apiClient from '../../api/client';

const inputCls = "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function DayCostReport() {
  const [date, setDate] = useState(todayISO());
  const { data: repRes, isLoading } = useQuery({
    queryKey: ['day-cost', date],
    queryFn: async () => (await apiClient.get('/bakery/day-cost', { params: { date } })).data,
  });
  const report = repRes?.data;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg"><FiBarChart2 className="text-white text-xl" /></div>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Bake-Day Cost &amp; Variance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Day-level production summary: planned output vs unsold/waste value.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-end gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <FiRefreshCw className="text-slate-400 mb-2" />
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 mt-4">Loading...</p>
        ) : report ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Date</p>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{report.date}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Planned Units</p>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{report.planned_units}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Return/Waste Value</p>
              <p className="text-sm font-bold text-red-600">&#8377;{report.unsold_return_cost}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Work Orders</p>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{report.work_order_count}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 mt-4">No data.</p>
        )}
      </div>
    </div>
  );
}
