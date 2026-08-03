import { useState, useRef, useEffect } from 'react';
import { FiDownload, FiFileText, FiFile, FiChevronDown } from 'react-icons/fi';

export default function ExportMenu({ onExport, loading = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
      >
        <FiDownload className="text-sm" />
        <span>Export</span>
        <FiChevronDown className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <button
            onClick={() => { onExport('pdf'); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <FiFileText className="text-red-500 text-sm" />
            <span>Export as PDF</span>
          </button>
          <button
            onClick={() => { onExport('excel'); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
          >
            <FiFile className="text-green-500 text-sm" />
            <span>Export as Excel</span>
          </button>
        </div>
      )}
    </div>
  );
}