import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiUsers, FiAlertCircle, FiCheckCircle, FiClock,
  FiMonitor, FiSearch, FiFilter, FiRefreshCw,
} from 'react-icons/fi';
import { getAdminStats, getTenants } from '../../api/admin';

const STATUS_COLORS = {
  active:        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  suspended:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  trial:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  trial_expired: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  expired:       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4"
    >
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="text-xl" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value ?? '—'}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

export default function AdminDashboardPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: statsRes } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => getAdminStats(),
    staleTime: 30_000,
  });

  const { data: tenantsRes, isLoading, refetch } = useQuery({
    queryKey: ['admin-tenants', search, statusFilter, page],
    queryFn: () => getTenants({ q: search, status: statusFilter, page, page_size: 20 }),
    keepPreviousData: true,
  });

  const stats   = statsRes?.data?.data   || {};
  const tenants = tenantsRes?.data?.data || [];
  const meta    = tenantsRes?.data?.meta || {};

  const statCards = [
    { label: 'Total Tenants',   value: stats.total_tenants,  icon: FiUsers,        color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
    { label: 'Active',          value: stats.active_tenants, icon: FiCheckCircle,  color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { label: 'Suspended',       value: stats.suspended,      icon: FiAlertCircle,  color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
    { label: 'Trial',           value: stats.trial,          icon: FiClock,        color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    { label: 'Expiring in 7d',  value: stats.expiring_soon,  icon: FiClock,        color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
    { label: 'Active Devices',  value: stats.active_devices, icon: FiMonitor,      color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage all tenants, licenses, and devices</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        >
          <FiRefreshCw className="text-sm" /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <FiFilter className="text-gray-400 text-sm" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="trial_expired">Trial Expired</option>
          </select>
        </div>
      </div>

      {/* Tenant table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
              <tr>
                {['Tenant', 'Plan', 'Status', 'Expiry', 'Devices', 'Last Backup', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No tenants found.</td>
                </tr>
              ) : tenants.map((t) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.subdomain}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t.plan_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.db_status] || STATUS_COLORS.expired}`}>
                      {t.db_status || t.subscription_status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {t.expiry_date
                      ? <span className={t.days_remaining != null && t.days_remaining <= 7 ? 'text-orange-500 font-medium' : ''}>
                          {new Date(t.expiry_date).toLocaleDateString()}
                          {t.days_remaining != null && ` (${t.days_remaining}d)`}
                        </span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {t.active_device_count}/{t.device_count}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {t.last_backup_at
                      ? new Date(t.last_backup_at).toLocaleString()
                      : <span className="text-orange-400">Never</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/tenants/${t.id}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium text-xs"
                    >
                      Manage →
                    </Link>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.total > meta.page_size && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Showing {((page - 1) * meta.page_size) + 1}–{Math.min(page * meta.page_size, meta.total)} of {meta.total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">
                Previous
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * meta.page_size >= meta.total}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
