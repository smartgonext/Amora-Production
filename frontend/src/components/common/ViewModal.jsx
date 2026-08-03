import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';

export default function ViewModal({ open, onClose, title, fields = [], data = {} }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[80vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <FiX className="text-lg" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">{field.label}</label>
                  <div className="text-sm text-slate-800 dark:text-white font-medium">
                    {field.render ? field.render(data[field.key], data) : (data[field.key] ?? '-')}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}