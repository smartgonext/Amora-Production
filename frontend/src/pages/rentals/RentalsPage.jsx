import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCalendar, FiPlus, FiX, FiCheck, FiArrowRight, FiInfo } from 'react-icons/fi';
import apiClient from '../../api/client';
import { formatINR } from '../../utils/format';
import toast from 'react-hot-toast';
import DynamicFormSections from '../../components/common/DynamicFormSections';

export default function RentalsPage() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Form State - Agreement
  const [agreementForm, setAgreementForm] = useState({
    customer_id: '',
    equipment_id: '',
    start_date: '',
    end_date: '',
    rental_rate_applied: 8000,
    security_deposit: 15000,
    site_address: ''
  });

  // Form State - Return
  const [damageCharges, setDamageCharges] = useState(0);
  const [conditionNotes, setConditionNotes] = useState('Returned in good working condition.');

  // Fetch Rentals
  const { data: rentalsResponse, isLoading } = useQuery({
    queryKey: ['rentals'],
    queryFn: async () => {
      const response = await apiClient.get('/equipment/rentals');
      return response.data;
    }
  });
  const rentals = rentalsResponse?.data || [];

  // Fetch Customers
  const { data: customersResponse } = useQuery({
    queryKey: ['customers-mini'],
    queryFn: async () => {
      const response = await apiClient.get('/customers');
      return response.data;
    }
  });
  const customers = customersResponse?.data || [];

  // Fetch Available Equipment
  const { data: eqResponse } = useQuery({
    queryKey: ['equipment-available'],
    queryFn: async () => {
      const response = await apiClient.get('/equipment', {
        params: { rental_status: 'Available' }
      });
      return response.data;
    }
  });
  const availableEquipment = eqResponse?.data || [];

  // Create Rental Mutation
  const createRentalMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/equipment/rentals', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Rental agreement generated successfully!');
      setIsAddOpen(false);
      resetAgreementForm();
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-available'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to create rental agreement');
    }
  });

  // Return Rental Mutation
  const returnRentalMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const response = await apiClient.post(`/equipment/rentals/${id}/return`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Equipment return logged successfully!');
      setIsReturnOpen(false);
      setSelectedBooking(null);
      resetReturnForm();
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-available'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to process return');
    }
  });

  const resetAgreementForm = () => {
    setAgreementForm({
      customer_id: '',
      equipment_id: '',
      start_date: '',
      end_date: '',
      rental_rate_applied: 8000,
      security_deposit: 15000,
      site_address: ''
    });
  };

  const resetReturnForm = () => {
    setDamageCharges(0);
    setConditionNotes('Returned in good working condition.');
  };

  const handleCreateAgreement = (e) => {
    e.preventDefault();
    createRentalMutation.mutate({
      ...agreementForm,
      customer_id: parseInt(agreementForm.customer_id),
      equipment_id: parseInt(agreementForm.equipment_id),
      rental_rate_applied: parseFloat(agreementForm.rental_rate_applied),
      security_deposit: parseFloat(agreementForm.security_deposit),
      rate_type: 'Daily'
    });
  };

  const handleProcessReturn = (e) => {
    e.preventDefault();
    returnRentalMutation.mutate({
      id: selectedBooking.id,
      payload: {
        damage_charges: parseFloat(damageCharges),
        return_condition_notes: conditionNotes
      }
    });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header section with Premium Indigo-Slate Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Rental Agreements</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Track rental timelines, process returns, log damage repair charges, and manage client security deposit settlements.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAddOpen(true)}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg text-sm"
          >
            <FiPlus />
            <span>New Agreement</span>
          </motion.button>
        </div>
      </div>

      {/* Rentals register */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : rentals.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <FiCalendar className="mx-auto text-5xl mb-4 text-slate-300 dark:text-slate-700" />
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No active rental agreements</p>
            <p className="text-sm text-slate-400 mt-1">Generate a rental contract using the New Agreement button above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Booking Code</th>
                  <th className="py-4 px-6">Equipment / Customer ID</th>
                  <th className="py-4 px-6">Rental Period</th>
                  <th className="py-4 px-6">Applied Daily Rate</th>
                  <th className="py-4 px-6">Deposit</th>
                  <th className="py-4 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {rentals.map((bk) => (
                  <tr key={bk.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-6 font-mono font-semibold text-indigo-600">
                      {bk.booking_number}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900 dark:text-white">Equipment #{bk.equipment_id}</div>
                      <div className="text-xs text-slate-400">Client ID #{bk.customer_id}</div>
                    </td>
                    <td className="py-4 px-6 text-xs font-medium">
                      <div>Start: {new Date(bk.start_date).toLocaleDateString()}</div>
                      <div className="text-slate-405">End: {new Date(bk.end_date).toLocaleDateString()}</div>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                      {formatINR(bk.rental_rate_applied)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-slate-800 dark:text-slate-200 font-medium">{formatINR(bk.security_deposit)}</div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {bk.status === 'Active' ? (
                        <div className="flex items-center justify-end space-x-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-600">
                            Active Dispatch
                          </span>
                          <button
                            onClick={() => {
                              setSelectedBooking(bk);
                              setIsReturnOpen(true);
                            }}
                            className="text-xs font-semibold bg-slate-100 hover:bg-indigo-650 hover:text-white text-slate-700 px-2 py-1 rounded border border-slate-200 transition-colors"
                          >
                            Return
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">
                          Returned
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE AGREEMENT MODAL */}
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
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Create Rental Agreement</h3>
                <button onClick={() => setIsAddOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleCreateAgreement} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <DynamicFormSections
                  entityType="rental"
                  formData={agreementForm}
                  onChange={(key, val) => setAgreementForm(prev => ({ ...prev, [key]: val }))}
                  showStatic={true}
                  customRenderers={{
                    customer_id: (field, val, onChange) => (
                      <select
                        required={field.is_required}
                        value={val}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      >
                        <option value="">-- Choose Customer --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                        ))}
                      </select>
                    ),
                    equipment_id: (field, val, onChange) => (
                      <select
                        required={field.is_required}
                        value={val}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      >
                        <option value="">-- Choose Equipment --</option>
                        {availableEquipment.map(eq => (
                          <option key={eq.id} value={eq.id}>{eq.name} (Capacity: {eq.ton_capacity}T)</option>
                        ))}
                      </select>
                    )
                  }}
                />

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={createRentalMutation.isPending} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md">
                    {createRentalMutation.isPending ? 'Saving...' : 'Deploy Agreement'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROCESS RETURN MODAL */}
      <AnimatePresence>
        {isReturnOpen && selectedBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReturnOpen(false)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Process Equipment Return</h3>
                <button onClick={() => setIsReturnOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleProcessReturn} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Damage Charges / Penalty (₹)</label>
                  <input
                    type="number"
                    value={damageCharges}
                    onChange={(e) => setDamageCharges(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Condition Notes / Inspect Remarks</label>
                  <textarea
                    rows={4}
                    value={conditionNotes}
                    onChange={(e) => setConditionNotes(e.target.value)}
                    placeholder="Describe any scratch, tire wear, or damage detected on vehicle inspection..."
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsReturnOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={returnRentalMutation.isPending} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-sm shadow-md">
                    {returnRentalMutation.isPending ? 'Saving...' : 'Confirm Return'}
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
