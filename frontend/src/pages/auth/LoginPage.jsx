import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiLock, FiMail, FiEye, FiEyeOff, FiLayers, FiAlertCircle } from 'react-icons/fi';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // Clean redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.errors?.[0] || 'Invalid email or password. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col justify-between relative overflow-hidden font-sans w-full">
      
      {/* Background gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[90px] pointer-events-none z-0" />

      {/* Spacer / Logo block */}
      <div className="pt-12 px-4 text-center z-10">
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
      <div className="flex-1 flex items-center justify-center px-4 relative z-10 py-12">
        <div className="w-full max-w-md">
          
          <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl shadow-2xl backdrop-blur-md">
            <h2 className="text-2xl font-black text-white text-center mb-2 tracking-tight">Welcome Back</h2>
            <p className="text-xs text-slate-400 text-center mb-8">Sign in to manage your tenant workspace</p>
            
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-4 rounded-xl mb-6 flex items-start gap-2.5">
                <FiAlertCircle className="text-lg flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Error:</span> {error}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Email Address
                </label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:bg-slate-950 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all duration-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="off"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:bg-slate-950 rounded-xl pl-11 pr-12 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    tabIndex={-1}
                  >
                    {showPassword ? <FiEyeOff className="text-lg" /> : <FiEye className="text-lg" />}
                  </button>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-3 flex items-center justify-center cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </motion.button>
            </form>

            <div className="mt-8 text-center text-xs text-slate-500">
              Need a new tenant account?{' '}
              <Link to="/register" className="text-indigo-400 hover:underline font-semibold">
                Register company
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