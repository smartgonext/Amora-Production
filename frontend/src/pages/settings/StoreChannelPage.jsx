import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  FiPlus, FiCopy, FiRefreshCw, FiShoppingBag, FiKey, FiTruck, FiInfo,
  FiBox, FiCheckCircle, FiSearch, FiShield, FiLayers, FiTrash2, FiFolder
} from 'react-icons/fi';
import {
  createStoreChannel, listStoreChannels, rotateStoreChannelKey,
  listStoreChannelDispatches, listSyncedProducts, importSyncedToProducts,
  cleanupUnwantedCatalog
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
  const [syncedProducts, setSyncedProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [productTypeFilter, setProductTypeFilter] = useState('all'); // 'all', 'kot', 'retail'
  const [importingToProducts, setImportingToProducts] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  const handleImportToProducts = async () => {
    try {
      setImportingToProducts(true);
      const res = await importSyncedToProducts();
      toast.success(res.data?.data?.message || 'Imported items into Bakery ERP Products page!');
      await loadSyncedProducts();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0] || 'Import failed');
    } finally {
      setImportingToProducts(false);
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm("Clean up commercial 13-digit FMCG products? This will ensure ONLY KOT items and your shop's own 5-digit barcodes remain in the ERP.")) return;
    try {
      setCleaningUp(true);
      const res = await cleanupUnwantedCatalog();
      toast.success(res.data?.data?.message || 'Cleaned up unwanted commercial products');
      await loadSyncedProducts();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0] || 'Cleanup failed');
    } finally {
      setCleaningUp(false);
    }
  };

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

  const loadSyncedProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await listSyncedProducts();
      setSyncedProducts(res.data?.data || []);
    } catch (err) {
      console.warn('Could not load synced products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    load();
    loadSyncedProducts();
  }, []);

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

      {/* Synced Restaurant Catalog & Dual Stock Matrix */}
      <section className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <FiBox className="text-pink-500" /> Synced Restaurant Catalog & Stock Matrix
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 font-semibold">
                {(() => {
                  const valid = syncedProducts.filter(p => {
                    const name = (p.name || '').trim();
                    if (!name || name.startsWith('http:') || name.startsWith('https:')) return false;
                    if (p.is_kot_item) return true;
                    const bc = String(p.barcode || p.sku || '').trim();
                    if (bc.length === 13 || bc.startsWith('890')) return false;
                    return /^\d{1,6}$/.test(bc);
                  });
                  return `${valid.length} Items`;
                })()}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only authentic Bakery items: <b>🌱 All KOT Kitchen Items</b> and <b>📦 Shop's Own 5-Digit Barcodes</b> (00001, 00010). Commercial 13-digit FMCG items are excluded.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleImportToProducts}
              disabled={importingToProducts || loadingProducts}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm disabled:opacity-60"
              title="Add these restaurant products into the main Bakery ERP Product catalog"
            >
              <FiPlus className="w-3.5 h-3.5" />
              <span>{importingToProducts ? 'Importing…' : 'Import to Products Page'}</span>
            </button>
            <button
              onClick={handleCleanup}
              disabled={cleaningUp || loadingProducts}
              className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-60"
              title="Clean up 13-digit commercial goods (FMCG) and retain only KOT and 5-digit own barcode items"
            >
              <FiTrash2 className="w-3.5 h-3.5" />
              <span>{cleaningUp ? 'Cleaning…' : 'Clean FMCG Barcodes'}</span>
            </button>
            <button
              onClick={loadSyncedProducts}
              disabled={loadingProducts}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${loadingProducts ? 'animate-spin' : ''}`} />
              <span>Refresh Catalog</span>
            </button>
          </div>
        </div>

        {/* Dynamic Category Extraction & Filtering */}
        {(() => {
          // Strictly filter valid items:
          // KOT: Always allowed
          // Non-KOT: Strictly 1-6 digits (5-digit base own barcode), no 13-digits or 890...
          const validItems = syncedProducts.filter((p) => {
            const name = (p.name || '').trim();
            if (!name || name.startsWith('http:') || name.startsWith('https:')) return false;
            if (p.is_kot_item) return true;
            const bc = String(p.barcode || p.sku || '').trim();
            if (bc.length === 13 || bc.startsWith('890')) return false;
            return /^\d{1,6}$/.test(bc);
          });

          // Compute category counts
          const categoryCounts = {};
          validItems.forEach((p) => {
            const cat = (p.category_name || 'General').trim();
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
          });
          const categoryList = Object.entries(categoryCounts).sort((a, b) => a[0].localeCompare(b[0]));

          const kotTotal = validItems.filter((p) => p.is_kot_item).length;
          const ownBarcodeTotal = validItems.filter((p) => !p.is_kot_item).length;

          const filtered = validItems.filter((p) => {
            if (selectedCategory !== 'all' && (p.category_name || 'General').trim() !== selectedCategory) {
              return false;
            }
            if (productTypeFilter === 'kot' && !p.is_kot_item) return false;
            if (productTypeFilter === 'retail' && p.is_kot_item) return false;
            if (productSearch) {
              const q = productSearch.toLowerCase();
              return (
                p.name?.toLowerCase().includes(q) ||
                p.barcode?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.category_name?.toLowerCase().includes(q)
              );
            }
            return true;
          });

          return (
            <>
              {/* Search, Category & Type Filter Bar */}
              <div className="space-y-3 mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search box */}
                  <div className="relative flex-1 min-w-[220px]">
                    <FiSearch className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Filter by name, barcode, or SKU..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none"
                    />
                  </div>

                  {/* Category Dropdown */}
                  <div className="flex items-center gap-1.5 min-w-[220px]">
                    <FiFolder className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full py-1.5 px-2.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                    >
                      <option value="all">📁 All Categories ({validItems.length})</option>
                      {categoryList.map(([cat, count]) => (
                        <option key={cat} value={cat}>
                          {cat} ({count})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Type Filter Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setProductTypeFilter('all')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                        productTypeFilter === 'all'
                          ? 'bg-pink-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      All Items ({validItems.length})
                    </button>
                    <button
                      onClick={() => setProductTypeFilter('kot')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                        productTypeFilter === 'kot'
                          ? 'bg-pink-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      🌱 All KOT Items ({kotTotal})
                    </button>
                    <button
                      onClick={() => setProductTypeFilter('retail')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                        productTypeFilter === 'retail'
                          ? 'bg-pink-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      📦 5-Digit Own Barcode ({ownBarcodeTotal})
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 font-medium">
                    Showing <span className="font-bold text-slate-900 dark:text-white">{filtered.length}</span> matching items
                  </div>
                </div>
              </div>

              {/* Deletion Protection Banner */}
              <div className="mb-4 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <FiShield className="w-4 h-4 flex-shrink-0" />
                <span><b>Catalog Safety Active:</b> Archiving or deleting items in Bakery ERP will NEVER remove or alter products in your live Restaurant POS database.</span>
              </div>

              {/* Products Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                      <th className="py-2.5 px-3">Product Name & Category</th>
                      <th className="py-2.5 px-3">Barcode / SKU</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Selling Price</th>
                      <th className="py-2.5 px-3 text-right">Restaurant POS Stock</th>
                      <th className="py-2.5 px-3 text-right">Bakery ERP Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loadingProducts ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">Loading synced items...</td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No matching synced products found. Click "Refresh Catalog" or check filter selections.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800 dark:text-white">{p.name}</div>
                            <div className="text-[10px] inline-flex items-center gap-1 font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mt-0.5">
                              📁 {p.category_name || 'General'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-200 font-semibold">
                            {p.barcode || p.sku || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.is_kot_item
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            }`}>
                              {p.is_kot_item ? '🌱 KOT Item' : '🏷️ 5-Digit Barcode'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-100">
                            ₹{Number(p.selling_price || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-pink-600 dark:text-pink-400">
                            {p.restaurant_stock}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                            {p.erp_product_stock ?? '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
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