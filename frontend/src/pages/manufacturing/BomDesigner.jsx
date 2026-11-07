import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPackage, FiPlus, FiX, FiEdit2, FiTrash2, FiCheckCircle,
  FiRefreshCw, FiLayers, FiDollarSign, FiActivity, FiTruck, FiList,
  FiZap, FiCopy, FiAlertTriangle
} from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

const EMPTY_ITEM = { item_id: '', qty_required: 1, uom: 'Pcs', waste_pct: 0, is_alternate: false, parent_bom_item_id: '' };
const EMPTY_OP = { operation_sequence: '', operation_name: '', work_center_id: '', machine_id: '', setup_time_mins: 0, processing_time_per_unit_mins: 0, labor_hours_per_unit: 0 };
const EMPTY_BP = { item_id: '', type: 'by_product', qty_expected: 0, uom: '' };

const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  deprecated: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-5xl' : 'max-w-3xl'} my-8`}
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
              <FiX className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const inputCls = "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition";
const btnGhost = "inline-flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm rounded-lg transition";

function ErrorState({ error }) {
  return <p className="text-sm text-red-500">{error?.response?.data?.errors?.[0] || 'Failed to load data'}</p>;
}

function Loading() {
  return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto" />;
}

export default function BomDesigner() {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState('');
  const [bomFilter, setBomFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editBom, setEditBom] = useState(null);
  const [bomToDelete, setBomToDelete] = useState(null);
  const [viewBom, setViewBom] = useState(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const { data: productsRes, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: async () => (await apiClient.get('/products')).data,
  });
  const products = productsRes?.data || [];

  const { data: bomsRes, isLoading: bomsLoading, error: bomsError } = useQuery({
    queryKey: ['boms', selectedProduct, bomFilter],
    queryFn: async () => {
      const params = {};
      if (selectedProduct) params.product_id = selectedProduct;
      if (bomFilter !== 'all') params.status = bomFilter;
      return (await apiClient.get('/manufacturing/boms', { params })).data;
    },
    enabled: true,
  });
  const boms = bomsRes?.data || [];

  const { data: wcRes } = useQuery({
    queryKey: ['work-centers'],
    queryFn: async () => (await apiClient.get('/manufacturing/work-centers')).data,
  });
  const workCenters = wcRes?.data || [];

  const { data: machinesRes } = useQuery({
    queryKey: ['machines'],
    queryFn: async () => (await apiClient.get('/manufacturing/machines')).data,
  });
  const machines = machinesRes?.data || [];

  const activateMutation = useMutation({
    mutationFn: (id) => apiClient.post(`/manufacturing/boms/${id}/activate`),
    onSuccess: (res) => {
      toast.success('BOM activated');
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      queryClient.invalidateQueries({ queryKey: ['bom-detail'] });
      if (res?.data?.data) {
        setViewBom(res.data.data);
      }
    },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed to activate'),
  });

  const reviseMutation = useMutation({
    mutationFn: (id) => apiClient.post(`/manufacturing/boms/${id}/revise`, {}),
    onSuccess: (res) => {
      toast.success('New revision created');
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      setViewBom(res.data.data);
      setIsViewOpen(true);
    },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed to revise'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/manufacturing/boms/${id}`),
    onSuccess: () => {
      toast.success('BOM deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      setBomToDelete(null);
    },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed to delete'),
  });

  const openProduct = (id) => setSelectedProduct(id);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FiLayers className="w-6 h-6 text-indigo-600" /> BOM & Routing Designer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Design multi-level BOMs, routings and costs.</p>
        </div>
        <button
          className={btnPrimary}
          onClick={() => {
            setEditBom(null);
            setViewBom(null);
            setIsCreateOpen(true);
          }}
        >
          <FiPlus className="w-4 h-4" /> New BOM
        </button>
      </div>

      {/** Product selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Finished / Semi-finished Product</label>
        {productsLoading ? <Loading /> : (
          <select className={inputCls} value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
            <option value="">Select a product...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku || 'no-sku'})</option>)}
          </select>
        )}
        <div className="flex items-center gap-2 mt-3">
          <button className={btnGhost} onClick={() => setBomFilter('all')}>All</button>
          <button className={btnGhost} onClick={() => setBomFilter('active')}>Active</button>
          <button className={btnGhost} onClick={() => setBomFilter('draft')}>Draft</button>
          <button className={btnGhost} onClick={() => setBomFilter('deprecated')}>Deprecated</button>
        </div>
      </div>

      {/** BOM list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800 dark:text-white">Bill of Materials</h2>
          <span className="text-xs text-slate-400">{boms.length} record(s)</span>
        </div>
        {bomsLoading ? <Loading /> : bomsError ? <ErrorState error={bomsError} /> :
          boms.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No BOMs found. Select a product and create one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase border-b dark:border-slate-700">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Batch Yield</th>
                    <th className="py-2 pr-4">Version</th>
                    <th className="py-2 pr-4">Revision</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Std Cost</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {boms.map((b) => (
                    <tr key={b.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 pr-4 font-medium text-slate-800 dark:text-white">{b.name}</td>
                      <td className="py-2 pr-4 font-bold text-indigo-600 dark:text-indigo-400">
                        {b.base_quantity || 1} {products.find((p) => p.id === b.product_id)?.unit_of_measure || 'Units'}
                      </td>
                      <td className="py-2 pr-4">{b.version}</td>
                      <td className="py-2 pr-4">{b.revision_no || 0}</td>
                      <td className="py-2 pr-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_STYLES[b.status] || STATUS_STYLES.draft}`}>{b.status}</span></td>
                      <td className="py-2 pr-4">₹{Number(b.standard_cost || 0).toFixed(2)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <button
                            title="View Formula & Details"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition"
                            onClick={() => { setViewBom(b); setIsViewOpen(true); }}
                          >
                            <FiList className="w-4 h-4" />
                          </button>
                          <button
                            title="Edit Recipe (In-place)"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition"
                            onClick={() => {
                              setEditBom(b);
                            }}
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            title="Revise (Create New Version)"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                            onClick={() => reviseMutation.mutate(b.id)}
                          >
                            <FiRefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            title="Activate Recipe"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition disabled:opacity-30 disabled:pointer-events-none"
                            disabled={b.status === 'active'}
                            onClick={() => activateMutation.mutate(b.id)}
                          >
                            <FiCheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            title="Delete Recipe"
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                            onClick={() => setBomToDelete(b)}
                          >
                            <FiTrash2 className="w-4 h-4" />
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

      <CreateBomModal
        open={isCreateOpen || !!editBom}
        onClose={() => {
          setIsCreateOpen(false);
          setEditBom(null);
        }}
        bomToEdit={editBom}
        productId={selectedProduct}
        products={products}
        workCenters={workCenters}
        machines={machines}
        boms={boms}
      />

      <ViewBomModal
        open={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        bom={viewBom}
        workCenters={workCenters}
        machines={machines}
        products={products}
        onEdit={(b) => {
          setIsViewOpen(false);
          setEditBom(b);
        }}
        onRevise={(id) => reviseMutation.mutate(id)}
        onActivate={(id) => activateMutation.mutate(id)}
      />

      {/* Delete Confirmation Warning Modal */}
      {bomToDelete && (
        <Modal
          open={!!bomToDelete}
          onClose={() => setBomToDelete(null)}
          title="Confirm Delete Bill of Materials / Recipe"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-red-800 dark:text-red-300">
              <FiAlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Delete Recipe Formulation?</p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                  Are you sure you want to delete <strong>&quot;{bomToDelete.name}&quot;</strong> (Version: {bomToDelete.version}, Batch Yield: {bomToDelete.base_quantity || 1} {products.find((p) => p.id === bomToDelete.product_id)?.unit_of_measure || 'Units'})?
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  This action cannot be undone. All raw materials and routing steps associated with this formulation will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setBomToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition shadow"
                disabled={deleteMutation.isLoading}
                onClick={() => {
                  deleteMutation.mutate(bomToDelete.id);
                }}
              >
                <FiTrash2 className="w-4 h-4" />
                {deleteMutation.isLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateBomModal({ open, onClose, productId, products, workCenters, machines, boms = [], bomToEdit = null }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    product_id: productId || '',
    name: '', version: 'V1.0', status: 'draft', standard_cost: 0, overhead_cost: 0,
    total_setup_time_mins: 0, notes: '',
    base_quantity: 1,
    items: [{ ...EMPTY_ITEM }],
    routing_operations: [{ ...EMPTY_OP }],
    byproducts: [],
  });

  const baselineRef = useRef(null);

  useEffect(() => {
    if (bomToEdit) {
      const editYield = Number(bomToEdit.base_quantity) || 1;
      const editItems = (bomToEdit.items && bomToEdit.items.length > 0)
        ? bomToEdit.items.map((it) => ({
            item_id: String(it.item_id),
            qty_required: it.qty_required,
            uom: it.uom,
            waste_pct: it.waste_pct,
            is_alternate: !!it.is_alternate,
            parent_bom_item_id: it.parent_bom_item_id || '',
          }))
        : [{ ...EMPTY_ITEM }];

      const editOps = (bomToEdit.routing_operations && bomToEdit.routing_operations.length > 0)
        ? bomToEdit.routing_operations.map((op) => ({
            operation_sequence: op.operation_sequence,
            operation_name: op.operation_name,
            work_center_id: op.work_center_id ? String(op.work_center_id) : '',
            machine_id: op.machine_id ? String(op.machine_id) : '',
            setup_time_mins: op.setup_time_mins,
            processing_time_per_unit_mins: op.processing_time_per_unit_mins,
            labor_hours_per_unit: op.labor_hours_per_unit,
          }))
        : [{ ...EMPTY_OP }];

      const editBps = (bomToEdit.byproducts || []).map((bp) => ({
        item_id: String(bp.item_id),
        type: bp.type,
        qty_expected: bp.qty_expected,
        uom: bp.uom || '',
      }));

      setForm({
        product_id: String(bomToEdit.product_id || ''),
        name: bomToEdit.name || '',
        version: bomToEdit.version || 'V1.0',
        status: bomToEdit.status || 'draft',
        base_quantity: editYield,
        standard_cost: bomToEdit.standard_cost || 0,
        overhead_cost: bomToEdit.overhead_cost || 0,
        total_setup_time_mins: bomToEdit.total_setup_time_mins || 0,
        notes: bomToEdit.notes || '',
        items: editItems,
        routing_operations: editOps,
        byproducts: editBps,
      });

      baselineRef.current = {
        yield: editYield,
        items: JSON.parse(JSON.stringify(editItems)),
      };
    } else if (open) {
      setForm({
        product_id: productId || '',
        name: '', version: 'V1.0', status: 'draft', standard_cost: 0, overhead_cost: 0,
        total_setup_time_mins: 0, notes: '',
        base_quantity: 1,
        items: [{ ...EMPTY_ITEM }],
        routing_operations: [{ ...EMPTY_OP }],
        byproducts: [],
      });
      baselineRef.current = null;
    }
  }, [bomToEdit, productId, open]);

  const mutation = useMutation({
    mutationFn: (payload) =>
      bomToEdit
        ? apiClient.put(`/manufacturing/boms/${bomToEdit.id}`, payload)
        : apiClient.post('/manufacturing/boms', payload),
    onSuccess: () => {
      toast.success(bomToEdit ? 'Recipe updated successfully' : 'BOM created');
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      queryClient.invalidateQueries({ queryKey: ['bom-detail'] });
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed to save BOM'),
  });

  const setItems = (cb) => {
    setForm((f) => {
      const newItems = cb(f.items);
      baselineRef.current = {
        yield: parseFloat(f.base_quantity) || 1,
        items: JSON.parse(JSON.stringify(newItems)),
      };
      return { ...f, items: newItems };
    });
  };
  const setOps = (cb) => setForm((f) => ({ ...f, routing_operations: cb(f.routing_operations) }));
  const setBps = (cb) => setForm((f) => ({ ...f, byproducts: cb(f.byproducts) }));

  const [autoScale, setAutoScale] = useState(true);

  // 1-Click Clone from Existing Database BOM
  const handleCloneBom = (cloneId) => {
    if (!cloneId) return;
    const source = boms.find((b) => b.id === Number(cloneId));
    if (!source) return;
    const clonedYield = Number(source.base_quantity) || 1;
    const clonedItems = (source.items || []).map((it) => ({
      item_id: String(it.item_id),
      qty_required: it.qty_required,
      uom: it.uom,
      waste_pct: it.waste_pct,
      is_alternate: it.is_alternate,
      parent_bom_item_id: it.parent_bom_item_id || '',
    }));

    baselineRef.current = {
      yield: clonedYield,
      items: JSON.parse(JSON.stringify(clonedItems)),
    };

    setForm((f) => ({
      ...f,
      product_id: String(source.product_id || f.product_id),
      base_quantity: clonedYield,
      name: `${source.name} (Copy)`,
      standard_cost: source.standard_cost,
      overhead_cost: source.overhead_cost,
      total_setup_time_mins: source.total_setup_time_mins,
      items: clonedItems,
      routing_operations: (source.routing_operations || []).map((op) => ({
        operation_sequence: op.operation_sequence,
        operation_name: op.operation_name,
        work_center_id: op.work_center_id || '',
        machine_id: op.machine_id || '',
        setup_time_mins: op.setup_time_mins,
        processing_time_per_unit_mins: op.processing_time_per_unit_mins,
        labor_hours_per_unit: op.labor_hours_per_unit,
      })),
    }));
    toast.success(`Loaded "${source.name}" (Yield: ${clonedYield} units)`);
  };

  // Auto-adjust all raw material quantities for ANY typed yield (e.g. 1000, 650, 250, 97, 95...)
  const handleYieldChange = (newYieldStr) => {
    setForm((f) => {
      const newQty = parseFloat(newYieldStr);

      if (!autoScale || isNaN(newQty) || newQty <= 0) {
        return { ...f, base_quantity: newYieldStr };
      }

      // Initialize baseline from current items if not set
      if (!baselineRef.current || !baselineRef.current.yield || baselineRef.current.yield <= 0) {
        baselineRef.current = {
          yield: parseFloat(f.base_quantity) || 1,
          items: JSON.parse(JSON.stringify(f.items || [])),
        };
      }

      const baseYield = baselineRef.current.yield;
      const ratio = newQty / baseYield;
      const baseItems = baselineRef.current.items || [];

      const scaledItems = (f.items || []).map((it, idx) => {
        const baseItem = baseItems[idx];
        const baseVal =
          baseItem && baseItem.item_id === it.item_id
            ? parseFloat(baseItem.qty_required) || 0
            : parseFloat(it.qty_required) || 0;

        const updatedVal = Math.round(baseVal * ratio * 1000) / 1000;
        return { ...it, qty_required: updatedVal };
      });

      return {
        ...f,
        base_quantity: newYieldStr,
        items: scaledItems,
      };
    });
  };

  const selectedProd = products.find((p) => String(p.id) === String(form.product_id));
  const outputUom = selectedProd?.unit_of_measure || selectedProd?.uom || 'Units';

  const resetForm = () => {
    setForm({
      product_id: '',
      name: '',
      version: 'V1.0',
      status: 'active',
      base_quantity: 1,
      standard_cost: 0,
      overhead_cost: 0,
      total_setup_time_mins: 0,
      notes: '',
      items: [{ ...EMPTY_ITEM }],
      routing_operations: [{ ...EMPTY_OP }],
      byproducts: [],
    });
  };

  const submit = () => {
    const payload = {
      ...form,
      product_id: Number(form.product_id),
      base_quantity: Number(form.base_quantity || 1),
      standard_cost: Number(form.standard_cost || 0),
      overhead_cost: Number(form.overhead_cost || 0),
      total_setup_time_mins: Number(form.total_setup_time_mins || 0),
      items: form.items.map((i) => ({
        item_id: Number(i.item_id),
        qty_required: Number(i.qty_required || 1),
        uom: i.uom || 'Pcs',
        waste_pct: Number(i.waste_pct || 0),
        is_alternate: !!i.is_alternate,
        parent_bom_item_id: i.parent_bom_item_id ? Number(i.parent_bom_item_id) : null,
      })).filter((i) => i.item_id),
      routing_operations: form.routing_operations
        .filter((op) => op.operation_name)
        .map((op) => ({
          operation_sequence: op.operation_sequence ? Number(op.operation_sequence) : 10,
          operation_name: op.operation_name,
          work_center_id: op.work_center_id ? Number(op.work_center_id) : null,
          machine_id: op.machine_id ? Number(op.machine_id) : null,
          setup_time_mins: Number(op.setup_time_mins || 0),
          processing_time_per_unit_mins: Number(op.processing_time_per_unit_mins || 0),
          labor_hours_per_unit: Number(op.labor_hours_per_unit || 0),
        })),
      byproducts: form.byproducts.filter((b) => b.item_id).map((b) => ({
        item_id: Number(b.item_id),
        type: b.type,
        qty_expected: Number(b.qty_expected || 0),
        uom: b.uom || '',
      })),
    };
    mutation.mutate(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bomToEdit ? `Edit Bill of Materials / Recipe: ${bomToEdit.name} (${bomToEdit.version})` : "New Bill of Materials / Recipe (One-Time Setup)"}
      wide
    >
      <div className="space-y-5">
        {/* Helper Bar: Template copy from real saved recipes */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <FiZap className="text-amber-500 w-4 h-4 flex-shrink-0" />
            <span className="font-bold text-slate-800 dark:text-white">One-Time Setup:</span>
            <span className="text-slate-600 dark:text-slate-400">
              Create and save your custom recipes. Once saved, they appear as 1-click batch buttons across production.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {boms.length > 0 && (
              <select
                className="text-xs px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 font-semibold"
                defaultValue=""
                onChange={(e) => { if (e.target.value) handleCloneBom(e.target.value); }}
              >
                <option value="" disabled>📋 Duplicate from Saved Recipe...</option>
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>
                    Copy from: {b.name} (v{b.version})
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={resetForm}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-lg transition"
            >
              Reset / Blank
            </button>
          </div>
        </div>

        {/* Top Form Fields with Batch Output Quantity & Live Scaling */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <label className="text-xs font-semibold uppercase text-slate-500 block mb-1">
              Finished Product
            </label>
            <select
              className={inputCls}
              value={form.product_id}
              onChange={(e) => {
                const pid = e.target.value;
                const prod = products.find((p) => String(p.id) === String(pid));
                setForm((f) => ({
                  ...f,
                  product_id: pid,
                  name: f.name ? f.name : prod ? `Commercial Batch Formula - ${prod.name}` : '',
                }));
              }}
            >
              <option value="">Select a finished product...</option>
              {products.filter((p) => !p.is_raw_material).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku || 'no-sku'})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <span>Recipe Output Yield</span>
                <span className="text-[10px] text-slate-400 font-normal">({outputUom})</span>
              </label>
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScale}
                  onChange={(e) => setAutoScale(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                />
                Auto-scale items
              </label>
            </div>
            <div className="relative mb-1.5">
              <input
                type="number"
                min="0.01"
                step="any"
                className={`${inputCls} font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800 pr-14`}
                value={form.base_quantity || ''}
                placeholder="e.g. 100 or 200"
                onChange={(e) => handleYieldChange(e.target.value)}
              />
              <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-500 pointer-events-none">
                {outputUom}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Type any batch yield (e.g. 1000, 650, 250, 97, 95). All raw materials adjust automatically.
            </p>
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-semibold uppercase text-slate-500 block mb-1">
              BOM / Recipe Name
            </label>
            <input
              className={inputCls}
              value={form.name}
              placeholder="e.g. Standard Recipe"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs font-semibold uppercase text-slate-500 block mb-1">
              Version
            </label>
            <input
              className={inputCls}
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
            />
          </div>
        </div>

        {/* Output Yield Explanatory Banner */}
        {form.product_id && (
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
            <div className="flex items-center gap-2">
              <FiCheckCircle className="text-indigo-600 dark:text-indigo-400 w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Output Yield:</strong> This recipe formulation produces{' '}
                <strong className="text-indigo-600 dark:text-indigo-300 font-black">
                  {form.base_quantity || 1} {outputUom}
                </strong>{' '}
                of <em>{selectedProd?.name}</em> from the raw materials listed below.
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
              Work Orders will scale proportionally to this yield.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Status</label>
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active (Ready for Production)</option>
              <option value="draft">Draft</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Standard Cost (₹)</label>
            <input type="number" className={inputCls} value={form.standard_cost} onChange={(e) => setForm({ ...form, standard_cost: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Overhead Cost (₹)</label>
            <input type="number" className={inputCls} value={form.overhead_cost} onChange={(e) => setForm({ ...form, overhead_cost: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Total Setup (min)</label>
            <input type="number" className={inputCls} value={form.total_setup_time_mins} onChange={(e) => setForm({ ...form, total_setup_time_mins: e.target.value })} />
          </div>
        </div>

        {/** Components (multi-level via parent ref) */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>Recipe Components (Raw Materials)</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  Yield: {form.base_quantity || 1} {outputUom}
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Enter the exact ingredient quantities needed to produce <strong>{form.base_quantity || 1} {outputUom}</strong>. Daily batches will auto-scale proportionally.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setItems((arr) => [...arr, { ...EMPTY_ITEM }])}
              >
                <FiPlus className="w-3 h-3" /> Add Item
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => setItems((arr) => [...arr, { ...EMPTY_ITEM }, { ...EMPTY_ITEM }, { ...EMPTY_ITEM }])}
              >
                <FiPlus className="w-3 h-3" /> +3 Items
              </button>
            </div>
          </div>
          {form.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
              <div className="col-span-4">
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5 block">Raw Material</label>
                <select
                  className={inputCls}
                  value={item.item_id}
                  onChange={(e) => {
                    const rawId = e.target.value;
                    const rawProd = products.find((p) => String(p.id) === String(rawId));
                    setItems((a) =>
                      a.map((it, i) =>
                        i === idx
                          ? {
                              ...it,
                              item_id: rawId,
                              uom: rawProd?.unit_of_measure || rawProd?.uom || it.uom || 'Kg',
                            }
                          : it
                      )
                    );
                  }}
                >
                  <option value="">Select Raw Material...</option>
                  {products.filter((p) => p.is_raw_material).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5 block">Parent Ref</label>
                <input
                  className={inputCls}
                  placeholder="Optional"
                  value={item.parent_bom_item_id}
                  onChange={(e) => setItems((a) => a.map((it, i) => (i === idx ? { ...it, parent_bom_item_id: e.target.value } : it)))}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5 block">
                  Qty for {form.base_quantity || 1} {outputUom}
                </label>
                <input
                  className={`${inputCls} font-bold`}
                  placeholder={`Qty for ${form.base_quantity || 1}`}
                  type="number"
                  step="any"
                  value={item.qty_required}
                  onChange={(e) => setItems((a) => a.map((it, i) => (i === idx ? { ...it, qty_required: e.target.value } : it)))}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5 block">UOM</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Kg, Ltr"
                  value={item.uom}
                  onChange={(e) => setItems((a) => a.map((it, i) => (i === idx ? { ...it, uom: e.target.value } : it)))}
                />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5 block">Waste %</label>
                <input
                  className={inputCls}
                  placeholder="0"
                  type="number"
                  step="any"
                  value={item.waste_pct}
                  onChange={(e) => setItems((a) => a.map((it, i) => (i === idx ? { ...it, waste_pct: e.target.value } : it)))}
                />
              </div>
              <div className="col-span-1 flex items-center gap-2">
                <button
                  type="button"
                  title="Remove Ingredient"
                  className="text-red-500 hover:text-red-700 p-2"
                  onClick={() => setItems((a) => a.filter((_, i) => i !== idx))}
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/** Routing grid */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-slate-700 dark:text-white">Routing Operations (sequenced)</h4>
            <button className={btnGhost} onClick={() => setOps((arr) => [...arr, { ...EMPTY_OP }])}><FiPlus className="w-3 h-3" /> Add</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 uppercase">
                <th className="py-1 pr-2">Seq</th><th className="py-1 pr-2">Operation</th><th className="py-1 pr-2">Work Center</th><th className="py-1 pr-2">Machine</th><th className="py-1 pr-2">Setup(min)</th><th className="py-1 pr-2">Process/unit</th><th className="py-1 pr-2">Labor hrs</th><th></th>
              </tr></thead>
              <tbody>{form.routing_operations.map((op, idx) => (
                <tr key={idx}>
                  <td className="py-1 pr-2"><input className={inputCls} value={op.operation_sequence} onChange={(e) => setOps((a) => a.map((o, i) => i === idx ? { ...o, operation_sequence: e.target.value } : o))} /></td>
                  <td className="py-1 pr-2"><input className={inputCls} value={op.operation_name} onChange={(e) => setOps((a) => a.map((o, i) => i === idx ? { ...o, operation_name: e.target.value } : o))} /></td>
                  <td className="py-1 pr-2"><select className={inputCls} value={op.work_center_id} onChange={(e) => setOps((a) => a.map((o, i) => i === idx ? { ...o, work_center_id: e.target.value } : o))}><option value="">--</option>{workCenters.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></td>
                  <td className="py-1 pr-2"><select className={inputCls} value={op.machine_id} onChange={(e) => setOps((a) => a.map((o, i) => i === idx ? { ...o, machine_id: e.target.value } : o))}><option value="">--</option>{machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></td>
                  <td className="py-1 pr-2"><input type="number" className={inputCls} value={op.setup_time_mins} onChange={(e) => setOps((a) => a.map((o, i) => i === idx ? { ...o, setup_time_mins: e.target.value } : o))} /></td>
                  <td className="py-1 pr-2"><input type="number" className={inputCls} value={op.processing_time_per_unit_mins} onChange={(e) => setOps((a) => a.map((o, i) => i === idx ? { ...o, processing_time_per_unit_mins: e.target.value } : o))} /></td>
                  <td className="py-1 pr-2"><input type="number" className={inputCls} value={op.labor_hours_per_unit} onChange={(e) => setOps((a) => a.map((o, i) => i === idx ? { ...o, labor_hours_per_unit: e.target.value } : o))} /></td>
                  <td><button className="text-red-500" onClick={() => setOps((a) => a.filter((_, i) => i !== idx))}><FiTrash2 /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        {/** Byproducts / co-products / scrap */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-slate-700 dark:text-white">Co-products / By-products / Scrap</h4>
            <button className={btnGhost} onClick={() => setBps((arr) => [...arr, { ...EMPTY_BP }])}><FiPlus className="w-3 h-3" /> Add</button>
          </div>
          {form.byproducts.map((bp, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
              <div className="col-span-5"><select className={inputCls} value={bp.item_id} onChange={(e) => setBps((a) => a.map((b, i) => i === idx ? { ...b, item_id: e.target.value } : b))}><option value="">Item...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="col-span-3"><select className={inputCls} value={bp.type} onChange={(e) => setBps((a) => a.map((b, i) => i === idx ? { ...b, type: e.target.value } : b))}><option value="by_product">By-product</option><option value="co_product">Co-product</option><option value="scrap">Scrap</option></select></div>
              <div className="col-span-2"><input className={inputCls} type="number" placeholder="Qty" value={bp.qty_expected} onChange={(e) => setBps((a) => a.map((b, i) => i === idx ? { ...b, qty_expected: e.target.value } : b))} /></div>
              <div className="col-span-1"><input className={inputCls} placeholder="UOM" value={bp.uom} onChange={(e) => setBps((a) => a.map((b, i) => i === idx ? { ...b, uom: e.target.value } : b))} /></div>
              <div className="col-span-1"><button className="text-red-500" onClick={() => setBps((a) => a.filter((_, i) => i !== idx))}><FiTrash2 /></button></div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={submit} disabled={!form.name || !form.product_id || mutation.isLoading}>
            {mutation.isLoading ? <Loading /> : bomToEdit ? 'Update Recipe' : 'Save BOM'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ViewBomModal({ open, onClose, bom, workCenters, machines, products, onEdit, onRevise, onActivate }) {
  const { data: res, isLoading } = useQuery({
    queryKey: ['bom-detail', bom?.id],
    queryFn: async () => (await apiClient.get(`/manufacturing/boms/${bom.id}`)).data,
    enabled: !!bom && open,
  });

  const detail = res?.data;
  const items = detail?.items || [];
  const ops = detail?.routing_operations || [];
  const bps = detail?.byproducts || [];
  const cost = detail?.cost_breakup;

  const productObj = products.find((x) => x.id === Number(detail?.product_id));
  const productUom = productObj?.unit_of_measure || productObj?.uom || 'Units';
  const nameOf = (id) => { const p = products.find((x) => x.id === Number(id)); return p ? p.name : `#${id}`; };
  const wcOf = (id) => { const w = workCenters.find((x) => x.id === Number(id)); return w ? w.name : '-'; };
  const mOf = (id) => { const m = machines.find((x) => x.id === Number(id)); return m ? m.name : '-'; };

  const renderTree = (itemsArr, level) =>
    itemsArr.map((it) => {
      const children = items.filter((x) => x.parent_bom_item_id && Number(x.parent_bom_item_id) === Number(it.id));
      return (
        <div key={it.id}>
          <div className="flex items-center gap-2 text-sm py-1" style={{ paddingLeft: level * 20 }}>
            <span className="text-slate-400">{level === 0 ? '└' : '·'}</span>
            <span className="font-medium">{nameOf(it.item_id)}</span>
            <span className="text-slate-400 text-xs">x{Number(it.qty_required)}</span>
            <span className="text-slate-400 text-xs">{it.uom}</span>
            {Number(it.waste_pct) > 0 && <span className="text-amber-500 text-xs">+{it.waste_pct}% waste</span>}
            {it.is_alternate && <span className="text-indigo-500 text-xs font-semibold">alternative</span>}
          </div>
          {children.length > 0 && renderTree(children, level + 1)}
        </div>
      );
    });

  return (
    <Modal open={open} onClose={onClose} title={bom?.name ? `${bom.name} — ${bom.version}` : 'BOM Detail'} wide>
      {isLoading || !detail ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Product</span>
              <p className="font-semibold text-slate-800 dark:text-white truncate">{nameOf(detail.product_id)}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Batch Yield</span>
              <p className="font-bold text-indigo-600 dark:text-indigo-400">
                {detail.base_quantity || 1} {productUom}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Version / Rev</span>
              <p className="font-semibold text-slate-800 dark:text-white">{detail.version} / #{detail.revision_no || 0}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold block mb-1">Status</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${STATUS_STYLES[detail.status] || STATUS_STYLES.draft}`}>
                {detail.status}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Std Cost</span>
              <p className="font-semibold text-slate-800 dark:text-white">₹{Number(detail.standard_cost || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-bold text-slate-700 dark:text-white mb-2 flex items-center gap-2"><FiLayers /> Component Tree</h4>
            {items.length === 0 ? <p className="text-sm text-slate-400">No components</p> :
              <div className="font-mono">{renderTree(items.filter((x) => !x.parent_bom_item_id), 0)}</div>}
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-bold text-slate-700 dark:text-white mb-2 flex items-center gap-2"><FiActivity /> Routing</h4>
            {ops.length === 0 ? <p className="text-sm text-slate-400">No routing operations</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 uppercase border-b dark:border-slate-700">
                  <th className="py-1 pr-2">Seq</th><th className="py-1 pr-2">Operation</th><th className="py-1 pr-2">Work Center</th><th className="py-1 pr-2">Machine</th><th className="py-1 pr-2">Setup</th><th className="py-1 pr-2">Proc/unit</th><th className="py-1 pr-2">Labor</th>
                </tr></thead>
                <tbody>{ops.map((op) => (
                  <tr key={op.id} className="border-b dark:border-slate-800">
                    <td className="py-1 pr-2">{op.operation_sequence}</td><td className="py-1 pr-2 font-medium">{op.operation_name}</td>
                    <td className="py-1 pr-2">{wcOf(op.work_center_id)}</td><td className="py-1 pr-2">{mOf(op.machine_id)}</td>
                    <td className="py-1 pr-2">{op.setup_time_mins}</td><td className="py-1 pr-2">{op.processing_time_per_unit_mins}</td><td className="py-1 pr-2">{op.labor_hours_per_unit}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>

          {bps.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <h4 className="text-sm font-bold text-slate-700 dark:text-white mb-2 flex items-center gap-2"><FiTruck /> Co / By-products & Scrap</h4>
              {bps.map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-sm py-1">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{b.type}</span>
                  <span className="font-medium">{nameOf(b.item_id)}</span><span className="text-slate-400">x{b.qty_expected} {b.uom}</span>
                </div>
              ))}
            </div>
          )}

          {cost && (
            <div className="border border-indigo-200 dark:border-indigo-900 rounded-lg p-4 bg-indigo-50 dark:bg-indigo-900/20">
              <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-2"><FiDollarSign /> Cost Calculation Preview</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div><span className="text-slate-400">Material</span><p className="font-semibold">{Number(cost.material_cost || 0).toFixed(2)}</p></div>
                <div><span className="text-slate-400">Labour</span><p className="font-semibold">{Number(cost.labor_cost || 0).toFixed(2)}</p></div>
                <div><span className="text-slate-400">Machine</span><p className="font-semibold">{Number(cost.machine_cost || 0).toFixed(2)}</p></div>
                <div><span className="text-slate-400">Overhead</span><p className="font-semibold">{Number(cost.overhead_cost || 0).toFixed(2)}</p></div>
                <div><span className="text-slate-600 dark:text-slate-300">Total</span><p className="font-bold text-indigo-700 dark:text-indigo-300">{Number(cost.total_cost || 0).toFixed(2)}</p></div>
              </div>
            </div>
          )}

          {/* Action Footer for View Modal */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className={btnGhost}
                onClick={() => onEdit?.(detail)}
              >
                <FiEdit2 className="w-4 h-4 text-amber-500" /> Edit Formula
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => onRevise?.(detail.id)}
              >
                <FiRefreshCw className="w-4 h-4 text-blue-500" /> Revise (Create New Version)
              </button>
              {detail.status !== 'active' && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition shadow"
                  onClick={() => onActivate?.(detail.id)}
                >
                  <FiCheckCircle className="w-4 h-4" /> Activate Recipe
                </button>
              )}
            </div>
            <button className={btnGhost} onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
