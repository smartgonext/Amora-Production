import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiUserPlus, FiSearch, FiEdit2, FiTrash2, FiEye, FiX, FiCheck, FiAlertTriangle, FiPhone, FiMail, FiMapPin, FiCreditCard } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import DynamicFormSections from '../../components/common/DynamicFormSections';

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    pan: '',
    credit_limit: 0,
    credit_period_days: 0,
    notes: '',
    is_active: true
  });

  // Fetch Customers
  const { data: customersResponse, isLoading, error } = useQuery({
    queryKey: ['customers', searchTerm],
    queryFn: async () => {
      const response = await apiClient.get('/customers', {
        params: { search: searchTerm }
      });
      return response.data;
    }
  });

  const customers = customersResponse?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (newCustomer) => {
      const response = await apiClient.post('/customers', newCustomer);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer added successfully!');
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to add customer');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put(`/customers/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated successfully!');
      setIsEditOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to update customer');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.delete(`/customers/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted successfully!');
      setIsDeleteOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to delete customer');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      gstin: '',
      pan: '',
      credit_limit: 0,
      credit_period_days: 0,
      notes: '',
      is_active: true
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setCustomerToEdit(customer);
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      pincode: customer.pincode || '',
      gstin: customer.gstin || '',
      pan: customer.pan || '',
      credit_limit: customer.credit_limit || 0,
      credit_period_days: customer.credit_period_days || 0,
      notes: customer.notes || '',
      is_active: customer.is_active !== false
    });
    setIsEditOpen(true);
  };

  const handleOpenDelete = (customer) => {
    setCustomerToDelete(customer);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = (e, mode) => {
    e.preventDefault();
    if (mode === 'add') {
      createMutation.mutate(formData);
    } else if (mode === 'edit') {
      updateMutation.mutate({ id: customerToEdit.id, data: formData });
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (statusFilter === 'active') return c.is_active;
    if (statusFilter === 'inactive') return !c.is_active;
    return true;
  });

  // Calculate quick stats
  const totalCount = customers.length;
  const activeCount = customers.filter(c => c.is_active).length;
  const inactiveCount = totalCount - activeCount;
  const totalCreditLimit = customers.reduce((sum, c) => sum + parseFloat(c.credit_limit || 0), 0);

  return (
    <div className="space-y-8 pb-12">
      {/* Header section with Glassmorphism background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Customer Directory</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Manage accounts, credit configurations, billing history, and contact details for all active partners.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleOpenAdd}
            className="flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all"
          >
            <FiUserPlus className="text-lg" />
            <span>Add Customer</span>
          </motion.button>
        </div>
      </div>

      {/* CRM Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: 'Total Partners', value: totalCount, subtitle: 'Registered profiles', icon: FiUsers, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/10' },
          { title: 'Active Accounts', value: activeCount, subtitle: 'Operational partners', icon: FiCheck, color: 'from-emerald-400 to-teal-600', shadow: 'shadow-emerald-500/10' },
          { title: 'Deactivated', value: inactiveCount, subtitle: 'Archived profiles', icon: FiAlertTriangle, color: 'from-rose-400 to-orange-500', shadow: 'shadow-rose-500/10' },
          { title: 'Global Credit Limit', value: `₹${totalCreditLimit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtitle: 'Authorized risk window', icon: FiCreditCard, color: 'from-violet-500 to-purple-700', shadow: 'shadow-violet-500/10' }
        ].map((stat) => (
          <div key={stat.title} className={`relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 flex items-center justify-between shadow-md ${stat.shadow}`}>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{stat.title}</span>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{stat.value}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.subtitle}</p>
            </div>
            <div className={`p-3.5 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg`}>
              <stat.icon className="text-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
          />
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {['all', 'active', 'inactive'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-150 border ${
                statusFilter === status
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-md'
                  : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Customers List / Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
            <span className="text-sm text-slate-400">Loading directory...</span>
          </div>
        ) : error ? (
          <div className="py-20 text-center text-rose-500">
            <FiAlertTriangle className="mx-auto text-4xl mb-3" />
            <p>Failed to load customer profiles. Please refresh.</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <FiUsers className="mx-auto text-5xl mb-4 text-slate-300 dark:text-slate-700" />
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No customers found</p>
            <p className="text-sm text-slate-400 mt-1">Try resetting filters or registering a new profile.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Customer Info</th>
                  <th className="py-4 px-6">Contact details</th>
                  <th className="py-4 px-6">GSTIN / PAN</th>
                  <th className="py-4 px-6">Credit Control</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-sm shadow-sm">
                          {c.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{c.name}</div>
                          <div className="text-xs text-slate-400">{c.city ? `${c.city}, ${c.state || ''}` : 'Location not set'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <FiPhone className="text-slate-400 flex-shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                        {c.email && (
                          <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <FiMail className="text-slate-400 flex-shrink-0" />
                            <span>{c.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-mono text-xs">
                        <div>GST: <span className="text-slate-950 dark:text-slate-100 font-medium">{c.gstin || 'N/A'}</span></div>
                        <div>PAN: <span className="text-slate-950 dark:text-slate-100 font-medium">{c.pan || 'N/A'}</span></div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">₹{parseFloat(c.credit_limit || 0).toLocaleString('en-IN')}</span>
                        <div className="text-xs text-slate-400">{c.credit_period_days || 0} days term</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        c.is_active
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${c.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          title="View Details"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <FiEye />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(c)}
                          title="Delete"
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAILS PANEL (SLIDE OVER) */}
      <AnimatePresence>
        {selectedCustomer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCustomer(null)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-screen w-full sm:w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-50 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center">
                    {selectedCustomer.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-950 dark:text-white text-lg">{selectedCustomer.name}</h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">ID: {selectedCustomer.id}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <FiX />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Contact Card */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact & Location</h4>
                  <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                    <FiPhone className="text-slate-400" />
                    <span>{selectedCustomer.phone}</span>
                  </div>
                  {selectedCustomer.email && (
                    <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                      <FiMail className="text-slate-400" />
                      <span>{selectedCustomer.email}</span>
                    </div>
                  )}
                  <div className="flex items-start space-x-2 text-sm text-slate-600 dark:text-slate-400">
                    <FiMapPin className="text-slate-400 mt-0.5" />
                    <div>
                      <div>{selectedCustomer.address || 'No address set'}</div>
                      {(selectedCustomer.city || selectedCustomer.state) && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          {selectedCustomer.city}{selectedCustomer.state ? `, ${selectedCustomer.state}` : ''} {selectedCustomer.pincode || ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Credit Control */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-4 space-y-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Credit Terms</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500">Credit Limit</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                        ₹{parseFloat(selectedCustomer.credit_limit || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Credit Period</div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {selectedCustomer.credit_period_days || 0} Days
                      </div>
                    </div>
                  </div>
                </div>

                {/* Identifiers */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Identifiers</h4>
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">GSTIN</div>
                    <div className="font-mono text-sm text-slate-800 dark:text-slate-200">{selectedCustomer.gstin || 'Not registered'}</div>
                  </div>
                  <div className="space-y-1 mt-3">
                    <div className="text-xs text-slate-500">PAN</div>
                    <div className="font-mono text-sm text-slate-800 dark:text-slate-200">{selectedCustomer.pan || 'Not registered'}</div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Internal Notes</h4>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-400 min-h-24">
                    {selectedCustomer.notes || 'No notes added.'}
                  </div>
                </div>
              </div>

              {/* Actions footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40">
                <button
                  onClick={() => {
                    handleOpenEdit(selectedCustomer);
                    setSelectedCustomer(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-700 dark:text-slate-300"
                >
                  Edit Profile
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ADD MODAL */}
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
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Register New Customer</h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                >
                  <FiX />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={(e) => handleFormSubmit(e, 'add')} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Customer Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Acme Corporation"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. billing@acme.com"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Credit Limit (INR)</label>
                    <input
                      type="number"
                      value={formData.credit_limit}
                      onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Credit Period (Days)</label>
                    <input
                      type="number"
                      value={formData.credit_period_days}
                      onChange={(e) => setFormData({ ...formData, credit_period_days: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">GSTIN</label>
                    <input
                      type="text"
                      value={formData.gstin}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                      placeholder="e.g. 29AAAAA0000A1Z5"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">PAN</label>
                    <input
                      type="text"
                      value={formData.pan}
                      onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                      placeholder="e.g. ABCDE1234F"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 flex items-center h-full pt-6">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5"
                      />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Set Account to Active</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Billing Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street Address, Area"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Bangalore"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="e.g. Karnataka"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Pincode</label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="e.g. 560001"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Remarks / Notes</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="General terms, specific request details, contact logs..."
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <DynamicFormSections
                  entityType="customer"
                  formData={formData}
                  onChange={(key, val) => setFormData((prev) => ({ ...prev, [key]: val }))}
                />

                {/* Modal Actions */}
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-colors text-sm font-semibold"
                  >
                    {createMutation.isPending ? 'Saving...' : 'Add Partner'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditOpen(false)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Edit Customer Profile</h3>
                <button
                  onClick={() => setIsEditOpen(false)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                >
                  <FiX />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={(e) => handleFormSubmit(e, 'edit')} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Customer Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Credit Limit (INR)</label>
                    <input
                      type="number"
                      value={formData.credit_limit}
                      onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Credit Period (Days)</label>
                    <input
                      type="number"
                      value={formData.credit_period_days}
                      onChange={(e) => setFormData({ ...formData, credit_period_days: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">GSTIN</label>
                    <input
                      type="text"
                      value={formData.gstin}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">PAN</label>
                    <input
                      type="text"
                      value={formData.pan}
                      onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 flex items-center h-full pt-6">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5"
                      />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Active Account</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Billing Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Pincode</label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Remarks / Notes</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <DynamicFormSections
                  entityType="customer"
                  formData={formData}
                  onChange={(key, val) => setFormData((prev) => ({ ...prev, [key]: val }))}
                />

                {/* Modal Actions */}
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-colors text-sm font-semibold"
                  >
                    {updateMutation.isPending ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE MODAL */}
      <AnimatePresence>
        {isDeleteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteOpen(false)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 z-10 space-y-4"
            >
              <div className="flex items-center space-x-3 text-rose-600">
                <FiAlertTriangle className="text-3xl" />
                <h3 className="text-lg font-bold">Remove Partner Account</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Are you sure you want to remove <span className="font-semibold text-slate-900 dark:text-white">{customerToDelete?.name}</span>? This action is soft-reversible but hides the customer from all active modules.
              </p>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setIsDeleteOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(customerToDelete.id)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-md transition-colors text-sm"
                >
                  {deleteMutation.isPending ? 'Removing...' : 'Confirm Remove'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
