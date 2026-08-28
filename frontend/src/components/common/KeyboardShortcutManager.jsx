import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiHelpCircle, FiSettings, FiBriefcase, FiDollarSign, FiPackage, FiHome, FiTrendingUp, FiX } from 'react-icons/fi';

const COMMANDS = [
  { id: 'dash', name: 'Go to Dashboard', shortcut: 'Ctrl+Shift+D', action: '/dashboard', icon: FiHome },
  { id: 'bill', name: 'Open POS Quick-Billing', shortcut: 'Ctrl+Shift+B', action: '/billing', icon: FiDollarSign },
  { id: 'sales', name: 'Go to Sales & Invoices', shortcut: 'Ctrl+Shift+S', action: '/sales', icon: FiTrendingUp },
  { id: 'pur', name: 'Go to Purchases & GRN', shortcut: 'Ctrl+Shift+P', action: '/purchases', icon: FiBriefcase },
  { id: 'inv', name: 'Go to Inventory & Stocks', shortcut: 'Ctrl+Shift+I', action: '/inventory', icon: FiPackage },
  { id: 'fin', name: 'Go to Financial Ledgers', shortcut: 'Ctrl+Shift+F', action: '/finance', icon: FiDollarSign },
  { id: 'sett', name: 'Open System Settings', shortcut: 'Ctrl+Shift+S', action: '/settings', icon: FiSettings }
];

export default function KeyboardShortcutManager() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle Command Palette (Ctrl+K or Slash outside of inputs)
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Toggle F1 Help Overlay
      if (e.key === 'F1') {
        e.preventDefault();
        setIsHelpOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredCommands = COMMANDS.filter(cmd => 
    cmd.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        executeCommand(filteredCommands[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const executeCommand = (cmd) => {
    navigate(cmd.action);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <>
      {/* COMMAND PALETTE OVERLAY */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[999] flex items-start justify-center pt-24 px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="relative w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md"
            >
              <div className="flex items-center px-4 py-3.5 border-b border-slate-850">
                <FiSearch className="text-slate-400 text-lg mr-3" />
                <input
                  ref={inputRef}
                  type="text"
                  data-enter-submit="true"
                  placeholder="Type a command or module name..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent text-white placeholder-slate-500 border-none outline-none focus:ring-0 text-sm"
                />
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">ESC</span>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {filteredCommands.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  return (
                    <div
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        idx === selectedIndex ? 'bg-indigo-600 text-white' : 'text-slate-350 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="text-base" />
                        <span className="text-sm font-semibold">{cmd.name}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${idx === selectedIndex ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-500'}`}>
                        {cmd.shortcut}
                      </span>
                    </div>
                  );
                })}
                {filteredCommands.length === 0 && (
                  <div className="py-6 text-center text-slate-500 text-xs font-semibold">No commands matching query</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HELP OVERLAY (F1 HELP BOARD) */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsHelpOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 z-10 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FiHelpCircle className="text-indigo-400 text-lg" />
                  <h3 className="text-lg font-bold text-white">SmartGoNext Shortcuts</h3>
                </div>
                <button onClick={() => setIsHelpOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>
              <div className="space-y-3 text-xs">
                {[
                  { keys: 'Ctrl + K', desc: 'Open Command Palette' },
                  { keys: '/', desc: 'Global Command / Search Lookup' },
                  { keys: 'F1', desc: 'Show Help Overlay' },
                  { keys: 'Ctrl + Shift + D', desc: 'Jump to Dashboard' },
                  { keys: 'Ctrl + Shift + B', desc: 'Jump to POS Quick-Billing' },
                  { keys: 'Ctrl + Shift + S', desc: 'Jump to Invoices' },
                  { keys: 'Ctrl + Shift + P', desc: 'Jump to Procurement / Purchases' },
                  { keys: 'Ctrl + Shift + I', desc: 'Jump to Stock Inventory' }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-850">
                    <span className="text-slate-350">{item.desc}</span>
                    <span className="font-mono bg-slate-800 text-indigo-400 px-2 py-0.5 rounded font-bold">{item.keys}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
