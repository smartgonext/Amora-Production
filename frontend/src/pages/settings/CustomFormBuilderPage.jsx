import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiX, FiEdit2, FiTrash2, FiChevronDown, FiChevronRight,
  FiGrid, FiType, FiHash, FiList, FiCheckSquare, FiCalendar,
  FiArrowUp, FiArrowDown, FiClipboard, FiSliders, FiEye, FiRotateCcw,
  FiRotateCw, FiInfo, FiLayers, FiAlertCircle, FiSettings, FiUser,
  FiHelpCircle, FiChevronUp, FiDownload
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  fetchFormSchema, createSection, updateSection, deleteSection,
  createField, updateField, deleteField, reorderSchema
} from '../../api/customFields';
import DynamicFormSections from '../../components/common/DynamicFormSections';

const ENTITY_TYPES = [
  { value: 'product', label: 'Products' },
  { value: 'service', label: 'Services' },
  { value: 'rental', label: 'Rentals' },
  { value: 'amc', label: 'AMC Contracts' },
  { value: 'customer', label: 'Customers' },
  { value: 'invoice', label: 'Invoices' },
];

const FIELD_TYPES = [
  { type: 'text', label: 'Text Input', icon: FiType },
  { type: 'textarea', label: 'Text Area', icon: FiClipboard },
  { type: 'number', label: 'Number Input', icon: FiHash },
  { type: 'select', label: 'Dropdown List', icon: FiList },
  { type: 'multiselect', label: 'Multi-Select', icon: FiGrid },
  { type: 'date', label: 'Date Picker', icon: FiCalendar },
  { type: 'checkbox', label: 'Checkbox', icon: FiCheckSquare },
];

const WIDTH_OPTIONS = ['100%', '50%', '33%', '25%'];

