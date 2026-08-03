import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiTruck, FiPlus, FiX, FiCheck, FiSearch, FiInfo } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

export default function EquipmentPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [eqName, setEqName] = useState('');
  const [eqType, setEqType] = useState('Crane');
  const [modelNum, setModelNum] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [regNum, setRegNum] = useState('');
  const [hourlyRate, setHourlyRate] = useState(1500);
  const [dailyRate, setDailyRate] = useState(8000);

  // Fetch Equipment
  const { data: eqResponse, isLoading } = useQuery({
    queryKey: ['equipment', searchTerm],
    queryFn: async () => {
      const response = await apiClient.get('/equipment');
      return response.data;
    }
  });
  const equipmentList = eqResponse?.data || [];

  // Create Equipment Mutation
  const createEqMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/equipment', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Equipment registered successfully!');
      setIsAddOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to register equipment');
    }
  });

  const resetForm = () => {
    setEqName('');
    setEqType('Crane');
    setModelNum('');
    setCapacity(10);
    setRegNum('');
    setHourlyRate(1500);
    setDailyRate(8000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createEqMutation.mutate({
      name: eqName,
      type: eqType,
      model_number: modelNum,
      ton_capacity: parseFloat(capacity),
      registration_number: regNum,
      min_hourly_rate: parseFloat(hourlyRate),
      min_daily_rate: parseFloat(dailyRate)
    });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header section with Premium Indigo-Slate Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Equipment Registry</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Track cranes, forklifts, attachments, and heavy rental logistics assets across all company branches.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAddOpen(true)}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg text-sm"
          >
            <FiPlus />
            <span>Add Asset</span>
          </motion.button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : equipmentList.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <FiTruck className="mx-auto text-5xl mb-4 text-slate-300 dark:text-slate-700" />
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No equipment registered</p>
            <p className="text-sm text-slate-400 mt-1">Register a crane or forklift vehicle to start tracking rental bookings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Model / Name</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6">Capacity (Tons)</th>
                  <th className="py-4 px-6">Reg. Number</th>
                  <th className="py-4 px-6">Min Rates</th>
                  <th className="py-4 px-6 text-right">Rental Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {equipmentList.map((eq) => (
                  <tr key={eq.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900 dark:text-white">{eq.name}</div>
                      <div className="text-xs text-slate-400 font-mono">Serial: {eq.serial_number}</div>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-800 dark:text-slate-200">
                      {eq.type}
                    </td>
                    <td className="py-4 px-6 font-semibold">
                      {eq.ton_capacity ? `${eq.ton_capacity} T` : 'N/A'}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs">
                      {eq.registration_number || 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-xs">
                      <div>₹{eq.min_hourly_rate}/hr</div>
                      <div className="text-slate-405 font-medium">₹{eq.min_daily_rate}/day</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        eq.rental_status === 'Available' ? 'bg-emerald-50 text-emerald-600' :
                        eq.rental_status === 'Rented' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {eq.rental_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD ASSET MODAL */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddOpen(false)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Register Heavy Asset</h3>
                <button onClick={() => setIsAddOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Asset Name *</label>
                  <input
                    type="text"
                    required
                    value={eqName}
                    onChange={(e) => setEqName(e.target.value)}
                    placeholder="e.g. Demag AC 250 Crane"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Type</label>
                    <select
                      value={eqType}
                      onChange={(e) => setEqType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="Crane">Hydraulic Crane</option>
                      <option value="Forklift">Diesel Forklift</option>
                      <option value="Excavator">Excavator</option>
                      <option value="Attachment">Boom Extension</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Ton Capacity</label>
                    <input
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Model Number</label>
                    <input
                      type="text"
                      value={modelNum}
                      onChange={(e) => setModelNum(e.target.value)}
                      placeholder="e.g. AC-250"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Registration No.</label>
                    <input
                      type="text"
                      value={regNum}
                      onChange={(e) => setRegNum(e.target.value)}
                      placeholder="e.g. MH-12-PQ-4567"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Min Hourly Rate (₹)</label>
                    <input
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Min Daily Rate (₹)</label>
                    <input
                      type="number"
                      value={dailyRate}
                      onChange={(e) => setDailyRate(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={createEqMutation.isPending} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md">
                    {createEqMutation.isPending ? 'Registering...' : 'Save Asset'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
