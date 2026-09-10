/**
 * restaurant-client / localStore.js
 * ---------------------------------------------------------------------------
 * Local stock ledger for the Restaurant EXE.
 *
 * The ERP owns the MANUFACTURER's stock. This module owns the RESTAURANT's
 * own stock. When a product is dispatched from the ERP to the store:
 *    - we ADd the dispatched qty to our local product stock, and
 *    - we RECORD dispatch_ref so we never apply the same dispatch twice
 *      (idempotency).
 *
 * Storage is pluggable. By default it uses `localStorage` (browser / Electron
 * renderer). In an Electron MAIN process you can pass any `storage` object
 * that implements { getItem, setItem, removeItem }.
 * ---------------------------------------------------------------------------
 */

'use strict';

// Simple default storage backed by localStorage, falling back to an in-memory map.
function defaultStorage() {
  if (typeof localStorage !== 'undefined') {
    return {
      getItem: (k) => localStorage.getItem(k),
      setItem: (k, v) => localStorage.setItem(k, v),
      removeItem: (k) => localStorage.removeItem(k),
    };
  }
  const mem = new Map();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
}

function createLocalStore(storage) {
  const store = storage || defaultStorage();
  const KEYS = {
    products: 'restaurant.products',
    applied: 'restaurant.appliedDispatches',
    log: 'restaurant.log',
    config: 'restaurant.config',
  };

  function read(key, fallback) {
    try {
      const raw = store.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function write(key, value) {
    store.setItem(key, JSON.stringify(value));
  }

  return {
    // ---- settings (ERP base URL + API key) --------------------------------
    getConfig() {
      return (
        read(KEYS.config, null) || { baseUrl: '', apiKey: '', storeName: '' }
      );
    },
    saveConfig(cfg) {
      write(KEYS.config, cfg);
    },

    // ---- local product stock ----------------------------------------------
    listProducts() {
      return Object.values(read(KEYS.products, {}));
    },
    getProduct(productId) {
      return read(KEYS.products, {})[productId] || null;
    },

    /** Upsert a product row. Keeps name, sku, price and a running stock. */
    upsertProduct(product) {
      const all = read(KEYS.products, {});
      const existing = all[product.product_id] || {
        product_id: product.product_id,
        name: product.name,
        sku: product.sku,
        selling_price: product.selling_price,
        stock: 0,
        updated_at: null,
      };
      existing.name = product.name || existing.name;
      existing.sku = product.sku != null ? product.sku : existing.sku;
      if (product.selling_price != null) existing.selling_price = product.selling_price;
      existing.updated_at = new Date().toISOString();
      all[product.product_id] = existing;
      write(KEYS.products, all);
      return existing;
    },

    /** Add `qty` to an existing (or new) local product. */
    addStock(product_id, { name, sku, selling_price, qty, batch_no, expiry_date }) {
      const all = read(KEYS.products, {});
      const existing = all[product_id] || {
        product_id,
        name: name || `Product ${product_id}`,
        sku: sku != null ? sku : null,
        selling_price: selling_price != null ? selling_price : null,
        stock: 0,
        updated_at: null,
      };
      existing.name = name || existing.name;
      existing.stock = (existing.stock || 0) + qty;
      if (batch_no) existing.last_batch = batch_no;
      if (expiry_date) existing.last_expiry = expiry_date;
      if (selling_price != null) existing.selling_price = selling_price;
      existing.updated_at = new Date().toISOString();
      all[product_id] = existing;
      write(KEYS.products, all);
      return existing;
    },

    // ---- idempotency --------------------------------------------------------
    isDispatchApplied(dispatchId) {
      const applied = read(KEYS.applied, {});
      return Boolean(applied[dispatchId]);
    },
    markDispatchApplied(dispatchId, dispatchRef) {
      const applied = read(KEYS.applied, {});
      applied[dispatchId] = { dispatch_ref: dispatchRef, applied_at: new Date().toISOString() };
      write(KEYS.applied, applied);
    },

    // ---- audit log ----------------------------------------------------------
    getLog() {
      return read(KEYS.log, []);
    },
    logEntry(entry) {
      const log = read(KEYS.log, []);
      log.unshift({ id: entry.dispatch_ref || Date.now(), ...entry, at: new Date().toISOString() });
      write(KEYS.log, log.slice(0, 500)); // keep the latest 500
    },
  };
}

module.exports = { createLocalStore };
if (typeof window !== 'undefined') window.createLocalStore = createLocalStore;