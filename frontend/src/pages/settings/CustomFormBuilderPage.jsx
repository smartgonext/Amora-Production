import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiX, FiEdit2, FiTrash2, FiChevronDown, FiChevronRight,
  FiGrid, FiType, FiHash, FiList, FiCheckSquare, FiCalendar,
  FiArrowUp, FiArrowDown, FiClipboard
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  fetchFormSchema, createSection, updateSection, deleteSection,
  createField, updateField, deleteField, reorderSchema
} from '../../api/customFields';

const ENTITY_TYPES = [
  { value: 'product', label: 'Products' },
  { value: 'service', label: 'Services' },
  { value: 'rental', label: 'Rentals' },
  { value: 'amc', label: 'AMC Contracts' },
  { value: 'customer', label: 'Customers' },
  { value: 'invoice', label: 'Invoices' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: FiType },
  { value: 'textarea', label: 'Text Area', icon: FiClipboard },
  { value: 'number', label: 'Number', icon: FiHash },
  { value: 'select', label: 'Dropdown', icon: FiList },
  { value: 'multiselect', label: 'Multi Select', icon: FiList },
  { value: 'date', label: 'Date', icon: FiCalendar },
  { value: 'checkbox', label: 'Checkbox', icon: FiCheckSquare },
];

const WIDTH_OPTIONS = ['100%', '50%', '33%', '25%'];

