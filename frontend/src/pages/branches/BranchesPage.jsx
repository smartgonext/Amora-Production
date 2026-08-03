import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FiPlus, FiEdit2, FiTrash2, FiMapPin, FiSearch, FiX,
  FiCheckCircle, FiXCircle, FiPhone, FiMail, FiAlertTriangle
} from 'react-icons/fi';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';

// ─── API helpers ─────────────────────────────────────────────────────────────
const fetchBranches = (companyId, search) =>
  apiClient
    .get('/branches', { params: { company_id: companyId, q: search, page_size: 100 } })
    .then((r) => r.data.data || []);

const createBranch = (payload) =>
  apiClient.post('/branches', payload).then((r) => r.data.data);

const updateBranch = ({ id, ...payload }) =>
  apiClient.put(`/branches/${id}`, payload).then((r) => r.data.data);

const deleteBranch = (id) =>
  apiClient.delete(`/branches/${id}`).then((r) => r.data);

const toggleBranch = ({ id, active }) =>
  apiClient
    .post(`/branches/${id}/${active ? 'activate' : 'deactivate'}`)
    .then((r) => r.data.data);

// ─── Blank form ───────────────────────────────────────────────────────────────
const BLANK = {
  name: '', code: '', address: '', city: '', state: '', phone: '', email: '', is_active: true,
};

// ─── Modal ───────────────────────────────────────────────────────────────────
function BranchModal({ initial, companyId, onClose, onSave }) {
  const [form, setForm] = useState(initial || BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Branch name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({ ...form, company_id: companyId });
      onClose();
    } catch (err) {
      setErrors({ api: err?.response?.data?.errors?.[0] || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, name, type = 'text', required }) => (
    <div>
      <label className="label">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      <input
        type={type}
        value={form[name] || ''}
        onChange={(e) => set(name, e.target.value)}
        className={`input-field ${errors[name] ? 'border-red-500' : ''}`}
      />
      {errors[name] && <p className="error-text">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-10 animate-fadeIn">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {initial ? 'Edit Branch' : 'Add New Branch'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.api && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <FiAlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{errors.api}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Field label="Branch Name" name="name" required /></div>
            <Field label="Branch Code" name="code" />
            <Field label="Phone" name="phone" type="tel" />
            <div className="col-span-2"><Field label="Email" name="email" type="email" /></div>
            <div className="col-span-2"><Field label="Address" name="address" /></div>
            <Field label="City" name="city" />
            <Field label="State" name="state" />
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Active branch
            </label>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : initial ? 'Update Branch' : 'Create Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ branch, onClose, onConfirm }) {
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
        <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center">Delete Branch?</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
          <strong>{branch.name}</strong> will be soft-deleted. This action can be reversed by an admin.
        </p>
        <div className="flex space-x-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={async () => {
              setDeleting(true);
              await onConfirm();
              setDeleting(false);
            }}
            disabled={deleting}
            className="btn-danger flex-1"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BranchesPage() {
  const { user } = useAuth();
  const { company, refreshBranches } = useCompany();
  const qc = useQueryClient();
  const companyId = user?.company_id;

  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);      // null | { mode: 'add' | 'edit', branch?: {} }
  const [delTarget, setDelTarget] = useState(null);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', companyId, search],
    queryFn: () => fetchBranches(companyId, search),
    enabled: !!companyId,
  });

  const invalidate = () => {
    qc.invalidateQueries(['branches']);
    refreshBranches();
  };

  const createMut = useMutation({ mutationFn: createBranch, onSuccess: invalidate });
  const updateMut = useMutation({ mutationFn: updateBranch, onSuccess: invalidate });
  const deleteMut = useMutation({ mutationFn: deleteBranch, onSuccess: invalidate });
  const toggleMut = useMutation({ mutationFn: toggleBranch, onSuccess: invalidate });

  const handleSave = (data) =>
    modal.mode === 'add'
      ? createMut.mutateAsync(data)
      : updateMut.mutateAsync({ id: modal.branch.id, ...data });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Branches</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage all physical and logical branches of{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {company?.name || 'your company'}
            </span>
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="btn-primary flex items-center space-x-2"
        >
          <FiPlus className="w-4 h-4" />
          <span>Add Branch</span>
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Branches',  value: branches.length,                          color: 'text-blue-600' },
          { label: 'Active',          value: branches.filter((b) => b.is_active).length, color: 'text-green-600' },
          { label: 'Inactive',        value: branches.filter((b) => !b.is_active).length, color: 'text-red-600' },
          { label: 'Cities Covered',  value: new Set(branches.map((b) => b.city).filter(Boolean)).size, color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="card py-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search branches…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : branches.length === 0 ? (
          <div className="flex flex-col items-center py-16 space-y-3 text-gray-400">
            <FiMapPin className="w-12 h-12" />
            <p className="text-sm">
              {search ? 'No branches match your search.' : 'No branches yet. Add your first branch.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  {['Branch Name', 'Code', 'City / State', 'Contact', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="table-header-cell">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {branches.map((branch) => (
                  <tr key={branch.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiMapPin className="w-4 h-4 text-primary-600" />
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white">{branch.name}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {branch.code || '—'}
                      </span>
                    </td>
                    <td className="table-cell">
                      {[branch.city, branch.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="table-cell">
                      <div className="space-y-1">
                        {branch.phone && (
                          <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400">
                            <FiPhone className="w-3 h-3" /><span>{branch.phone}</span>
                          </div>
                        )}
                        {branch.email && (
                          <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400">
                            <FiMail className="w-3 h-3" /><span>{branch.email}</span>
                          </div>
                        )}
                        {!branch.phone && !branch.email && <span className="text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => toggleMut.mutate({ id: branch.id, active: !branch.is_active })}
                        className={`badge ${branch.is_active ? 'badge-success' : 'badge-danger'} cursor-pointer hover:opacity-80 transition-opacity`}
                      >
                        {branch.is_active
                          ? <><FiCheckCircle className="w-3 h-3 mr-1" />Active</>
                          : <><FiXCircle className="w-3 h-3 mr-1" />Inactive</>
                        }
                      </button>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setModal({ mode: 'edit', branch })}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDelTarget(branch)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
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
        <BranchModal
          initial={modal.mode === 'edit' ? modal.branch : null}
          companyId={companyId}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {delTarget && (
        <DeleteConfirm
          branch={delTarget}
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
