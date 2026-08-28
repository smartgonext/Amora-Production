import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFormSchema } from '../../api/customFields';
import SelectWithInlineAdd from './SelectWithInlineAdd';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';

/**
 * Renders custom sections & fields for any entity (product, service, rental, amc, customer, invoice).
 * Dropdown fields are rendered with SelectWithInlineAdd containing the '+' button to add new options on the fly.
 */
export default function DynamicFormSections({ entityType, formData = {}, onChange, showStatic = false, customRenderers = {} }) {
  const [collapsed, setCollapsed] = useState({});

  const { data: sections, isLoading } = useQuery({
    queryKey: ['custom-fields-schema', entityType],
    queryFn: () => fetchFormSchema(entityType),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !sections || sections.length === 0) {
    return null;
  }

  const toggleSection = (id) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-4 my-4">
      {sections.map((section) => {
        const isCollapsed = collapsed[section.id] ?? section.is_collapsed;
        const Icon = isCollapsed ? FiChevronRight : FiChevronDown;
        const fields = (section.fields || []).filter(f => showStatic || !f.is_static);

        if (fields.length === 0) return null;

        return (
          <div
            key={section.id}
            className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm"
          >
            {/* Section Header */}
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-left"
            >
              <div className="flex items-center space-x-2">
                <Icon className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                  {section.section_name}
                </span>
              </div>
              <span className="text-xs text-slate-400">{fields.length} dynamic field(s)</span>
            </button>

            {/* Section Fields Body */}
            {!isCollapsed && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map((field) => {
                  const val = formData[field.field_key] ?? field.default_value ?? '';
                  const colSpan =
                    field.width === '100%'
                      ? 'md:col-span-2'
                      : field.width === '50%'
                      ? 'md:col-span-1'
                      : 'md:col-span-1';

                  return (
                    <div key={field.id} className={colSpan}>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                        {field.field_name}
                        {field.is_required && <span className="text-rose-500 ml-0.5">*</span>}
                      </label>

                      {customRenderers[field.field_key] ? (
                        customRenderers[field.field_key](field, val, (v) => onChange?.(field.field_key, v))
                      ) : ['select', 'multiselect'].includes(field.field_type) ? (
                        <SelectWithInlineAdd
                          field={field}
                          value={val}
                          onChange={(v) => onChange?.(field.field_key, v)}
                        />
                      ) : field.field_type === 'textarea' ? (
                        <textarea
                          value={val}
                          onChange={(e) => onChange?.(field.field_key, e.target.value)}
                          placeholder={field.placeholder || ''}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      ) : field.field_type === 'checkbox' ? (
                        <label className="flex items-center space-x-2 mt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(val)}
                            onChange={(e) => onChange?.(field.field_key, e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {field.placeholder || 'Enable'}
                          </span>
                        </label>
                      ) : (
                        <input
                          type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                          value={val}
                          onChange={(e) => onChange?.(field.field_key, e.target.value)}
                          placeholder={field.placeholder || ''}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      )}

                      {field.help_text && (
                        <p className="text-[11px] text-slate-400 mt-1">{field.help_text}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