export default function CustomFormBuilderPage() {
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState('product');
  
  // Workspace Canvas State
  const [schema, setSchema] = useState([]);
  const [selectedField, setSelectedField] = useState(null);

  // Undo/Redo Snapshots
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Modal / Preview states
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState({});

  // Query database schema
  const { data: sections, isLoading } = useQuery({
    queryKey: ['custom-fields-schema', entityType],
    queryFn: () => fetchFormSchema(entityType),
  });

  // Sync API schema to local workspace state
  useEffect(() => {
    if (sections) {
      setSchema(JSON.parse(JSON.stringify(sections)));
    }
  }, [sections]);

  // Drag and Drop States
  const [dragSource, setDragSource] = useState(null); // { origin: 'sidebar'|'canvas', type: string, id: number|string, parentSectionId: number }
  const [activeDropSectionId, setActiveDropSectionId] = useState(null);
  const [activeDropFieldId, setActiveDropFieldId] = useState(null);

  // Mutations
  const createSectionMut = useMutation({
    mutationFn: createSection,
    onSuccess: () => {
      toast.success('Section created');
      qc.invalidateQueries({ queryKey: ['custom-fields-schema', entityType] });
    },
    onError: () => toast.error('Failed to create section'),
  });

  const updateSectionMut = useMutation({
    mutationFn: ({ id, payload }) => updateSection(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields-schema', entityType] });
    },
    onError: () => toast.error('Failed to update section'),
  });

  const deleteSectionMut = useMutation({
    mutationFn: deleteSection,
    onSuccess: () => {
      toast.success('Section deleted');
      setSelectedField(null);
      qc.invalidateQueries({ queryKey: ['custom-fields-schema', entityType] });
    },
    onError: () => toast.error('Failed to delete section'),
  });

  const createFieldMut = useMutation({
    mutationFn: createField,
    onSuccess: (savedField) => {
      qc.invalidateQueries({ queryKey: ['custom-fields-schema', entityType] });
      setSelectedField(savedField);
    },
    onError: () => toast.error('Failed to add field'),
  });

  const updateFieldMut = useMutation({
    mutationFn: ({ id, payload }) => updateField(id, payload),
    onSuccess: () => {
      toast.success('Field saved!');
      qc.invalidateQueries({ queryKey: ['custom-fields-schema', entityType] });
    },
    onError: () => toast.error('Failed to save field settings'),
  });

  const deleteFieldMut = useMutation({
    mutationFn: deleteField,
    onSuccess: () => {
      toast.success('Field deleted');
      setSelectedField(null);
      qc.invalidateQueries({ queryKey: ['custom-fields-schema', entityType] });
    },
    onError: (err) => toast.error(err?.response?.data?.errors?.[0] || 'Failed to delete field'),
  });

  // Track layout history for Undo/Redo
  const saveSnapshot = (currentSchema) => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(currentSchema))]);
    setRedoStack([]);
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(prevStack => prevStack.slice(0, -1));
    setRedoStack(nextStack => [JSON.parse(JSON.stringify(schema)), ...nextStack]);
    setSchema(prev);
    persistReorder(prev);
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack(nextStack => nextStack.slice(1));
    setUndoStack(prevStack => [...prevStack, JSON.parse(JSON.stringify(schema))]);
    setSchema(next);
    persistReorder(next);
  };

  // Reorder database payload sender
  const persistReorder = async (layout) => {
    const payload = layout.map((sec, secIdx) => ({
      id: sec.id,
      sort_order: secIdx + 1,
      fields: (sec.fields || []).map((f, fIdx) => ({
        id: f.id,
        sort_order: fIdx + 1,
        section_id: sec.id
      }))
    }));
    try {
      await reorderSchema(entityType, payload);
      qc.invalidateQueries({ queryKey: ['custom-fields-schema', entityType] });
    } catch (e) {
      toast.error('Reordering sync failed');
    }
  };

  // Drag and Drop implementation
  const handleDragStartSidebar = (e, type) => {
    setDragSource({ origin: 'sidebar', type });
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragStartCanvas = (e, fieldId, sectionId) => {
    setDragSource({ origin: 'canvas', id: fieldId, parentSectionId: sectionId });
    e.dataTransfer.setData('text/plain', String(fieldId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, sectionId) => {
    e.preventDefault();
    setActiveDropSectionId(sectionId);
  };

  const handleFieldDrop = async (e, targetFieldId, targetSectionId) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDropSectionId(null);
    setActiveDropFieldId(null);
    if (!dragSource) return;

    saveSnapshot(schema);

    const newSchema = JSON.parse(JSON.stringify(schema));
    let movedField = null;

    if (dragSource.origin === 'canvas') {
      for (const sec of newSchema) {
        const idx = sec.fields?.findIndex(f => f.id === dragSource.id);
        if (idx !== undefined && idx !== -1) {
          movedField = sec.fields.splice(idx, 1)[0];
          break;
        }
      }
    } else if (dragSource.origin === 'sidebar') {
      const slug = `custom_${dragSource.type}_${Math.random().toString(36).substring(2, 7)}`;
      movedField = {
        id: 'temp-' + Date.now(),
        section_id: targetSectionId,
        field_type: dragSource.type,
        field_name: `New ${dragSource.type.toUpperCase()}`,
        field_key: slug,
        placeholder: 'Enter details...',
        help_text: '',
        is_required: false,
        is_active: true,
        is_static: false,
        width: '100%',
        options_json: []
      };
    }

    if (movedField) {
      const targetSec = newSchema.find(s => s.id === targetSectionId);
      if (targetSec) {
        if (!targetSec.fields) targetSec.fields = [];
        const targetIdx = targetSec.fields.findIndex(f => f.id === targetFieldId);
        movedField.section_id = targetSectionId;
        if (targetIdx !== -1) {
          targetSec.fields.splice(targetIdx, 0, movedField);
        } else {
          targetSec.fields.push(movedField);
        }
      }
      setSchema(newSchema);

      if (typeof movedField.id === 'string' && movedField.id.startsWith('temp-')) {
        createFieldMut.mutate({
          section_id: targetSectionId,
          field_name: movedField.field_name,
          field_type: movedField.field_type,
          field_key: movedField.field_key,
          placeholder: movedField.placeholder,
          help_text: movedField.help_text,
          is_required: movedField.is_required,
          is_active: movedField.is_active,
          width: movedField.width,
          options_json: movedField.options_json
        }, {
          onSuccess: (savedField) => {
            const updatedSchema = JSON.parse(JSON.stringify(newSchema));
            const sec = updatedSchema.find(s => s.id === targetSectionId);
            const tempIdx = sec.fields.findIndex(f => typeof f.id === 'string' && f.id.startsWith('temp-'));
            if (tempIdx !== -1) {
              sec.fields[tempIdx] = savedField;
            }
            setSchema(updatedSchema);
            persistReorder(updatedSchema);
          }
        });
      } else {
        persistReorder(newSchema);
      }
    }
    setDragSource(null);
  };

  const handleDropSection = async (e, targetSectionId) => {
    e.preventDefault();
    setActiveDropSectionId(null);
    setActiveDropFieldId(null);
    if (!dragSource) return;

    saveSnapshot(schema);

    if (dragSource.origin === 'sidebar') {
      const slug = `custom_${dragSource.type}_${Math.random().toString(36).substring(2, 7)}`;
      createFieldMut.mutate({
        section_id: targetSectionId,
        field_name: `New ${dragSource.type.toUpperCase()}`,
        field_type: dragSource.type,
        field_key: slug,
        placeholder: 'Enter details...',
        help_text: '',
        is_required: false,
        is_active: true,
        is_static: false,
        width: '100%',
        options_json: []
      });
    } else if (dragSource.origin === 'canvas') {
      const newSchema = JSON.parse(JSON.stringify(schema));
      let movedField = null;

      for (const sec of newSchema) {
        const idx = sec.fields?.findIndex(f => f.id === dragSource.id);
        if (idx !== undefined && idx !== -1) {
          movedField = sec.fields.splice(idx, 1)[0];
          break;
        }
      }

      if (movedField) {
        const targetSec = newSchema.find(s => s.id === targetSectionId);
        if (targetSec) {
          if (!targetSec.fields) targetSec.fields = [];
          movedField.section_id = targetSectionId;
          targetSec.fields.push(movedField);
        }
        setSchema(newSchema);
        persistReorder(newSchema);
      }
    }
    setDragSource(null);
  };

  // Section managers
  const handleAddSection = () => {
    const name = prompt('Enter Section Name:');
    if (name && name.trim()) {
      saveSnapshot(schema);
      createSectionMut.mutate({
        section_name: name.trim(),
        entity_type: entityType,
        is_collapsed: false
      });
    }
  };

  const handleRenameSection = (id, currentName) => {
    const name = prompt('Rename Section:', currentName);
    if (name && name.trim() && name.trim() !== currentName) {
      saveSnapshot(schema);
      updateSectionMut.mutate({
        id,
        payload: { section_name: name.trim() }
      });
    }
  };

  const toggleSectionCollapse = (sec) => {
    updateSectionMut.mutate({
      id: sec.id,
      payload: { is_collapsed: !sec.is_collapsed }
    });
  };

  // Field change updates
  const handleFieldChange = (key, val) => {
    if (!selectedField) return;
    setSelectedField(prev => ({ ...prev, [key]: val }));
    
    // Dynamically update local workspace schema instantly
    setSchema(prevSchema => {
      return prevSchema.map(sec => {
        if (sec.fields) {
          return {
            ...sec,
            fields: sec.fields.map(f => {
              if (f.id === selectedField.id) {
                return { ...f, [key]: val };
              }
              return f;
            })
          };
        }
        return sec;
      });
    });
  };

  const handleSaveFieldSettings = () => {
    if (!selectedField) return;
    saveSnapshot(schema);

    const payload = {
      field_name: selectedField.field_name,
      field_key: selectedField.field_key,
      placeholder: selectedField.placeholder || '',
      help_text: selectedField.help_text || '',
      is_required: selectedField.is_required,
      is_active: selectedField.is_active,
      width: selectedField.width || '100%',
    };

    if (['select', 'multiselect'].includes(selectedField.field_type)) {
      payload.options_json = selectedField.options_json || [];
    }

    updateFieldMut.mutate({
      id: selectedField.id,
      payload
    });
  };

  // Option list helpers
  const addOption = () => {
    const options = selectedField.options_json || [];
    const val = prompt('Enter option value:');
    if (val && val.trim() && !options.includes(val.trim())) {
      const next = [...options, val.trim()];
      handleFieldChange('options_json', next);
    }
  };

  const removeOption = (opt) => {
    const options = selectedField.options_json || [];
    const next = options.filter(x => x !== opt);
    handleFieldChange('options_json', next);
  };

  const getFieldIcon = (type) => {
    const matched = FIELD_TYPES.find(f => f.type === type);
    return matched?.icon || FiType;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 space-y-6">
      
      {/* Header bar */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">ERP Dynamic Form Builder</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Drag fields, arrange sections, and instantly create custom form layouts for different ERP operations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white/10 text-white font-semibold rounded-xl border border-white/15 hover:bg-white/20 transition-all text-sm"
            >
              <FiEye />
              <span>Preview</span>
            </button>
            <button
              onClick={handleAddSection}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all text-sm"
            >
              <FiPlus />
              <span>Add Section</span>
            </button>
          </div>
        </div>
      </div>

      {/* Entity Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-800 p-4 shadow-sm">
        <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
          Select Target Module Form
        </label>
        <div className="flex flex-wrap gap-2">
          {ENTITY_TYPES.map((et) => (
            <button
              key={et.value}
              onClick={() => { setEntityType(et.value); setSelectedField(null); }}
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

      {/* 3-Column Layout */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20 flex-1">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6 mt-2 flex-1 items-start">
          
          {/* Left Column: Draggable Sidebar */}
          <div className="col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col max-h-[calc(100vh-250px)] overflow-y-auto shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Fields Toolkit</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-4">Drag tools directly into form sections</p>

            <div className="space-y-2">
              {FIELD_TYPES.map(f => (
                <div
                  key={f.type}
                  draggable
                  onDragStart={(e) => handleDragStartSidebar(e, f.type)}
                  className="flex items-center gap-2.5 px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing text-xs text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <f.icon className="text-slate-400 dark:text-slate-500" size={14} />
                  <span className="font-semibold">{f.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-center">
              <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5">
                <FiHelpCircle size={12} /> Drag & Drop Canvas enabled
              </span>
            </div>
          </div>

          {/* Middle Column: Canvas Workspace */}
          <div className="col-span-6 space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50/40 dark:bg-indigo-950/20 border border-dashed border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-700 dark:text-indigo-400">
              <FiGrid className="animate-pulse" />
              <span>Arrange sections and drop fields into the panels below</span>
            </div>

            {/* Sections Canvas Container */}
            <div className="space-y-4">
              {schema.map((sec, secIdx) => (
                <div
                  key={sec.id}
                  onDragOver={(e) => handleDragOver(e, sec.id)}
                  onDrop={(e) => handleDropSection(e, sec.id)}
                  className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden shadow-sm transition-all ${
                    activeDropSectionId === sec.id ? 'border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-950' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Section Title Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <FiGrid className="text-slate-300 dark:text-slate-600 cursor-move" size={14} />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{sec.section_name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRenameSection(sec.id, sec.section_name)}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 transition-colors"
                        title="Rename"
                      >
                        <FiEdit2 size={11} />
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete section? All fields inside will be lost.')) deleteSectionMut.mutate(sec.id) }}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-red-500 transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 size={11} />
                      </button>
                      <button
                        onClick={() => toggleSectionCollapse(sec)}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 transition-colors"
                      >
                        {sec.is_collapsed ? <FiChevronDown size={13} /> : <FiChevronUp size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Section Fields Grid */}
                  {!sec.is_collapsed && (
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-12 gap-4">
                        {(sec.fields || []).map((field, fieldIdx) => {
                          const FieldIcon = getFieldIcon(field.field_type);
                          const isSelected = selectedField?.id === field.id;
                          return (
                            <div
                              key={field.id}
                              draggable
                              onDragStart={(e) => handleDragStartCanvas(e, field.id, sec.id)}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActiveDropFieldId(field.id);
                              }}
                              onDragLeave={() => setActiveDropFieldId(null)}
                              onDrop={(e) => handleFieldDrop(e, field.id, sec.id)}
                              onClick={() => setSelectedField(field)}
                              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/20 shadow-sm'
                                  : activeDropFieldId === field.id
                                    ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/10 scale-[1.01] shadow'
                                    : 'border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 hover:border-slate-200 dark:hover:border-slate-750'
                              } ${
                                field.width === '50%' ? 'col-span-6' :
                                field.width === '33%' ? 'col-span-4' :
                                field.width === '25%' ? 'col-span-3' :
                                'col-span-12'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <FieldIcon size={12} className="text-slate-400" />
                                  {field.field_name}
                                  {field.is_required && <span className="text-red-500">*</span>}
                                </span>
                                {!field.is_static && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Delete field "${field.field_name}"?`)) {
                                        deleteFieldMut.mutate(field.id);
                                      }
                                    }}
                                    className="p-1 hover:bg-red-50 dark:hover:bg-red-950/50 rounded text-red-400 hover:text-red-650 transition-colors"
                                  >
                                    <FiTrash2 size={10} />
                                  </button>
                                )}
                              </div>

                              <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 border border-slate-150 dark:border-slate-800 rounded px-2 py-1.5 bg-white dark:bg-slate-850 truncate">
                                {field.placeholder || `Enter ${(field.field_name || '').toLowerCase()}...`}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Drop notice indicator inside empty fields list */}
                      {(sec.fields || []).length === 0 && (
                        <div className="flex justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg py-5 text-center text-xs text-slate-400">
                          Empty Section. Drag fields here.
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ))}
            </div>

            {/* Canvas Actions Bar */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1">
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="p-2 hover:bg-slate-55 dark:hover:bg-slate-800 border dark:border-slate-800 rounded-lg text-slate-500 disabled:opacity-30 transition-colors"
                  title="Undo"
                >
                  <FiRotateCcw size={14} />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-2 hover:bg-slate-55 dark:hover:bg-slate-800 border dark:border-slate-800 rounded-lg text-slate-500 disabled:opacity-30 transition-colors"
                  title="Redo"
                >
                  <FiRotateCw size={14} />
                </button>
              </div>

              <div className="text-[10px] text-slate-400 font-semibold italic">
                Changes saved automatically
              </div>
            </div>

          </div>

          {/* Right Column: Properties Editor Panel */}
          <div className="col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col max-h-[calc(100vh-250px)] shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Field Settings</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-4">Edit settings of the selected field</p>

            {selectedField ? (
              <div className="flex flex-col flex-1 min-h-0 space-y-4">
                <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
                  
                  {/* Field Label */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Field Label</label>
                    <input
                      type="text"
                      value={selectedField.field_name || ''}
                      onChange={(e) => handleFieldChange('field_name', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFieldSettings(); }}
                      className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>

                  {/* Field Key */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Field Key (Internal Slug)</label>
                    <input
                      type="text"
                      value={selectedField.field_key || ''}
                      disabled={selectedField.is_static}
                      onChange={(e) => handleFieldChange('field_key', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFieldSettings(); }}
                      className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs disabled:opacity-50"
                    />
                  </div>

                  {/* Width Option */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Width Span</label>
                    <select
                      value={selectedField.width || '100%'}
                      onChange={(e) => handleFieldChange('width', e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    >
                      {WIDTH_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt} Width</option>
                      ))}
                    </select>
                  </div>

                  {/* Placeholder */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Placeholder</label>
                    <input
                      type="text"
                      value={selectedField.placeholder || ''}
                      onChange={(e) => handleFieldChange('placeholder', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFieldSettings(); }}
                      className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>

                  {/* Help text */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Help Description</label>
                    <input
                      type="text"
                      value={selectedField.help_text || ''}
                      onChange={(e) => handleFieldChange('help_text', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFieldSettings(); }}
                      className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>

                  {/* Options Manager (select / multiselect) */}
                  {['select', 'multiselect'].includes(selectedField.field_type) && (
                    <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Options</span>
                        <button onClick={addOption} className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                          + Add Option
                        </button>
                      </div>
                      <div className="space-y-1">
                        {(selectedField.options_json || []).map((opt) => (
                          <div key={opt} className="flex items-center justify-between bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-150 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                            <span>{opt}</span>
                            <button onClick={() => removeOption(opt)} className="text-red-500 hover:text-red-700">
                              <FiX size={11} />
                            </button>
                          </div>
                        ))}
                        {(selectedField.options_json || []).length === 0 && (
                          <div className="text-[10px] text-slate-400 italic">No options configured.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Checkbox settings */}
                  <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!selectedField.is_required}
                        onChange={(e) => handleFieldChange('is_required', e.target.checked)}
                        className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Required Field</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!selectedField.is_active}
                        onChange={(e) => handleFieldChange('is_active', e.target.checked)}
                        className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Active Field</span>
                    </label>
                  </div>

                </div>

                {/* Footer buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex bg-white dark:bg-slate-900">
                  <button
                    onClick={handleSaveFieldSettings}
                    disabled={updateFieldMut.isPending}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition-colors disabled:opacity-50"
                  >
                    {updateFieldMut.isPending ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-450 dark:text-slate-500 space-y-3 mt-4 flex-1">
                <div className="w-14 h-14 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-full flex items-center justify-center text-slate-400">
                  <FiSliders size={22} />
                </div>
                <div className="text-xs font-bold text-slate-650 dark:text-slate-300">Select form field</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal max-w-[170px]">
                  Click any field on the canvas to configure labels, properties, dropdowns, and widths.
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* PREVIEW MODAL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <FiEye /> Live Form Preview - {ENTITY_TYPES.find(e => e.value === entityType)?.label} Form
              </h3>
              <button onClick={() => setIsPreviewOpen(false)} className="text-slate-400 hover:text-slate-600 rounded">
                <FiX size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <DynamicFormSections
                  entityType={entityType}
                  formData={previewData}
                  onChange={(key, val) => setPreviewData(prev => ({ ...prev, [key]: val }))}
                  showStatic={true}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}