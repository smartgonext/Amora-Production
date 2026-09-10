import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiRefreshCw, FiSettings, FiX, FiPackage, FiTruck, FiPlusCircle, FiExternalLink } from 'react-icons/fi';

import { createErpStoreClient } from '../api/erpStore';
import { createLocalStore } from '../local/localStore';
import { createSyncEngine } from '../local/syncEngine';

export default function StoreDashboard() {
  const localRef = useRef(null);
  if (!localRef.current) localRef.current = createLocalStore();
  const local = localRef.current;

  const [config, setConfig] = useState(() => local.getConfig());
  const [client, setClient] = useState(null);
  const [localProducts, setLocalProducts] = useState(() => local.listProducts());
  const [log, setLog] = useState(() => local.getLog());
  const [readyProducts, setReadyProducts] = useState([]);
  const [remoteStock, setRemoteStock] = useState({});
  const [dispatching, setDispatching] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ status: 'idle' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || '');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [selectedId, setSelectedId] = useState('');
  const [transferQty, setTransferQty] = useState(1);

  const applyConfig = (cfg) => {
    local.saveConfig(cfg);
    setConfig(cfg);
    setBaseUrl(cfg.baseUrl);
    setApiKey(cfg.apiKey);
    if (cfg.baseUrl && cfg.apiKey) {
      setClient(createErpStoreClient(cfg.baseUrl, cfg.apiKey));
    }
  };

  useEffect(() => {
    if (!config.baseUrl || !config.apiKey) return undefined;
    const sync = createSyncEngine(client, local, { onStatus: (s) => setSyncStatus(s) });
    sync.start();
    const t = setInterval(() => setLocalProducts(local.listProducts()), 5000);
    return () => { sync.stop(); clearInterval(t); };
  }, [client]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshReady = async () => {
    if (!client) return toast.error('Save ERP URL + API key first.');
    try {
      const res = await client.getReadyProducts();
      const list = (res.data && res.data.products) || [];
      setReadyProducts(list);
      const map = {};
      list.forEach((p) => { map[p.product_id] = p.ready_stock; });
      setRemoteStock(map);
      toast.success(`Loaded ${list.length} ready product(s) from maker.`);
    } catch (e) {
      toast.error(e.message || 'Could not reach the ERP.');
    }
  };

  useEffect(() => {
    if (client) refreshReady();
  }, [client]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!client) return toast.error('Save ERP URL + API key first.');
    const pid = Number(selectedId);
    const qty = Number(transferQty);
    if (!pid || qty <= 0) return toast.error('Select a product and a qty.');
    setDispatching(true);
    try {
      const res = await client.dispatch([{ product_id: pid, qty }]);
      const data = res.data || {};
      const lines = data.receivable_lines || data.items || [];
      lines.forEach((line) => {
        local.addStock(line.product_id, {
          name: line.product_name, sku: line.sku, selling_price: line.selling_price,
          qty: line.qty, batch_no: line.batch_no, expiry_date: line.expiry_date,
        });
        local.markDispatchApplied(data.id, data.dispatch_ref);
      });
      local.logEntry({ dispatch_ref: data.dispatch_ref, dispatch_id: data.id,
        total_lines: lines.length, total_qty: lines.reduce((s, l) => s + (l.qty || 0), 0) });
      setLocalProducts(local.listProducts());
      setLog(local.getLog());
      toast.success(`Transferred ${qty} to local stock (${data.dispatch_ref}).`);
      refreshReady();
    } catch (err) {
      toast.error(err.message || 'Transfer failed.');
    } finally {
      setDispatching(false);
    }
  };

  const localById = useMemo(() => {
    const m = {};
    localProducts.forEach((p) => { m[p.product_id] = p; });
    return m;
  }, [localProducts]);

  const rows = useMemo(() => readyProducts.map((rp) => {
    const mine = localById[rp.product_id];
    return { ...rp, myStock: mine ? mine.stock : 0, isNew: mine == null };
  }), [readyProducts, localById]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black">Restaurant Store</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Connect to the maker's ERP · receive finished products into store stock
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncPill status={syncStatus.status} />
          <button onClick={refreshReady} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700">
            <FiRefreshCw /> Refresh
          </button>
          <button onClick={() => setSettingsOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700">
            <FiSettings /> Settings
          </button>
        </div>
      </div>

      {!client && <EmptyState onOpen={() => setSettingsOpen(true)} />}

      {client && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-bold mb-4">
              <FiPackage /> Products ready at maker ({rows.length})
            </h2>
            {rows.length === 0 && <p className="text-sm text-slate-500">No finished products with stock right now.</p>}
            <div className="space-y-2 max-h-[420px] overflow-auto">
              {rows.map((rp) => (
                <div key={rp.product_id} className="flex items-center justify-between border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {rp.name}
                      {rp.isNew && (
                        <span className="ml-2 align-middle inline-flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-500 rounded-full px-2 py-0.5">
                          <FiPlusCircle /> NEW
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      Stock: {rp.ready_stock} · ₹{rp.selling_price ?? 0}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-400">ready</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleTransfer} className="mt-4 border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Product</label>
                  <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm">
                    <option value="">-- Choose --</option>
                    {rows.map((rp) => (
                      <option key={rp.product_id} value={rp.product_id}>{rp.name} (stock {rp.ready_stock})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Qty</label>
                  <input type="number" min="1" max={remoteStock[Number(selectedId)] ?? undefined}
                    value={transferQty} onChange={(e) => setTransferQty(Number(e.target.value) || 1)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
              <button type="submit" disabled={dispatching}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg text-sm disabled:opacity-50">
                <FiTruck /> {dispatching ? 'Transferring...' : 'Transfer to my store'}
              </button>
            </form>
          </section>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-bold mb-4">
              <FiPackage /> My store stock ({localProducts.length})
            </h2>
            {localProducts.length === 0 && <p className="text-sm text-slate-500">No stock yet. Transfer products to begin.</p>}
            <div className="space-y-2 max-h-[420px] overflow-auto">
              {localProducts.map((p) => (
                <div key={p.product_id} className="flex items-center justify-between border border-emerald-200 dark:border-emerald-900 rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.last_batch && `Batch ${p.last_batch}`}
                      {p.last_batch && p.last_expiry && ' · '}
                      {p.last_expiry && `exp ${p.last_expiry.slice(0, 10)}`}
                    </p>
                  </div>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">{p.stock}</span>
                </div>
              ))}
            </div>

            <h3 className="mt-5 font-bold">Recent transfers</h3>
            <div className="mt-2 space-y-1.5 max-h-[160px] overflow-auto">
              {log.slice(0, 8).map((l) => (
                <div key={l.id} className="flex items-center justify-between text-xs border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5">
                  <span className="truncate">{l.dispatch_ref}</span>
                  <span className="font-semibold">+{l.total_qty} qty</span>
                </div>
              ))}
              {log.length === 0 && <p className="text-xs text-slate-500">No activity yet.</p>}
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <SettingsModal
          baseUrl={baseUrl} setBaseUrl={setBaseUrl}
          apiKey={apiKey} setApiKey={setApiKey}
          onClose={() => setSettingsOpen(false)}
          onSave={() => {
            applyConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
            setSettingsOpen(false);
            toast.success('Settings saved.');
          }}
        />
      )}
    </div>
  );
}

function SyncPill({ status }) {
  const map = { idle: ['idle', 'bg-slate-400'], synced: ['Synced', 'bg-emerald-500'], error: ['Offline', 'bg-rose-500'] };
  const [label, cls] = map[status] || map.idle;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold text-white rounded-full px-3 py-1 ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-white" /> {label}
    </span>
  );
}

function EmptyState({ onOpen }) {
  return (
    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
      <FiExternalLink className="mx-auto text-4xl text-slate-400 mb-3" />
      <p className="font-bold mb-1">Not connected to the maker's ERP yet</p>
      <p className="text-sm text-slate-500 mb-4">Add the ERP URL and your store API key.</p>
      <button onClick={onOpen} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm">
        <FiSettings /> Open Settings
      </button>
    </div>
  );
}

function SettingsModal({ baseUrl, setBaseUrl, apiKey, setApiKey, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2"><FiSettings /> ERP Connection</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><FiX /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">ERP base URL</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://erp.example.com/api/v1/store"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Store API key</label>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="from ERP → Store → Create outlet"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm" />
          </div>
          <button onClick={onSave} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg text-sm">
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
}
