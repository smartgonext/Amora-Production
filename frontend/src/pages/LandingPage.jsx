import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { 
  FiLayers, 
  FiLock, 
  FiKey, 
  FiCpu, 
  FiTerminal, 
  FiCheckCircle, 
  FiTrendingUp, 
  FiBox,
  FiUserPlus,
  FiLogIn
} from 'react-icons/fi';

export default function LandingPage() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="bg-slate-900 text-slate-100 min-h-screen flex flex-col w-full overflow-x-hidden font-sans">
      
      {/* Background radial gradients for premium depth */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none z-0" />
      <div className="absolute top-[20%] left-[10%] w-[350px] sm:w-[600px] h-[350px] sm:h-[600px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-[40%] right-[10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Header Navigation */}
      <header className="relative w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo brand */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FiLayers className="text-white text-xl" />
            </div>
            <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
              SmartGoNext <span className="text-indigo-400">ERP</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link 
                  to="/dashboard" 
                  className="text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="text-xs sm:text-sm font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-4 py-2 rounded-xl border border-rose-500/20 transition-all"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="text-sm font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 px-4 py-2 hover:bg-slate-800/50 rounded-xl transition-all"
                >
                  <FiLogIn />
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="text-xs sm:text-sm font-bold bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5"
                >
                  <FiUserPlus />
                  Register Trial
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex-1 w-full z-10">
        
        {/* Hero Section */}
        <section className="py-20 sm:py-28 lg:py-36 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs uppercase font-extrabold tracking-widest bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-full border border-indigo-500/20 inline-block mb-6"
          >
            Hybrid SaaS & Desktop ERP Solution
          </motion.span>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-tight max-w-5xl"
          >
            One Platform to Run Your Entire{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
              Business Operations
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-400 mb-12 max-w-3xl leading-relaxed"
          >
            Automate invoicing, tracking inventory, personnel payroll, project management, and specialized rentals or AMC contracts under a single secure tenant workspace.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto px-4 sm:px-0"
          >
            <Link
              to="/register"
              className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold px-8 py-4 rounded-xl shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all text-center text-base"
            >
              Get Started Free
            </Link>
            <Link
              to="/login"
              className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold px-8 py-4 rounded-xl transition-all text-center text-base"
            >
              Sign In to Dashboard
            </Link>
          </motion.div>
        </section>

        {/* Features Grids */}
        <section className="py-24 border-t border-slate-800 bg-slate-950/40">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center mb-16 sm:mb-20">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Engineered for Infinite Scalability
              </h2>
              <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
                Discover a complete suite of enterprise utilities built on top of database isolation and real-time backend updates.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Feature 1 */}
              <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl hover:border-indigo-500/30 hover:bg-slate-900 transition-all duration-300 flex flex-col justify-between group">
                <div>
                  <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/25 rounded-xl flex items-center justify-center mb-6 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                    <FiLock className="text-2xl" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">Advanced Tenant Isolation</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Safeguard financial books, client indexes, and stock audit logs with secure row-level logical separation.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl hover:border-violet-500/30 hover:bg-slate-900 transition-all duration-300 flex flex-col justify-between group">
                <div>
                  <div className="w-14 h-14 bg-violet-500/10 border border-violet-500/25 rounded-xl flex items-center justify-center mb-6 text-violet-400 group-hover:bg-violet-500 group-hover:text-white transition-all">
                    <FiCpu className="text-2xl" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">Hybrid SQLite Offline Sync</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Desktop client persistence queues billing actions locally during outages and automatically uploads records on reconnect.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl hover:border-emerald-500/30 hover:bg-slate-900 transition-all duration-300 flex flex-col justify-between group">
                <div>
                  <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-center mb-6 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                    <FiTerminal className="text-2xl" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">Fast POS Checkout Terminal</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Designed for cashier keyboard efficiency. Add products, configure taxes, and process card/UPI/credit drafts in seconds.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Specialized Verticals Section */}
        <section className="py-24 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            <div className="space-y-6 text-left">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Designed for Specialty Verticals & Heavy Asset Rental Services
              </h2>
              <p className="text-slate-400 leading-relaxed text-base">
                SmartGoNext provides deep specialty configurations out of the box, such as the **Crane & Forklift** vertical which binds three primary revenue streams:
              </p>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <FiCheckCircle className="text-indigo-400 mt-1 flex-shrink-0" />
                  <div>
                    <strong className="text-slate-200">Spare Parts Inventory:</strong> Track model compatibility, check minimum stock levels, and issue sales invoices.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <FiCheckCircle className="text-indigo-400 mt-1 flex-shrink-0" />
                  <div>
                    <strong className="text-slate-200">Heavy Machinery Rental:</strong> Manage available fleets, set daily/monthly rental rates, log dispatches and condition returns.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <FiCheckCircle className="text-indigo-400 mt-1 flex-shrink-0" />
                  <div>
                    <strong className="text-slate-200">Automated SLA Maintenance:</strong> Track Annual Maintenance Contracts, auto-generate visit timelines, and log parts consumption.
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <h3 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
                <FiTrendingUp className="text-indigo-400" />
                Live Fleet Status Overview
              </h3>
              
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <FiBox className="text-emerald-400" />
                    <span>Hydraulic Crane Demag AC-250</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">Available</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <FiBox className="text-amber-400" />
                    <span>CAT Forklift 5-Ton FL-50</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">On Rental</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <FiBox className="text-indigo-400" />
                    <span>Liebherr Crane LTM-1050</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">AMC Scheduled</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800/80 flex justify-between items-center">
                <span className="text-xs text-slate-400">Standardized SAC-based tax processing automatically applied.</span>
                <Link to="/login" className="text-xs text-indigo-400 font-bold hover:underline">View Live Demo &rarr;</Link>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800 bg-slate-950 py-8 relative z-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>&copy; {new Date().getFullYear()} SmartGoNext ERP Systems. All rights reserved.</span>
          <div className="flex gap-6">
            <Link to="/login" className="hover:text-slate-300">Privacy Policy</Link>
            <Link to="/login" className="hover:text-slate-300">Terms of Service</Link>
            <Link to="/login" className="hover:text-slate-300">Support Runbook</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
