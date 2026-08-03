import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft, FiAlertCircle, FiCheckCircle, FiMonitor, FiDatabase,
  FiLogOut, FiRefreshCw, FiMail, FiShield, FiUnlock, FiLock,
  FiCalendar, FiSend, FiCloudSnow,
} from 'react-icons/fi';
import {
  getTenantDetail, suspendTenant, reactivateTenant, extendExpiry,
  changePlan, resetDevice, unlockDevice, forceLogout, forceUpdateCheck,
  sendAnnouncement, triggerRemoteBackup, getPlans,
} from '../../api/admin';

const STATUS_BADGE = {
  active:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  trial:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  expired:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

function SectionCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ActionBtn({ onClick, icon: Icon, label, variant = 'default', loading }) {
  const base = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50';
  const variants = {
    default:  'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600',
    danger:   'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30',
    success:  'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100',
    primary:  'bg-indigo-600 text-white hover:bg-indigo-700 border border-transparent',
  };
  return (
    <button onClick={onClick} disabled={loading} className={`${base} ${variants[variant]}`}>
      <Icon className="text-sm" /> {loading ? 'Working…' : label}
    </button>
  );
}

// ── Announcement modal ────────────────────────────────────────────────────────
function AnnouncementModal({ tenantId, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: 'System Notice', message: '', level: 'info' });
  const mut = useMutation({
    mutationFn: () => sendAnnouncement(tenantId, form),
    onSuccess: () => { qc.invalidateQueries(['admin-tenant', tenantId]); onClose(); },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Send Announcement</h2>
        <div className="space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Message…" rows={3}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!form.message || mut.isLoading}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {mut.isLoading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Extend expiry modal ───────────────────────────────────────────────────────
function ExtendModal({ tenantId, onClose }) {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const mut = useMutation({
    mutationFn: () => extendExpiry(tenantId, days),
    onSuccess: () => { qc.invalidateQueries(['admin-tenant', tenantId]); onClose(); },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Extend Expiry</h2>
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Number of days to add</label>
        <input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={days < 1 || mut.isLoading}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {mut.isLoading ? 'Saving…' : `Add ${days} days`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TenantDetailPage() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // 'announce' | 'extend' | null

  const { data: detailRes, isLoading } = useQuery({
    queryKey: ['admin-tenant', tenantId],
    queryFn: () => getTenantDetail(tenantId),
  });
  const { data: plansRes } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => getPlans(),
  });

  const t      = detailRes?.data?.data;
  const plans  = plansRes?.data?.data || [];

  const mutOpts = (key) => ({
    onSuccess: () => qc.invalidateQueries(['admin-tenant', tenantId]),
    onError: (e) => alert(e?.response?.data?.errors?.[0] || 'Action failed.'),
  });

  const suspendMut    = useMutation({ mutationFn: (r) => suspendTenant(tenantId, r),    ...mutOpts() });
  const reactivateMut = useMutation({ mutationFn: () => reactivateTenant(tenantId),     ...mutOpts() });
  const forceLogMut   = useMutation({ mutationFn: () => forceLogout(tenantId),          ...mutOpts() });
  const forceUpdMut   = useMutation({ mutationFn: () => forceUpdateCheck(tenantId),     ...mutOpts() });
  const remBackMut    = useMutation({ mutationFn: () => triggerRemoteBackup(tenantId),  ...mutOpts() });
  const planMut       = useMutation({ mutationFn: (id) => changePlan(tenantId, id),     ...mutOpts() });
  const deviceResetMut = useMutation({ mutationFn: (id) => resetDevice(tenantId, id),  ...mutOpts() });
  const deviceUnlockMut= useMutation({ mutationFn: (id) => unlockDevice(tenantId, id), ...mutOpts() });

  if (isLoading) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Loading tenant…</div>;
  }
  if (!t) {
    return <div className="text-center text-gray-400 mt-12">Tenant not found.</div>;
  }

  const isSuspended = t.db_status === 'suspended';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <FiArrowLeft className="text-lg" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t.subdomain} · {t.contact_email}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[t.db_status] || STATUS_BADGE.expired}`}>
          {t.db_status}
        </span>
      </div>

      {/* Quick actions */}
      <SectionCard title="Quick Actions">
        <div className="flex flex-wrap gap-2">
          {isSuspended ? (
            <ActionBtn onClick={() => reactivateMut.mutate()} loading={reactivateMut.isLoading}
              icon={FiCheckCircle} label="Reactivate" variant="success" />
          ) : (
            <ActionBtn onClick={() => { const r = prompt('Reason for suspension?', 'Policy violation'); if (r) suspendMut.mutate(r); }}
              loading={suspendMut.isLoading} icon={FiAlertCircle} label="Suspend" variant="danger" />
          )}
          <ActionBtn onClick={() => setModal('extend')} icon={FiCalendar} label="Extend Expiry" />
          <ActionBtn onClick={() => setModal('announce')} icon={FiSend} label="Send Announcement" />
          <ActionBtn onClick={() => forceLogMut.mutate()} loading={forceLogMut.isLoading}
            icon={FiLogOut} label="Force Logout" variant="danger" />
          <ActionBtn onClick={() => forceUpdMut.mutate()} loading={forceUpdMut.isLoading}
            icon={FiRefreshCw} label="Force Update Check" />
          <ActionBtn onClick={() => remBackMut.mutate()} loading={remBackMut.isLoading}
            icon={FiCloudSnow} label="Trigger Backup" variant="primary" />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* License info */}
        <SectionCard title="License">
          {t.license ? (
            <dl className="space-y-2 text-sm">
              {[
                ['Key', t.license.license_key],
                ['Status', t.license.status],
                ['Trial', t.license.is_trial ? 'Yes' : 'No'],
                ['Expires', t.license.expires_at ? new Date(t.license.expires_at).toLocaleString() : '—'],
                ['Last Verified', t.license.last_verified_at ? new Date(t.license.last_verified_at).toLocaleString() : 'Never'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                  <dd className="font-medium text-gray-900 dark:text-white text-right max-w-48 truncate">{v}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="text-sm text-gray-400">No license found.</p>}
        </SectionCard>

        {/* Change plan */}
        <SectionCard title="Change Plan">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Current: <strong className="text-gray-900 dark:text-white">{t.plan_name || '—'}</strong>
          </p>
          <div className="space-y-2">
            {plans.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</div>
                  <div className="text-xs text-gray-400">₹{p.price}/{p.billing_cycle} · {p.max_users} users · {p.allowed_devices} devices</div>
                </div>
                <button
                  onClick={() => planMut.mutate(p.id)}
                  disabled={planMut.isLoading}
                  className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Switch
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Devices */}
      <SectionCard title={`Registered Devices (${(t.devices || []).length})`}>
        {(t.devices || []).length === 0 ? (
          <p className="text-sm text-gray-400">No devices registered.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                  {['Device', 'OS', 'App Ver', 'DB Ver', 'Last Sync', 'IP', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {t.devices.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <FiMonitor className="text-gray-400" />
                        <span className="text-gray-900 dark:text-white font-medium">{d.device_name || d.device_id.slice(0, 12) + '…'}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{d.os_info || '—'}</td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{d.app_version || '—'}</td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{d.db_schema_version || '—'}</td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-gray-400 text-xs">
                      {d.last_sync_at ? new Date(d.last_sync_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-gray-400 text-xs">{d.last_ip_address || '—'}</td>
                    <td className="py-2 pr-4">
                      {d.is_locked
                        ? <span className="text-xs text-red-500 font-medium flex items-center gap-1"><FiLock /> Locked</span>
                        : <span className="text-xs text-emerald-500 font-medium flex items-center gap-1"><FiUnlock /> Active</span>}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        {d.is_locked ? (
                          <button onClick={() => deviceUnlockMut.mutate(d.id)}
                            className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded hover:bg-emerald-200">
                            Unlock
                          </button>
                        ) : (
                          <button onClick={() => deviceResetMut.mutate(d.id)}
                            className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200">
                            Reset
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Recent backups */}
      <SectionCard title="Recent Backups">
        {(t.recent_backups || []).length === 0 ? (
          <p className="text-sm text-gray-400">No backups yet.</p>
        ) : (
          <div className="space-y-2">
            {t.recent_backups.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 text-sm">
                <div className="flex items-center gap-3">
                  <FiDatabase className={b.status === 'completed' ? 'text-emerald-500' : 'text-red-400'} />
                  <div>
                    <div className="text-gray-900 dark:text-white font-medium">{b.file_name}</div>
                    <div className="text-xs text-gray-400">
                      {b.backup_type} · {b.file_size ? `${(b.file_size / 1024).toFixed(1)} KB` : '—'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600'}`}>
                    {b.status}
                  </span>
                  <div className="text-xs text-gray-400 mt-1">
                    {b.completed_at ? new Date(b.completed_at).toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Modals */}
      <AnimatePresence>
        {modal === 'announce' && <AnnouncementModal tenantId={tenantId} onClose={() => setModal(null)} />}
        {modal === 'extend'   && <ExtendModal tenantId={tenantId} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
}
