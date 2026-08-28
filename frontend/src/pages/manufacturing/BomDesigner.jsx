import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPackage, FiPlus, FiX, FiEdit2, FiTrash2, FiCheckCircle,
  FiRefreshCw, FiLayers, FiDollarSign, FiActivity, FiTruck, FiList
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
    onSuccess: () => {
      toast.success('BOM activated');
      queryClient.invalidateQueries({ queryKey: ['boms'] });
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
      toast.success('BOM deleted');
      queryClient.invalidateQueries({ queryKey: ['boms'] });
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
        <button className={btnPrimary} onClick={() => { setViewBom(null); setIsCreateOpen(true); }}>
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
                    <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Version</th>
                    <th className="py-2 pr-4">Revision</th><th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Std Cost</th><th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {boms.map((b) => (
                    <tr key={b.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 pr-4 font-medium text-slate-800 dark:text-white">{b.name}</td>
                      <td className="py-2 pr-4">{b.version}</td>
                      <td className="py-2 pr-4">{b.revision_no || 0}</td>
                      <td className="py-2 pr-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_STYLES[b.status] || STATUS_STYLES.draft}`}>{b.status}</span></td>
                      <td className="py-2 pr-4">{Number(b.standard_cost || 0).toFixed(2)}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button title="View" className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" onClick={() => { setViewBom(b); setIsViewOpen(true); }}><FiList /></button>
                          <button title="Edit (revision)" className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600" onClick={() => reviseMutation.mutate(b.id)}><FiEdit2 /></button>
                          <button title="Revise" className="p-1.5 rounded-lg text-slate-500 hover:bg-green-50 hover:text-green-600" onClick={() => reviseMutation.mutate(b.id)}><FiRefreshCw /></button>
                          <button title="Activate" className="p-1.5 rounded-lg text-slate-500 hover:bg-green-50 hover:text-green-600" disabled={b.status === 'active'} onClick={() => activateMutation.mutate(b.id)}><FiCheckCircle /></button>
                          <button title="Delete" className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={() => deleteMutation.mutate(b.id)}><FiTrash2 /></button>
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
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        productId={selectedProduct}
        products={products}
        workCenters={workCenters}
        machines={machines}
      />
      <ViewBomModal open={isViewOpen} onClose={() => setIsViewOpen(false)} bom={viewBom} workCenters={workCenters} machines={machines} products={products} />
    </div>
  );
}

function CreateBomModal({ open, onClose, productId, products, workCenters, machines }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    product_id: productId || '',
    name: '', version: 'V1.0', status: 'draft', standard_cost: 0, overhead_cost: 0,
    total_setup_time_mins: 0, notes: '',
    items: [{ ...EMPTY_ITEM }],
    routing_operations: [{ ...EMPTY_OP }],
    byproducts: [],
  });

  useEffect(() => {
    if (open) {
      setForm({
        product_id: productId || '',
        name: '', version: 'V1.0', status: 'draft', standard_cost: 0, overhead_cost: 0,
        total_setup_time_mins: 0, notes: '',
        items: [{ ...EMPTY_ITEM }],
        routing_operations: [{ ...EMPTY_OP }],
        byproducts: [],
      });
    }
  }, [productId, open]);

  const mutation = useMutation({
    mutationFn: (payload) => apiClient.post('/manufacturing/boms', payload),
    onSuccess: () => {
      toast.success('BOM created');
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed to create BOM'),
  });

  const setItems = (cb) => setForm((f) => ({ ...f, items: cb(f.items) }));
  const setOps = (cb) => setForm((f) => ({ ...f, routing_operations: cb(f.routing_operations) }));
  const setBps = (cb) => setForm((f) => ({ ...f, byproducts: cb(f.byproducts) }));

  const submit = () => {
    const payload = {
      ...form,
      product_id: Number(form.product_id),
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
    <Modal open={open} onClose={onClose} title="New Bill of Materials" wide>
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase text-slate-500">Finished Product</label>
            <select className={inputCls} value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
              <option value="">Select a product...</option>
              {products.filter(p => !p.is_raw_material).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku || 'no-sku'})</option>)}
            </select>
          </div>
          <div><label className="text-xs font-semibold uppercase text-slate-500">BOM Name</label>
            <input className={inputCls} value={form.name} placeholder="e.g. Standard Recipe" onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="text-xs font-semibold uppercase text-slate-500">Version</label>
            <input className={inputCls} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs font-semibold uppercase text-slate-500">Status</label>
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option><option value="active">Active</option><option value="deprecated">Deprecated</option>
            </select></div>
          <div><label className="text-xs font-semibold uppercase text-slate-500">Standard Cost</label>
            <input type="number" className={inputCls} value={form.standard_cost} onChange={(e) => setForm({ ...form, standard_cost: e.target.value })} /></div>
          <div><label className="text-xs font-semibold uppercase text-slate-500">Overhead Cost</label>
            <input type="number" className={inputCls} value={form.overhead_cost} onChange={(e) => setForm({ ...form, overhead_cost: e.target.value })} /></div>
          <div><label className="text-xs font-semibold uppercase text-slate-500">Total Setup (min)</label>
            <input type="number" className={inputCls} value={form.total_setup_time_mins} onChange={(e) => setForm({ ...form, total_setup_time_mins: e.target.value })} /></div>
        </div>

        {/** Components (multi-level via parent ref) */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-slate-700 dark:text-white">Components</h4>
            <button className={btnGhost} onClick={() => setItems((arr) => [...arr, { ...EMPTY_ITEM }])}><FiPlus className="w-3 h-3" /> Add</button>
          </div>
          {form.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
              <div className="col-span-4"><select className={inputCls} value={item.item_id} onChange={(e) => setItems((a) => a.map((it, i) => i === idx ? { ...it, item_id: e.target.value } : it))}>
                <option value="">Material...</option>{products.filter(p => p.is_raw_material).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
              <div className="col-span-2"><input className={inputCls} placeholder="Parent ref" value={item.parent_bom_item_id} onChange={(e) => setItems((a) => a.map((it, i) => i === idx ? { ...it, parent_bom_item_id: e.target.value } : it))} /></div>
              <div className="col-span-2"><input className={inputCls} placeholder="Qty" type="number" value={item.qty_required} onChange={(e) => setItems((a) => a.map((it, i) => i === idx ? { ...it, qty_required: e.target.value } : it))} /></div>
              <div className="col-span-2"><input className={inputCls} placeholder="UOM" value={item.uom} onChange={(e) => setItems((a) => a.map((it, i) => i === idx ? { ...it, uom: e.target.value } : it))} /></div>
              <div className="col-span-1"><input className={inputCls} placeholder="Waste%" type="number" value={item.waste_pct} onChange={(e) => setItems((a) => a.map((it, i) => i === idx ? { ...it, waste_pct: e.target.value } : it))} /></div>
              <div className="col-span-1 flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-slate-500"><input type="checkbox" checked={item.is_alternate} onChange={(e) => setItems((a) => a.map((it, i) => i === idx ? { ...it, is_alternate: e.target.checked } : it))} /> Alt</label>
                <button className="text-red-500 hover:text-red-700" onClick={() => setItems((a) => a.filter((_, i) => i !== idx))}><FiTrash2 className="w-4 h-4" /></button>
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
            {mutation.isLoading ? <Loading /> : 'Save BOM'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ViewBomModal({ open, onClose, bom, workCenters, machines, products }) {
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-slate-400">Product</span><p className="font-semibold">{nameOf(detail.product_id)}</p></div>
            <div><span className="text-slate-400">Version / Rev</span><p className="font-semibold">{detail.version} / {detail.revision_no || 0}</p></div>
            <div><span className="text-slate-400">Status</span><p className="font-semibold capitalize">{detail.status}</p></div>
            <div><span className="text-slate-400">Std Cost</span><p className="font-semibold">{Number(detail.standard_cost || 0).toFixed(2)}</p></div>
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
        </div>
      )}
    </Modal>
  );
}

