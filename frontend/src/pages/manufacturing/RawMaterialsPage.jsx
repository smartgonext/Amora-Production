import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPackage, FiPlus, FiSearch, FiEdit2, FiTrash2, FiX, FiCheck, FiAlertTriangle, FiDollarSign, FiCpu } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

export default function RawMaterialsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState(null);

  // Form State for Raw Materials (No selling_price)
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    hsn_code: '',
    gst_rate: 18.00,
    purchase_price: 0,
    min_stock_level: 5,
    opening_stock: 0,
    description: '',
    is_service: false,
    is_raw_material: true,
    is_active: true
  });

  // Fetch Raw Materials only (?is_raw_material=true)
  const { data: materialsResponse, isLoading, error } = useQuery({
    queryKey: ['raw-materials', searchTerm],
    queryFn: async () => {
      const response = await apiClient.get('/products', {
        params: { search: searchTerm, is_raw_material: 'true' }
      });
      return response.data;
    }
  });

  const materials = materialsResponse?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (newMaterial) => {
      const response = await apiClient.post('/products', newMaterial);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Raw material added successfully!');
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to add raw material');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put(`/products/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Raw material updated successfully!');
      setIsEditOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to update raw material');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.delete(`/products/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast.success('Raw material deleted successfully!');
      setIsDeleteOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to delete raw material');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      hsn_code: '',
      gst_rate: 18.00,
      purchase_price: 0,
      min_stock_level: 5,
      opening_stock: 0,
      description: '',
      is_service: false,
      is_raw_material: true,
      is_active: true
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleOpenEdit = (material) => {
    setMaterialToEdit(material);
    setFormData({
      name: material.name || '',
      sku: material.sku || '',
      hsn_code: material.hsn_code || '',
      gst_rate: material.gst_rate || 18.00,
      purchase_price: material.purchase_price || 0,
      min_stock_level: material.min_stock_level || 5,
      opening_stock: material.opening_stock || 0,
      description: material.description || '',
      is_service: Boolean(material.is_service),
      is_raw_material: true,
      is_active: material.is_active !== false
    });
    setIsEditOpen(true);
  };

  const handleOpenDelete = (material) => {
    setMaterialToDelete(material);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = (e, mode) => {
    e.preventDefault();
    const payload = { ...formData, selling_price: 0 }; // Raw materials have no selling price
    if (mode === 'add') {
      createMutation.mutate(payload);
    } else if (mode === 'edit') {
      updateMutation.mutate({ id: materialToEdit.id, data: payload });
    }
  };

  // Filter Logic
  const filteredMaterials = materials.filter(p => {
    // Status Filter
    if (statusFilter === 'active' && !p.is_active) return false;
    if (statusFilter === 'inactive' && p.is_active) return false;
    
    // Stock Filter
    const isLowStock = p.current_stock <= p.min_stock_level;
    if (stockFilter === 'low' && !isLowStock) return false;
    if (stockFilter === 'out' && p.current_stock > 0) return false;
    
    return true;
  });

  // Calculate Quick Stats
  const totalCount = materials.length;
  const activeCount = materials.filter(p => p.is_active).length;
  const lowStockCount = materials.filter(p => p.current_stock <= p.min_stock_level).length;
  const totalStockValue = materials.reduce((sum, p) => sum + (p.current_stock * parseFloat(p.purchase_price || 0)), 0);

  return (
    <div className="space-y-8 pb-12">
      {/* Header section with Premium Indigo Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <FiCpu className="text-indigo-400" /> Raw Materials Inventory
            </h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Manage input materials, raw ingredients, components, standard purchase costs, and threshold replenishment levels.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleOpenAdd}
            className="flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all animate-fadeIn"
          >
            <FiPlus className="text-lg" />
            <span>Add Raw Material</span>
          </motion.button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: 'Total Raw SKUs', value: totalCount, subtitle: 'Configured components', icon: FiPackage, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/10' },
          { title: 'Active Materials', value: activeCount, subtitle: 'Available for production', icon: FiCheck, color: 'from-emerald-400 to-teal-600', shadow: 'shadow-emerald-500/10' },
          { title: 'Under Replenish Limit', value: lowStockCount, subtitle: 'Needs purchasing', icon: FiAlertTriangle, color: 'from-rose-400 to-orange-500', shadow: 'shadow-rose-500/10' },
          { title: 'Material Asset Value', value: `₹${totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtitle: 'Cost value in warehouse', icon: FiDollarSign, color: 'from-violet-500 to-purple-700', shadow: 'shadow-violet-500/10' }
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
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="relative w-full lg:w-80">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search material name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Status Filter */}
          <div className="flex items-center space-x-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
            {['all', 'active', 'inactive'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-150 ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Stock Filter */}
          <div className="flex items-center space-x-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
            {['all', 'low', 'out'].map((stock) => (
              <button
                key={stock}
                onClick={() => setStockFilter(stock)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-150 ${
                  stockFilter === stock
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {stock === 'all' ? 'All Stock' : stock === 'low' ? 'Low Stock' : 'Out of Stock'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Materials Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
            <span className="text-sm text-slate-400">Loading raw materials...</span>
          </div>
        ) : error ? (
          <div className="py-20 text-center text-rose-500">
            <FiAlertTriangle className="mx-auto text-4xl mb-3" />
            <p>Failed to load raw materials. Please refresh.</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <FiPackage className="mx-auto text-5xl mb-4 text-slate-300 dark:text-slate-700" />
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No raw materials found</p>
            <p className="text-sm text-slate-400 mt-1">Add a new component or verify your configuration.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Material Details</th>
                  <th className="py-4 px-6">SKU / Code</th>
                  <th className="py-4 px-6">Purchase Cost</th>
                  <th className="py-4 px-6">GST Rate</th>
                  <th className="py-4 px-6">Current Stock</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {filteredMaterials.map((p) => {
                  const isLow = p.current_stock <= p.min_stock_level;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">
                        <span>{p.name}</span>
                        {p.description && <div className="text-xs text-slate-400 font-normal mt-0.5">{p.description}</div>}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {p.sku || 'N/A'}
                      </td>
                      <td className="py-4 px-6 font-semibold">
                        ₹{parseFloat(p.purchase_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6">
                        {p.gst_rate}% GST
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-1.5">
                          <span className={`font-bold ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-950 dark:text-slate-100'}`}>
                            {p.current_stock}
                          </span>
                          {isLow && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                              <FiAlertTriangle className="mr-0.5" /> Low
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${p.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Edit"
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(p)}
                            title="Delete"
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Create New Raw Material Component</h3>
                <button onClick={() => setIsAddOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><FiX /></button>
              </div>

              <form onSubmit={(e) => handleFormSubmit(e, 'add')} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Material Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Steel Pipe 50mm"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Material SKU / Code</label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g. RM-STL-50"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Standard Purchase Cost *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">GST Rate (%)</label>
                    <select
                      value={formData.gst_rate}
                      onChange={(e) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={0}>0% GST</option>
                      <option value={5}>5% GST</option>
                      <option value={12}>12% GST</option>
                      <option value={18}>18% GST</option>
                      <option value={28}>28% GST</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">HSN Code</label>
                    <input
                      type="text"
                      value={formData.hsn_code}
                      onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                      placeholder="e.g. 7217"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Minimum Replenish Stock</label>
                    <input
                      type="number"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Description / Specifications</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Material grades, dimensional specifications, tolerances..."
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                  <button type="submit" disabled={createMutation.isPending} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-colors text-sm font-semibold">{createMutation.isPending ? 'Saving...' : 'Add Material'}</button>
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
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Edit Raw Material Component</h3>
                <button onClick={() => setIsEditOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><FiX /></button>
              </div>

              <form onSubmit={(e) => handleFormSubmit(e, 'edit')} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Material Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Material SKU / Code</label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Standard Purchase Cost *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">GST Rate (%)</label>
                    <select
                      value={formData.gst_rate}
                      onChange={(e) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={0}>0% GST</option>
                      <option value={5}>5% GST</option>
                      <option value={12}>12% GST</option>
                      <option value={18}>18% GST</option>
                      <option value={28}>28% GST</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">HSN Code</label>
                    <input
                      type="text"
                      value={formData.hsn_code}
                      onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Minimum Replenish Stock</label>
                    <input
                      type="number"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 flex items-center pt-2">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5"
                    />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Set Material to Active</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Description / Specifications</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50 dark:bg-slate-800/40 -mx-6 -mb-6">
                  <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                  <button type="submit" disabled={updateMutation.isPending} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-colors text-sm font-semibold">{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
