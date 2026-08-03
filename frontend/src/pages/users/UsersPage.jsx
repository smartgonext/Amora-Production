import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiUser, FiMail,
  FiPhone, FiShield, FiMapPin, FiAlertTriangle, FiCheckCircle, FiXCircle, FiKey
} from 'react-icons/fi';
import apiClient from '../../api/client';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';

// ─── API helpers ─────────────────────────────────────────────────────────────
const fetchUsers     = (q) => apiClient.get('/users',         { params: { q, page_size: 100 } }).then((r) => r.data.data || []);
const fetchRoles     = ()   => apiClient.get('/users/roles').then((r) => r.data.data || []);
const fetchBranches  = (cid) => apiClient.get('/branches', { params: { company_id: cid, page_size: 100 } }).then((r) => r.data.data || []);
const createUser     = (p)  => apiClient.post('/users', p).then((r) => r.data.data);
const updateUser     = ({ id, ...p }) => apiClient.put(`/users/${id}`, p).then((r) => r.data.data);
const deleteUser     = (id) => apiClient.delete(`/users/${id}`).then((r) => r.data);

// ─── Role badge colours ───────────────────────────────────────────────────────
const roleBadge = (roleName) => {
  const map = {
    Admin: 'badge-danger', Manager: 'badge-warning', Accountant: 'badge-info',
    'Sales Person': 'badge-success', Cashier: 'badge-gray',
  };
  return map[roleName] || 'badge-gray';
};

// ─── User modal ───────────────────────────────────────────────────────────────
const BLANK = {
  name: '', email: '', phone: '', password: '', role_id: '', branch_id: '',
  is_active: true, preferred_language: 'en', theme_preference: 'light',
};

