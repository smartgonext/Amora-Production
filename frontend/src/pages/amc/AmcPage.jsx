import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSliders, FiPlus, FiX, FiCheck, FiArrowRight, FiUser, FiInfo, FiActivity } from 'react-icons/fi';
import apiClient from '../../api/client';
import { formatINR } from '../../utils/format';
import toast from 'react-hot-toast';
import DynamicFormSections from '../../components/common/DynamicFormSections';

export default function AmcPage() {
  const queryClient = useQueryClient();
  const [selectedAmc, setSelectedAmc] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isVisitOpen, setIsVisitOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // Form State - Contract
  const [contractForm, setContractForm] = useState({
    customer_id: '',
    contract_title: '',
    amc_value: 45000,
    service_interval_days: 90,
    machine_name: '',
    machine_serial: '',
    model: '',
    capacity: '',
    start_date: '',
    end_date: ''
  });

  // Form State - Log Visit
  const [findings, setFindings] = useState('All fluid levels and cables inspected. Replaced filter.');
  const [partsJson, setPartsJson] = useState('[]');

  // Fetch AMCs
  const { data: amcsResponse, isLoading } = useQuery({
    queryKey: ['amc-contracts'],
    queryFn: async () => {
      const response = await apiClient.get('/equipment/amc');
      return response.data;
    }
  });
  const amcs = amcsResponse?.data || [];

  // Fetch Customers
  const { data: customersResponse } = useQuery({
    queryKey: ['customers-mini'],
    queryFn: async () => {
      const response = await apiClient.get('/customers');
      return response.data;
    }
  });
  const customers = customersResponse?.data || [];

  // Create AMC Mutation
  const createAmcMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/equipment/amc', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('AMC contract and scheduling created!');
      setIsAddOpen(false);
      resetContractForm();
      queryClient.invalidateQueries({ queryKey: ['amc-contracts'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to create contract');
    }
  });

  // Log Service Visit Mutation
  const logVisitMutation = useMutation({
    mutationFn: async ({ scheduleId, payload }) => {
      const response = await apiClient.post(`/equipment/amc/schedule/${scheduleId}/visit`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Technician service visit logged! Stock quantities updated.');
      setIsVisitOpen(false);
      setSelectedSchedule(null);
      resetVisitForm();
      queryClient.invalidateQueries({ queryKey: ['amc-contracts'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to log service visit');
    }
  });

  const resetContractForm = () => {
    setContractForm({
      customer_id: '',
      contract_title: '',
      amc_value: 45000,
      service_interval_days: 90,
      machine_name: '',
      machine_serial: '',
      model: '',
      capacity: '',
      start_date: '',
      end_date: ''
    });
  };

  const resetVisitForm = () => {
    setFindings('All fluid levels and cables inspected. Replaced filter.');
    setPartsJson('[]');
  };

  const handleCreateContract = (e) => {
    e.preventDefault();
    createAmcMutation.mutate({
      ...contractForm,
      customer_id: parseInt(contractForm.customer_id),
      amc_value: parseFloat(contractForm.amc_value),
      service_interval_days: parseInt(contractForm.service_interval_days)
    });
  };

  const handleLogVisit = (e) => {
    e.preventDefault();
    let parts = [];
    try {
      parts = JSON.parse(partsJson);
    } catch (e) {
      toast.error('Invalid parts JSON formatting. Example: [{"product_id": 1, "qty": 2}]');
      return;
    }
    logVisitMutation.mutate({
      scheduleId: selectedSchedule.id,
      payload: {
        findings_report: findings,
        parts_consumed: parts
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
            <div className="flex items-center space-x-2">
              {selectedAmc && (
                <button
                  onClick={() => setSelectedAmc(null)}
                  className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-lg border border-slate-700 mb-1 mr-2 transition-all"
                >
                  ← Back to AMC Contracts
                </button>
              )}
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                {selectedAmc ? `${selectedAmc.contract_title}` : 'Annual Maintenance Contracts (AMC)'}
              </h1>
            </div>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              {selectedAmc
                ? 'Review scheduled inspection intervals, technician work logs, and spare parts depletion history.'
                : 'Manage customer equipment maintenance SLAs, auto-calculate service visit frequencies, and log checklist results.'}
            </p>
          </div>
          {!selectedAmc && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAddOpen(true)}
              className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg text-sm"
            >
              <FiPlus />
              <span>Create AMC</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Main Container */}
      {!selectedAmc ? (
        // AMC CONTRACT LISTS
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
            </div>
          ) : amcs.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <FiSliders className="mx-auto text-5xl mb-4 text-slate-300 dark:text-slate-700" />
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No AMC contracts active</p>
              <p className="text-sm text-slate-400 mt-1">Register a service SLA contract to auto-schedule planned visits.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                    <th className="py-4 px-6">Contract Name</th>
                    <th className="py-4 px-6">Customer</th>
                    <th className="py-4 px-6">Period</th>
                    <th className="py-4 px-6">Value</th>
                    <th className="py-4 px-6 text-right">Service Schedule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                  {amcs.map((amc) => (
                    <tr key={amc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">
                        {amc.contract_title}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-800 dark:text-slate-200">
                        Customer #{amc.customer_id}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500">
                        {new Date(amc.start_date).toLocaleDateString()} to {new Date(amc.end_date).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                        {formatINR(amc.amc_value)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setSelectedAmc(amc)}
                          className="text-xs font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 px-3 py-1.5 rounded-lg border border-transparent hover:border-indigo-500 transition-all"
                        >
                          View Schedule
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        // DETAILED VISIT SHIFT SCHEDULES FOR SELECTED AMC
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-955 dark:text-white">SLA Service Timeline</h3>
              <p className="text-xs text-slate-400 mt-0.5">Visits mapped automatically every {selectedAmc.service_interval_days} days.</p>
            </div>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-bold">
              Interval: {selectedAmc.service_interval_days} days
            </span>
          </div>

          <div className="space-y-4">
            {(selectedAmc.schedules || []).length === 0 ? (
              <p className="text-sm text-slate-400 italic">No scheduled visits registered on contract timeline.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {selectedAmc.schedules.map((s, idx) => (
                  <div key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">Visit #{idx + 1}</h4>
                      <div className="text-xs text-slate-400 mt-0.5">Planned date: {new Date(s.scheduled_date).toLocaleDateString()}</div>
                      {s.findings_report && (
                        <p className="text-xs text-slate-500 italic mt-2">Report: {s.findings_report}</p>
                      )}
                    </div>
                    <div>
                      {s.status === 'Pending' ? (
                        <button
                          onClick={() => {
                            setSelectedSchedule(s);
                            setIsVisitOpen(true);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm"
                        >
                          Log Work & Parts
                        </button>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-600">
                          Completed on {new Date(s.serviced_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE CONTRACT MODAL */}
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
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-955 dark:text-white">Create AMC Contract</h3>
                <button onClick={() => setIsAddOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleCreateContract} className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[70vh]">
                <DynamicFormSections
                  entityType="amc"
                  formData={contractForm}
                  onChange={(key, val) => setContractForm(prev => ({ ...prev, [key]: val }))}
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
                    )
                  }}
                />

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={createAmcMutation.isPending} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md">
                    {createAmcMutation.isPending ? 'Saving...' : 'Deploy Contract'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LOG SERVICE VISIT MODAL */}
      <AnimatePresence>
        {isVisitOpen && selectedSchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVisitOpen(false)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-955 dark:text-white">Log Scheduled Service Visit</h3>
                <button onClick={() => setIsVisitOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleLogVisit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Findings & Checklist Report</label>
                  <textarea
                    rows={3}
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Parts Consumed (JSON array)</label>
                  <textarea
                    rows={4}
                    value={partsJson}
                    onChange={(e) => setPartsJson(e.target.value)}
                    placeholder='[{"product_id": 1, "qty": 2}]'
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-805 dark:text-white rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                  <span className="text-[10px] text-slate-400 block">Deducts stock automatically from product inventory ledger.</span>
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsVisitOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={logVisitMutation.isPending} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-md">
                    {logVisitMutation.isPending ? 'Logging...' : 'Confirm Visit'}
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
