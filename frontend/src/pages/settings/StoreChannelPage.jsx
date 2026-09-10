import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiCopy, FiRefreshCw, FiShoppingBag, FiKey, FiTruck, FiInfo } from 'react-icons/fi';
import {
  createStoreChannel, listStoreChannels, rotateStoreChannelKey, listStoreChannelDispatches,
} from '../../api/store';

const copyText = (text) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
    return Promise.resolve(true);
  }
  return Promise.reject(new Error('Clipboard unavailable'));
};

export default function StoreChannelPage() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [justCreatedKey, setJustCreatedKey] = useState(null);
  const [dispatches, setDispatches] = useState(null);
  const [dispatchesFor, setDispatchesFor] = useState(null);

  const load = async () => {
    try {
      const res = await listStoreChannels();
      setChannels(res.data?.data || []);
    } catch (e) {
      toast.error(e.message || 'Could not load restaurant outlets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Enter an outlet name');
    setCreating(true);
    try {
      const res = await createStoreChannel({ name: name.trim(), code: code.trim() || undefined });
      const ch = res.data?.data;
      setJustCreatedKey(ch.api_key);
      setName(''); setCode('');
      await load();
      toast.success('Outlet created — copy the API key now.');
    } catch (err) {
      toast.error(err.message || 'Could not create outlet');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (text, label) => {
    try {
      await copyText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error('Could not copy');
    }
  };

  const handleRotate = async (id) => {
    if (!window.confirm('Rotate API key for this outlet? The old key will stop working immediately.')) return;
    try {
      const res = await rotateStoreChannelKey(id);
      setJustCreatedKey(res.data?.data?.api_key);
      await load();
      toast.success('New API key generated.');
    } catch (err) {
      toast.error(err.message || 'Could not rotate key');
    }
  };

  const showDispatches = async (ch) => {
    try {
      const res = await listStoreChannelDispatches(ch.id);
      setDispatches(res.data?.data || []);
      setDispatchesFor(ch);
    } catch (err) {
      toast.error(err.message || 'Could not load dispatch history');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: create outlet */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-base font-bold flex items-center gap-2 mb-1">
          <FiShoppingBag className="text-indigo-500" /> Connect a Restaurant
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Create an outlet for each restaurant POS. The ERP generates a unique
          API key you paste into that restaurant's software so it can fetch your
          finished products and do stock transfers.
        </p>

        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Outlet name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Downtown Restaurant"
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Outlet code (optional)</label>
            <input value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. DOWNTOWN1"
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm" />
          </div>
          <button disabled={creating}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl text-sm shadow-lg disabled:opacity-60">
            <FiPlus /> {creating ? 'Creating…' : 'Create Outlet & Generate Key'}
          </button>
        </form>

        {justCreatedKey && (
          <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <FiKey /> New API key (copy it now — shown only once)
            </p>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 break-all text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5">
                {justCreatedKey}
              </code>
              <button onClick={() => handleCopy(justCreatedKey, 'API key')}
                className="shrink-0 px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold">
                <FiCopy />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              In your restaurant POS, set the ERP URL to
              <code className="mx-1 text-xs">…/api/v1/store</code> and paste this key.
            </p>
          </div>
        )}
      </section>

      {/* Right: outlet list + dispatch history */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-base font-bold flex items-center gap-2 mb-3">
          <FiTruck className="text-indigo-500" /> My Restaurant Outlets
        </h2>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : channels.length === 0 ? (
          <div className="text-sm text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center">
            No outlets yet. Create one on the left.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {channels.map((ch) => (
              <li key={ch.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">{ch.name}</p>
                    <p className="text-xs text-slate-500">
                      Code: {ch.code} · Last sync: {ch.last_sync_at ? new Date(ch.last_sync_at).toLocaleString() : 'never'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => showDispatches(ch)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">
                      History
                    </button>
                    <button
                      title="Rotate to reveal a new API key"
                      onClick={() => handleRotate(ch.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100">
                      <FiRefreshCw /> Key
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {dispatchesFor && (
          <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
              Dispatch history — {dispatchesFor.name}
            </p>
            {dispatches && dispatches.length === 0 ? (
              <p className="text-xs text-slate-400 mt-2">No dispatches yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {dispatches.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                    <span className="font-mono">{d.dispatch_ref}</span>
                    <span className="text-slate-500">{d.total_qty} qty · {new Date(d.dispatched_at).toLocaleString()}</span>
                    <span className={d.status === 'received' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                      {d.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="lg:col-span-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 p-5">
        <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
          <FiInfo className="text-indigo-500" /> How the API key works with your restaurant POS
        </h3>
        <ol className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-3">
          <li><b>1.</b> Create an outlet here → ERP generates an <b>API key</b>.</li>
          <li><b>2.</b> Paste the key (and the ERP URL) into the restaurant POS settings.</li>
          <li><b>3.</b> The POS fetches <b>ready products</b>, and each <b>stock transfer</b> lowers ERP stock, records the movement, and raises the restaurant's own stock — all through that one key.</li>
        </ol>
      </section>
    </div>
  );
}