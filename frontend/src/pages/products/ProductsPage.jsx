import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPackage, FiPlus, FiSearch, FiEdit2, FiTrash2, FiX, FiCheck, FiAlertTriangle, FiTag, FiDollarSign, FiArchive } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import DynamicFormSections from '../../components/common/DynamicFormSections';

import { useCatalogSettings } from '../../hooks/useCatalogSettings';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { catalogMode, isProductOnly, isServiceOnly, isBoth } = useCatalogSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    hsn_code: '',
    gst_rate: 18.00,
    purchase_price: 0,
    selling_price: 0,
    min_stock_level: 5,
    opening_stock: 0,
    description: '',
    is_service: false,
    is_active: true
  });

  // Fetch Products
  const { data: productsResponse, isLoading, error } = useQuery({
    queryKey: ['products', searchTerm],
    queryFn: async () => {
      const response = await apiClient.get('/products', {
        params: { search: searchTerm }
      });
      return response.data;
    }
  });

  const products = productsResponse?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (newProduct) => {
      const response = await apiClient.post('/products', newProduct);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product added successfully!');
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to add product');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put(`/products/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated successfully!');
      setIsEditOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to update product');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.delete(`/products/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted successfully!');
      setIsDeleteOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.errors?.[0] || 'Failed to delete product');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      hsn_code: '',
      gst_rate: 18.00,
      purchase_price: 0,
      selling_price: 0,
      min_stock_level: 5,
      opening_stock: 0,
      description: '',
      is_service: isServiceOnly ? true : false,
      is_active: true
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleOpenEdit = (product) => {
    setProductToEdit(product);
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      hsn_code: product.hsn_code || '',
      gst_rate: product.gst_rate || 18.00,
      purchase_price: product.purchase_price || 0,
      selling_price: product.selling_price || 0,
      min_stock_level: product.min_stock_level || 5,
      opening_stock: product.opening_stock || 0,
      description: product.description || '',
      is_service: Boolean(product.is_service),
      is_active: product.is_active !== false
    });
    setIsEditOpen(true);
  };

  const handleOpenDelete = (product) => {
    setProductToDelete(product);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = (e, mode) => {
    e.preventDefault();
    if (mode === 'add') {
      createMutation.mutate(formData);
    } else if (mode === 'edit') {
      updateMutation.mutate({ id: productToEdit.id, data: formData });
    }
  };

  const [itemTypeFilter, setItemTypeFilter] = useState('all');

  // Filter Logic
  const filteredProducts = products.filter(p => {
    // Item Type Filter
    if (itemTypeFilter === 'products' && p.is_service) return false;
    if (itemTypeFilter === 'services' && !p.is_service) return false;

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
  const totalCount = products.length;
  const activeCount = products.filter(p => p.is_active).length;
  const lowStockCount = products.filter(p => p.current_stock <= p.min_stock_level).length;
  const totalStockValue = products.reduce((sum, p) => sum + (p.current_stock * parseFloat(p.purchase_price || 0)), 0);

  return (
    <div className="space-y-8 pb-12">
      {/* Header section with Premium Indigo-Slate Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Product Catalog</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Track stock levels, pricing, GST compliance structure, and catalog SKU configurations.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleOpenAdd}
            className="flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all animate-fadeIn"
          >
            <FiPlus className="text-lg" />
            <span>Add Product</span>
          </motion.button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: 'Total SKUs', value: totalCount, subtitle: 'Catalog items', icon: FiPackage, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/10' },
          { title: 'Active Items', value: activeCount, subtitle: 'Available for order', icon: FiCheck, color: 'from-emerald-400 to-teal-600', shadow: 'shadow-emerald-500/10' },
          { title: 'Low Stock Alert', value: lowStockCount, subtitle: 'Below threshold limit', icon: FiAlertTriangle, color: 'from-rose-400 to-orange-500', shadow: 'shadow-rose-500/10' },
          { title: 'Stock Valuation', value: `₹${totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtitle: 'Cost price asset value', icon: FiDollarSign, color: 'from-violet-500 to-purple-700', shadow: 'shadow-violet-500/10' }
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
            placeholder="Search product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Catalog Type Filter */}
          <div className="flex items-center space-x-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1 bg-slate-50 dark:bg-slate-800/40">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'products', label: '📦 Products' },
              { id: 'services', label: '⚡ Services' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setItemTypeFilter(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-150 ${
                  itemTypeFilter === item.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

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

      {/* Products Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
            <span className="text-sm text-slate-400">Loading catalog...</span>
          </div>
        ) : error ? (
          <div className="py-20 text-center text-rose-500">
            <FiAlertTriangle className="mx-auto text-4xl mb-3" />
            <p>Failed to load product profiles. Please refresh.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <FiPackage className="mx-auto text-5xl mb-4 text-slate-300 dark:text-slate-700" />
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No products found</p>
            <p className="text-sm text-slate-400 mt-1">Try resetting filters or registering a new item.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <th className="py-4 px-6">Product Details</th>
                  <th className="py-4 px-6">SKU / Code</th>
                  <th className="py-4 px-6">Purchase Price</th>
                  <th className="py-4 px-6">Selling Price</th>
                  <th className="py-4 px-6">GST Rate</th>
                  <th className="py-4 px-6">Stock Status</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {filteredProducts.map((p) => {
                  const isLow = p.current_stock <= p.min_stock_level;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center space-x-2">
                          <span>{p.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${p.is_service ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800' : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800'}`}>
                            {p.is_service ? '⚡ Service' : '📦 Product'}
                          </span>
                        </div>
                        {p.description && <div className="text-xs text-slate-400 font-normal mt-0.5">{p.description}</div>}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {p.sku || 'N/A'}
                      </td>
                      <td className="py-4 px-6 font-semibold">
                        ₹{parseFloat(p.purchase_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 font-semibold text-indigo-600 dark:text-indigo-400">
                        ₹{parseFloat(p.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6">
                        {p.gst_rate}% GST
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-1.5">
                          <span className={`font-bold ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-950 dark:text-slate-100'}`}>
                            {p.current_stock} pcs
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
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">
                  {isServiceOnly ? 'Create New Service' : isProductOnly ? 'Create New Product' : (formData.is_service ? 'Create New Billable Service' : 'Create New Catalog Product')}
                </h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={(e) => handleFormSubmit(e, 'add')} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Item Type Selector - Only visible when Hybrid "Both" mode is configured */}
                {isBoth && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Item Catalog Type:</span>
                    <div className="flex items-center space-x-3">
                      <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${!formData.is_service ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                        <input
                          type="radio"
                          name="add_is_service"
                          checked={!formData.is_service}
                          onChange={() => setFormData({ ...formData, is_service: false })}
                          className="sr-only"
                        />
                        <span>📦 Physical Product</span>
                      </label>
                      <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${formData.is_service ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                        <input
                          type="radio"
                          name="add_is_service"
                          checked={formData.is_service}
                          onChange={() => setFormData({ ...formData, is_service: true })}
                          className="sr-only"
                        />
                        <span>⚡ Billable Service</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      {formData.is_service ? 'Service Name *' : 'Product Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={formData.is_service ? "e.g. Annual Maintenance Contract" : "e.g. Heavy Duty Steel Plate"}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      {formData.is_service ? 'Service Code' : 'SKU / Code'}
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder={formData.is_service ? "e.g. SVC-001" : "e.g. HDSP-001"}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      {formData.is_service ? 'Base Cost / Rate' : 'Purchase Price *'}
                    </label>
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
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      {formData.is_service ? 'Service Charge / Price *' : 'Selling Price *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.selling_price}
                      onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
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
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      {formData.is_service ? 'SAC Code' : 'HSN Code'}
                    </label>
                    <input
                      type="text"
                      value={formData.hsn_code}
                      onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                      placeholder={formData.is_service ? "e.g. 9983" : "e.g. 7326"}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  {/* Stock Fields (Only visible for Physical Products) */}
                  {!formData.is_service && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Minimum Stock Threshold</label>
                        <input
                          type="number"
                          value={formData.min_stock_level}
                          onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Opening Stock Qty</label>
                        <input
                          type="number"
                          value={formData.opening_stock}
                          onChange={(e) => setFormData({ ...formData, opening_stock: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-1.5 flex items-center pt-2">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5"
                    />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Set Catalog Product to Active</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="General dimensions, product material type, specific details..."
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <DynamicFormSections
                  entityType="product"
                  formData={formData}
                  onChange={(key, val) => setFormData((prev) => ({ ...prev, [key]: val }))}
                />

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
                    {createMutation.isPending ? 'Saving...' : 'Add Product'}
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
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">
                  {formData.is_service ? 'Edit Service' : 'Edit Catalog Product'}
                </h3>
                <button
                  onClick={() => setIsEditOpen(false)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={(e) => handleFormSubmit(e, 'edit')} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Item Type Selector - Only visible when Hybrid "Both" mode is configured */}
                {isBoth && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Item Catalog Type:</span>
                    <div className="flex items-center space-x-3">
                      <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${!formData.is_service ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                        <input
                          type="radio"
                          name="edit_is_service"
                          checked={!formData.is_service}
                          onChange={() => setFormData({ ...formData, is_service: false })}
                          className="sr-only"
                        />
                        <span>📦 Physical Product</span>
                      </label>
                      <label className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${formData.is_service ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                        <input
                          type="radio"
                          name="edit_is_service"
                          checked={formData.is_service}
                          onChange={() => setFormData({ ...formData, is_service: true })}
                          className="sr-only"
                        />
                        <span>⚡ Billable Service</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      {formData.is_service ? 'Service Name *' : 'Product Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      {formData.is_service ? 'Service Code' : 'SKU / Code'}
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      {formData.is_service ? 'Base Cost / Rate' : 'Purchase Price *'}
                    </label>
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
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      {formData.is_service ? 'Service Charge / Price *' : 'Selling Price *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.selling_price}
                      onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
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
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      {formData.is_service ? 'SAC Code' : 'HSN Code'}
                    </label>
                    <input
                      type="text"
                      value={formData.hsn_code}
                      onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  {!formData.is_service && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase">Minimum Stock Threshold</label>
                      <input
                        type="number"
                        value={formData.min_stock_level}
                        onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5 flex items-center pt-6">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5"
                      />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {formData.is_service ? 'Active Service' : 'Active Product'}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <DynamicFormSections
                  entityType="product"
                  formData={formData}
                  onChange={(key, val) => setFormData((prev) => ({ ...prev, [key]: val }))}
                />

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
                    {updateMutation.isPending ? 'Saving...' : 'Save Product'}
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
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 z-10 text-center"
            >
              <FiArchive className="mx-auto text-rose-500 text-5xl mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete product profile?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">"{productToDelete?.name}"</span>? This will archive the SKU and soft-delete it from active transactions.
              </p>
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => setIsDeleteOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
                >
                  No, Keep it
                </button>
                <button
                  onClick={() => deleteMutation.mutate(productToDelete.id)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors text-sm font-semibold"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
