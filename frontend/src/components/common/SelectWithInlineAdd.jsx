import { useState } from 'react';
import { FiPlus, FiX, FiCheck } from 'react-icons/fi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appendFieldOption } from '../../api/customFields';
import toast from 'react-hot-toast';

/**
 * Select dropdown with inline '+' button.
 * Powers the quick "Add New Option" modal for dynamic form fields.
 *
 * Props:
 *  - field: custom-form field object { id, field_key, field_name, options_json }
 *  - value, onChange: standard select value binding
 *  - className: optional extra select classes
 */
export default function SelectWithInlineAdd({ field, value, onChange, className = '' }) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [newOption, setNewOption] = useState('');
  const options = field?.options_json || [];

  const addOptionMutation = useMutation({
    mutationFn: (option) => appendFieldOption(field.id, option),
    onSuccess: (updatedField) => {
      toast.success(`Option "${newOption}" added!`);
      qc.invalidateQueries({ queryKey: ['custom-fields-schema'] });
      setModalOpen(false);
      setNewOption('');
      // Trigger refresh via queryKey metadata so parent re-renders new options
      qc.setQueryData(['custom-fields-options', field.id], updatedField.options_json);
    },
    onError: () => toast.error('Failed to add option'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = newOption.trim();
    if (!trimmed) return;
    if (options.includes(trimmed)) {
      toast.error('Option already exists');
      return;
    }
    addOptionMutation.mutate(trimmed);
  };

  return (
    <div className="flex items-stretch gap-2">
      <select
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        className={`flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${className}`}
      >
        <option value="">Select option...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        title={`Add new option to ${field.field_name}`}
        className="w-10 flex-shrink-0 inline-flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-lg shadow-sm hover:shadow-md hover:from-indigo-600 hover:to-violet-700 transition-all"
      >
        <FiPlus className="w-5 h-5" />
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-5 z-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Add New Option to "{field.field_name}"
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded">
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                autoFocus
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Enter new option value..."
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addOptionMutation.isPending || !newOption.trim()}
                  className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <FiCheck className="mr-1.5" />
                  {addOptionMutation.isPending ? 'Adding...' : 'Add Option'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}