import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiLayers, FiAlertCircle } from 'react-icons/fi';
import { motion } from 'framer-motion';

const BUSINESS_TYPES = [
  'Retail Shop', 'Wholesale Distribution', 'Bakery', 'Equipment Rental',
  'Manufacturing Unit', 'Textile Business', 'Repair Shop', 'Vehicle Service',
  'Mobile Shop', 'Medical Shop', 'Pharmacy', 'Jewellery Shop',
  'Supermarket', 'Crane & Forklift'
];

// Mirrors backend's BUSINESS_TYPE_MFG_PROFILES so the registration form can show
// exactly which manufacturing engine config will be seeded for the selection.
const MFG_PROFILES = {
  'Manufacturing Unit': { mfg_type: 'discrete', label: 'Multi-level BOM', features: 'routing, serial tracking, subcontracting, job work, auto-PO' },
  'Textile Business': { mfg_type: 'textile', label: 'Variant Matrix', features: 'routing, lot tracking, size/color matrix, job work, auto-PO' },
  'Bakery': { mfg_type: 'process', label: 'Recipe / Yield', features: 'batch production, expiry tracking, QC' },
};

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    company_name: '',
    subdomain: '',
    email: '',
    password: '',
    admin_name: '',
    business_type: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/setup');
    } catch (err) {
      setError(err.response?.data?.errors?.[0] || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col justify-between relative overflow-hidden font-sans w-full">
      
      {/* Background gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[600px] h-[350px] sm:h-[600px] bg-indigo-500/10 rounded-full blur-[110px] pointer-events-none z-0" />
      <div className="absolute top-[10%] left-[5%] w-[250px] h-[250px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none z-0" />

      {/* Spacer / Logo block */}
      <div className="pt-10 px-4 text-center z-10">
        <Link to="/" className="inline-flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <FiLayers className="text-white text-xl" />
          </div>
          <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
            SmartGoNext <span className="text-indigo-400">ERP</span>
          </span>
        </Link>
      </div>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center px-4 relative z-10 py-10">
        <div className="w-full max-w-lg">
          
          <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl shadow-2xl backdrop-blur-md">
            <h2 className="text-2xl font-black text-white text-center mb-2 tracking-tight">Create Workspace</h2>
            <p className="text-xs text-slate-400 text-center mb-8">Start your 15-day free ERP trial</p>
            
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-4 rounded-xl mb-6 flex items-start gap-2.5">
                <FiAlertCircle className="text-lg flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Error:</span> {error}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Company Name</label>
                  <input 
                    name="company_name" 
                    value={form.company_name} 
                    onChange={handleChange} 
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:bg-slate-950 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all duration-200" 
                    placeholder="Your Business Name" 
                    required 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Subdomain</label>
                  <div className="flex items-center">
                    <input 
                      name="subdomain" 
                      value={form.subdomain} 
                      onChange={handleChange} 
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:bg-slate-950 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all duration-200" 
                      placeholder="your-company" 
                      required 
                    />
                    <span className="ml-2 text-slate-400 text-sm font-semibold">.app</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Business Type</label>
                  <select 
                    name="business_type" 
                    value={form.business_type} 
                    onChange={handleChange} 
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:bg-slate-950 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all duration-200"
                    required
                  >
                    <option value="" className="text-slate-600">Select type</option>
                    {BUSINESS_TYPES.map(bt => <option key={bt} value={bt} className="text-slate-800">{bt}</option>)}
                  </select>

                  {MFG_PROFILES[form.business_type] && (
                    <div className="mt-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                      <p className="font-bold mb-1">Manufacturing engine: {MFG_PROFILES[form.business_type].mfg_type}</p>
                      <p>BOM type: <span className="font-semibold">{MFG_PROFILES[form.business_type].label}</span></p>
                      <p className="text-indigo-300/80">Features: {MFG_PROFILES[form.business_type].features}</p>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Admin Name</label>
                  <input 
                    name="admin_name" 
                    value={form.admin_name} 
                    onChange={handleChange} 
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:bg-slate-950 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all duration-200" 
                    placeholder="Your Name" 
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Email</label>
                  <input 
                    name="email" 
                    type="email" 
                    value={form.email} 
                    onChange={handleChange} 
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:bg-slate-950 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all duration-200" 
                    placeholder="admin@company.com" 
                    required 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Password</label>
                  <input 
                    name="password" 
                    type="password" 
                    value={form.password} 
                    onChange={handleChange} 
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:bg-slate-950 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all duration-200" 
                    placeholder="Min 6 characters" 
                    required 
                    minLength={6} 
                  />
                </div>

              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-4 flex items-center justify-center cursor-pointer"
              >
                {loading ? 'Creating Account...' : 'Create Account & Start Free Trial'}
              </motion.button>
            </form>

            <div className="mt-8 text-center text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-400 hover:underline font-semibold">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950/40 py-6 text-center text-xs text-slate-600 z-10">
        &copy; {new Date().getFullYear()} SmartGoNext ERP Systems. All rights reserved.
      </footer>
      
    </div>
  );
}