function UserModal({ initial, roles, branches, onClose, onSave }) {
  const [form, setForm] = useState(initial
    ? { ...initial, password: '', role_id: initial.role_id || '', branch_id: initial.branch_id || '' }
    : BLANK
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    if (!isEdit && !form.password) e.password = 'Password is required for new users';
    if (form.password && form.password.length < 8) e.password = 'Min 8 characters';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password; // don't send blank pw on edit
      if (!payload.role_id) delete payload.role_id;
      if (!payload.branch_id) delete payload.branch_id;
      await onSave(payload);
      onClose();
    } catch (err) {
      setErrors({ api: err?.response?.data?.errors?.[0] || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const Inp = ({ label, name, type = 'text', required, placeholder }) => (
    <div>
      <label className="label">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      <input
        type={type}
        value={form[name] || ''}
        onChange={(e) => set(name, e.target.value)}
        placeholder={placeholder}
        className={`input-field ${errors[name] ? 'border-red-500' : ''}`}
      />
      {errors[name] && <p className="error-text">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-10 animate-fadeIn max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Edit User' : 'Add New User'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errors.api && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <FiAlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{errors.api}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Inp label="Full Name" name="name" required /></div>
            <Inp label="Email" name="email" type="email" required />
            <Inp label="Phone" name="phone" type="tel" />

            {/* Role */}
            <div>
              <label className="label">Role</label>
              <select
                value={form.role_id}
                onChange={(e) => set('role_id', e.target.value)}
                className="input-field"
              >
                <option value="">— No Role —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="label">Branch</label>
              <select
                value={form.branch_id}
                onChange={(e) => set('branch_id', e.target.value)}
                className="input-field"
              >
                <option value="">— All Branches —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Password */}
            <div className="col-span-2">
              <Inp
                label={isEdit ? 'New Password (leave blank to keep)' : 'Password'}
                name="password"
                type="password"
                required={!isEdit}
                placeholder={isEdit ? '••••••••' : 'Min 8 characters'}
              />
            </div>

            {/* Theme & Language */}
            <div>
              <label className="label">Language</label>
              <select value={form.preferred_language} onChange={(e) => set('preferred_language', e.target.value)} className="input-field">
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="ta">Tamil</option>
                <option value="te">Telugu</option>
              </select>
            </div>
            <div>
              <label className="label">Theme</label>
              <select value={form.theme_preference} onChange={(e) => set('theme_preference', e.target.value)} className="input-field">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox" id="active"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Account is active
            </label>
          </div>
        </form>

        <div className="flex justify-end space-x-3 p-6 pt-0">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="submit"
            form="user-form"
            disabled={saving}
            onClick={handleSubmit}
            className="btn-primary"
          >
            {saving ? 'Saving…' : isEdit ? 'Update User' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ user: target, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-10 p-6 animate-fadeIn">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <FiAlertTriangle className="w-7 h-7 text-red-600" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center">Remove User?</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
          <strong>{target.name}</strong>'s account will be deactivated. Data is preserved.
        </p>
        <div className="flex space-x-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false); }}
            disabled={deleting}
            className="btn-danger flex-1"
          >
            {deleting ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { company } = useCompany();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [delTarget, setDelTarget] = useState(null);

  const { data: users = [], isLoading }   = useQuery({ queryKey: ['users', search], queryFn: () => fetchUsers(search) });
  const { data: roles = [] }              = useQuery({ queryKey: ['roles'],          queryFn: fetchRoles });
  const { data: branches = [] }           = useQuery({
    queryKey: ['branches-for-users', currentUser?.company_id],
    queryFn:  () => fetchBranches(currentUser?.company_id),
    enabled: !!currentUser?.company_id,
  });

  const invalidate = () => qc.invalidateQueries(['users']);

  const createMut = useMutation({ mutationFn: createUser, onSuccess: invalidate });
  const updateMut = useMutation({ mutationFn: updateUser, onSuccess: invalidate });
  const deleteMut = useMutation({ mutationFn: deleteUser, onSuccess: invalidate });

  const handleSave = (data) =>
    modal.mode === 'add'
      ? createMut.mutateAsync(data)
      : updateMut.mutateAsync({ id: modal.user.id, ...data });

  const filtered = roleFilter
    ? users.filter((u) => String(u.role_id) === roleFilter)
    : users;

  const initials = (name) => name?.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Users & Roles</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage team members and access control for{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {company?.name || 'your company'}
            </span>
          </p>
        </div>
        <button onClick={() => setModal({ mode: 'add' })} className="btn-primary flex items-center space-x-2">
          <FiPlus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',   value: users.length,                          color: 'text-blue-600' },
          { label: 'Active',        value: users.filter((u) => u.is_active).length, color: 'text-green-600' },
          { label: 'Inactive',      value: users.filter((u) => !u.is_active).length, color: 'text-red-600' },
          { label: 'Roles Defined', value: roles.length,                          color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="card py-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text" placeholder="Search users…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All Roles</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {/* Roles reference bar */}
      {roles.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center space-x-1">
            <FiShield className="w-4 h-4" /><span>Available Roles</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setRoleFilter(String(r.id) === roleFilter ? '' : String(r.id))}
                className={`badge ${String(r.id) === roleFilter ? 'badge-info ring-2 ring-blue-400' : 'badge-gray'} cursor-pointer`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 space-y-3 text-gray-400">
            <FiUser className="w-12 h-12" />
            <p className="text-sm">
              {search ? 'No users match your search.' : 'No users yet. Add your first team member.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  {['User', 'Contact', 'Role', 'Branch', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="table-header-cell">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((u) => (
                  <tr key={u.id} className="table-row">
                    {/* User */}
                    <td className="table-cell">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {initials(u.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{u.name}</p>
                          {u.id === currentUser?.id && (
                            <span className="text-xs text-primary-600 font-medium">(you)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Contact */}
                    <td className="table-cell">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400">
                          <FiMail className="w-3 h-3" /><span>{u.email}</span>
                        </div>
                        {u.phone && (
                          <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400">
                            <FiPhone className="w-3 h-3" /><span>{u.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Role */}
                    <td className="table-cell">
                      {u.role_name
                        ? <span className={`badge ${roleBadge(u.role_name)}`}>{u.role_name}</span>
                        : <span className="text-gray-400 text-xs">—</span>
                      }
                    </td>
                    {/* Branch */}
                    <td className="table-cell">
                      {u.branch_name
                        ? <div className="flex items-center space-x-1 text-xs"><FiMapPin className="w-3 h-3 text-gray-400" /><span>{u.branch_name}</span></div>
                        : <span className="text-gray-400 text-xs">All branches</span>
                      }
                    </td>
                    {/* Status */}
                    <td className="table-cell">
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active
                          ? <><FiCheckCircle className="w-3 h-3 mr-1" />Active</>
                          : <><FiXCircle className="w-3 h-3 mr-1" />Inactive</>
                        }
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setModal({ mode: 'edit', user: u })}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => setDelTarget(u)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove user"
                          >
                            <FiTrash2 className="w-4 h-4" />
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
      </div>

      {/* Modals */}
      {modal && (
        <UserModal
          initial={modal.mode === 'edit' ? modal.user : null}
          roles={roles}
          branches={branches}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {delTarget && (
        <DeleteConfirm
          user={delTarget}
          onClose={() => setDelTarget(null)}
          onConfirm={async () => {
            await deleteMut.mutateAsync(delTarget.id);
            setDelTarget(null);
          }}
        />
      )}
    </div>
  );
}