export default function CustomFormBuilderPage() {
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState('product');
  const [expandedSections, setExpandedSections] = useState({});
  const [activeFieldId, setActiveFieldId] = useState(null);

  // Section modal state
  const [sectionModal, setSectionModal] = useState(null); // { mode: 'add'|'edit', section }
  // Field modal state
  const [fieldModal, setFieldModal] = useState(null); // { mode: 'add'|'edit', sectionId, field }

  const { data: schema, isLoading } = useQuery({
    queryKey: ['custom-fields-schema', entityType],
    queryFn: () => fetchFormSchema(entityType),
  });

  const sections = schema || [];

  // Mutations
  const createSectionMut = useMutation({
    mutationFn: createSection,
    onSuccess: () => { toast.success('Section created'); qc.invalidateQueries({ queryKey: ['custom-fields-schema'] }); setSectionModal(null); },
    onError: () => toast.error('Failed to create section'),
  });
  const updateSectionMut = useMutation({
    mutationFn: ({ id, payload }) => updateSection(id, payload),
    onSuccess: () => { toast.success('Section updated'); qc.invalidateQueries({ queryKey: ['custom-fields-schema'] }); setSectionModal(null); },
    onError: () => toast.error('Failed to update section'),
  });
  const deleteSectionMut = useMutation({
    mutationFn: deleteSection,
    onSuccess: () => { toast.success('Section deleted'); qc.invalidateQueries({ queryKey: ['custom-fields-schema'] }); },
    onError: () => toast.error('Failed to delete section'),
  });
  const createFieldMut = useMutation({
    mutationFn: createField,
    onSuccess: (field) => {
      toast.success('Field added');
      qc.invalidateQueries({ queryKey: ['custom-fields-schema'] });
      setFieldModal(null);
      setActiveFieldId(field.id);
    },
    onError: () => toast.error('Failed to create field'),
  });
  const updateFieldMut = useMutation({
    mutationFn: ({ id, payload }) => updateField(id, payload),
    onSuccess: (field) => {
      toast.success('Field updated');
      qc.invalidateQueries({ queryKey: ['custom-fields-schema'] });
      setFieldModal(null);
      setActiveFieldId(field.id);
    },
    onError: () => toast.error('Failed to update field'),
  });
  const deleteFieldMut = useMutation({
    mutationFn: deleteField,
    onSuccess: () => { toast.success('Field deleted'); qc.invalidateQueries({ queryKey: ['custom-fields-schema'] }); },
    onError: (err) => toast.error(err?.response?.data?.errors?.[0] || 'Failed to delete field'),
  });

  const toggleSection = (id) =>
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const moveSection = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const payload = reordered.map((s, i) => ({ id: s.id, sort_order: i + 1 }));
    try {
      await reorderSchema(entityType, payload);
      toast.success('Section reordered');
      qc.invalidateQueries({ queryKey: ['custom-fields-schema'] });
    } catch (e) {
      toast.error('Reorder failed');
    }
  };

  const moveField = async (section, fieldIndex, dir) => {
    const target = fieldIndex + dir;
    const fields = section.fields || [];
    if (target < 0 || target >= fields.length) return;
    const reordered = [...fields];
    [reordered[fieldIndex], reordered[target]] = [reordered[target], reordered[fieldIndex]];
    const payload = reordered.map((f, i) => ({ id: f.id, sort_order: i + 1, section_id: section.id }));
    try {
      await reorderSchema(entityType, [{ id: section.id, sort_order: section.sort_order, fields: payload }]);
      toast.success('Field reordered');
      qc.invalidateQueries({ queryKey: ['custom-fields-schema'] });
    } catch (e) {
      toast.error('Reorder failed');
    }
  };

  const fieldTypeIcon = (type) => {
    const found = FIELD_TYPES.find((t) => t.value === type);
    return found?.icon || FiType;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Dynamic Form Builder</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Design custom sections and fields for Products, Services, Rentals, AMC Contracts, and Customers.
              Add inline dropdown options instantly with the {'+'} button.
            </p>
          </div>
          <button
            onClick={() => setSectionModal({ mode: 'add', section: null })}
            className="flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all"
          >
            <FiPlus />
            <span>Add Section</span>
          </button>
        </div>
      </div>

      {/* Entity Type Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Form Entity</label>
        <div className="flex flex-wrap gap-2">
          {ENTITY_TYPES.map((et) => (
            <button
              key={et.value}
              onClick={() => { setEntityType(et.value); setActiveFieldId(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                entityType === et.value
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {et.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sections Workspace */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : sections.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-16 text-center">
          <FiGrid className="mx-auto text-5xl text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No sections yet</p>
          <p className="text-sm text-slate-400 mt-1">Create your first section to start building the form.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section, sectionIdx) => {
            const isExpanded = expandedSections[section.id] !== false;
            const Icon = section.is_collapsed ? FiChevronRight : FiChevronDown;
            return (
              <div key={section.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Section Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <button onClick={() => toggleSection(section.id)} className="p-1 text-slate-400 hover:text-indigo-600 rounded">
                      <Icon className="w-5 h-5" />
                    </button>
                    <h3 className="font-semibold text-slate-800 dark:text-white">{section.section_name}</h3>
                    <span className="text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-semibold">
                      {(section.fields || []).length} fields
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => moveSection(sectionIdx, -1)}
                      disabled={sectionIdx === 0}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 rounded"
                      title="Move up"
                    >
                      <FiArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveSection(sectionIdx, 1)}
                      disabled={sectionIdx === sections.length - 1}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 rounded"
                      title="Move down"
                    >
                      <FiArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSectionModal({ mode: 'edit', section })}
                      className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                      title="Edit section"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete section "${section.section_name}"? All fields inside will be removed.`))
                          deleteSectionMut.mutate(section.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                      title="Delete section"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Section Body */}
                {isExpanded && (
                  <div className="p-5">
                    {(section.fields || []).length === 0 ? (
                      <div className="text-center py-6 text-sm text-slate-400">
                        No fields yet. Click "Add Field" to create one.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(section.fields || []).map((field, fieldIdx) => {
                          const FieldIcon = fieldTypeIcon(field.field_type);
                          const isActive = activeFieldId === field.id;
                          return (
                            <div
                              key={field.id}
                              className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                                isActive
                                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30'
                                  : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-200 dark:hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <span className={`p-2 rounded-lg ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
                                  <FieldIcon className="w-4 h-4" />
                                </span>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">
                                    {field.field_name}
                                    {field.is_required && <span className="text-rose-500 ml-0.5">*</span>}
                                  </p>
                                  <p className="text-xs text-slate-400 font-mono truncate">
                                    {field.field_key} • {field.field_type} • {field.width}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1 flex-shrink-0">
                                <button
                                  onClick={() => moveField(section, fieldIdx, -1)}
                                  disabled={fieldIdx === 0}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 rounded"
                                  title="Move up"
                                >
                                  <FiArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => moveField(section, fieldIdx, 1)}
                                  disabled={fieldIdx === (section.fields || []).length - 1}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 rounded"
                                  title="Move down"
                                >
                                  <FiArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setFieldModal({ mode: 'edit', sectionId: section.id, field })}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                                  title="Edit field"
                                >
                                  <FiEdit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Delete field "${field.field_name}"?`))
                                      deleteFieldMut.mutate(field.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                                  title="Delete field"
                                >
                                  <FiTrash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <button
                      onClick={() => setFieldModal({ mode: 'add', sectionId: section.id, field: null })}
                      className="mt-4 w-full flex items-center justify-center space-x-2 px-4 py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg text-sm font-semibold transition-all"
                    >
                      <FiPlus />
                      <span>Add Field</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Section Modal */}
      <AnimatePresence>
        {sectionModal && (
          <SectionModal
            modal={sectionModal}
            entityType={entityType}
            onClose={() => setSectionModal(null)}
            onCreate={(payload) => createSectionMut.mutate(payload)}
            onUpdate={(id, payload) => updateSectionMut.mutate({ id, payload })}
          />
        )}
      </AnimatePresence>

      {/* Field Modal */}
      <AnimatePresence>
        {fieldModal && (
          <FieldModal
            modal={fieldModal}
            onClose={() => setFieldModal(null)}
            onCreate={(payload) => createFieldMut.mutate(payload)}
            onUpdate={(id, payload) => updateFieldMut.mutate({ id, payload })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Section Create/Edit Modal ─────────────────────────────── */
function SectionModal({ modal, entityType, onClose, onCreate, onUpdate }) {
  const isEdit = modal.mode === 'edit';
  const [name, setName] = useState(modal.section?.section_name || '');
  const [collapsed, setCollapsed] = useState(modal.section?.is_collapsed || false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (isEdit) {
      onUpdate(modal.section.id, { section_name: name.trim(), is_collapsed: collapsed });
    } else {
      onCreate({ section_name: name.trim(), entity_type: entityType, is_collapsed: collapsed });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 z-10"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-950 dark:text-white">
            {isEdit ? 'Edit Section' : 'Add New Section'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <FiX />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Section Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warranty & Service Specs"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <label className="flex items-center space-x-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={collapsed}
              onChange={(e) => setCollapsed(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Collapsed by default</span>
          </label>
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {isEdit ? 'Save Section' : 'Create Section'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ── Field Create/Edit Modal ───────────────────────────────── */
function FieldModal({ modal, onClose, onCreate, onUpdate }) {
  const isEdit = modal.mode === 'edit';
  const f = modal.field;

  const [form, setForm] = useState({
    field_name: f?.field_name || '',
    field_type: f?.field_type || 'text',
    placeholder: f?.placeholder || '',
    help_text: f?.help_text || '',
    options_json: f?.options_json?.length ? [...f.options_json] : [],
    optionInput: '',
    is_required: f?.is_required || false,
    is_active: f?.is_active !== false,
    width: f?.width || '100%',
  });

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const addOption = () => {
    const opt = form.optionInput.trim();
    if (!opt || form.options_json.includes(opt)) return;
    set('options_json', [...form.options_json, opt]);
    set('optionInput', '');
  };

  const removeOption = (opt) =>
    set('options_json', form.options_json.filter((o) => o !== opt));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.field_name.trim()) return;
    const payload = {
      field_name: form.field_name.trim(),
      field_type: form.field_type,
      placeholder: form.placeholder,
      help_text: form.help_text,
      is_required: form.is_required,
      is_active: form.is_active,
      width: form.width,
    };
    if (['select', 'multiselect'].includes(form.field_type)) {
      payload.options_json = form.options_json;
    }
    if (isEdit) {
      onUpdate(modal.field.id, payload);
    } else {
      onCreate({ ...payload, section_id: modal.sectionId });
    }
  };

  const isDropdown = ['select', 'multiselect'].includes(form.field_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
      >
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-950 dark:text-white">
            {isEdit ? 'Edit Field' : 'Add New Field'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Field Label *</label>
              <input
                value={form.field_name}
                onChange={(e) => set('field_name', e.target.value)}
                placeholder="e.g. Warranty Period"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Field Type</label>
              <select
                value={form.field_type}
                onChange={(e) => set('field_type', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Width</label>
              <select
                value={form.width}
                onChange={(e) => set('width', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {WIDTH_OPTIONS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Placeholder</label>
              <input
                value={form.placeholder}
                onChange={(e) => set('placeholder', e.target.value)}
                placeholder="Optional placeholder text"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Help Text</label>
              <input
                value={form.help_text}
                onChange={(e) => set('help_text', e.target.value)}
                placeholder="Optional helper text shown below field"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Options for dropdown/multiselect */}
          {isDropdown && (
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase">Dropdown Options</label>
              <div className="flex gap-2">
                <input
                  value={form.optionInput}
                  onChange={(e) => set('optionInput', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                  placeholder="Type option and press Enter..."
                  className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  <FiPlus />
                </button>
              </div>
              {form.options_json.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.options_json.map((opt) => (
                    <span key={opt} className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span>{opt}</span>
                      <button type="button" onClick={() => removeOption(opt)} className="text-slate-400 hover:text-rose-500">
                        <FiX className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400">
                These options will also appear in the inline {'+'} quick-add dropdown on the live forms.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_required}
                onChange={(e) => set('is_required', e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Required Field</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => set('is_active', e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Active</span>
            </label>
          </div>
        </form>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!form.field_name.trim()}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-colors text-sm font-semibold disabled:opacity-50"
          >
            {isEdit ? 'Save Field' : 'Add Field'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}