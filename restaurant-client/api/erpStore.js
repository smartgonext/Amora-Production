/**
 * restaurant-client / erpStore.js
 * ---------------------------------------------------------------------------
 * Framework-agnostic API client for the SmartGoNext ERP "Store Dispatch" API
 * (see /api/v1/store). Used by the Restaurant / Billing EXE to:
 *
 *   1) GET  /store/products    -> how many products are READY at the maker
 *   2) POST /store/dispatch    -> move a product from the ERP to this store
 *      (the ERP reduces ITS stock; this EXE must then increase ITS OWN stock)
 *   3) GET  /store/dispatches  -> pending dispatches (sync / history)
 *   4) POST /store/dispatches/<id>/receive -> acknowledge arrival
 *   5) GET  /store/health      -> connection check
 *
 * Works in Node (Electron main), in a browser, or in any JS runtime. It never
 * depends on React, jQuery, axios, etc. — only on the global `fetch`.
 * ---------------------------------------------------------------------------
 */

'use strict';

const STORE_BASE = ''; // placeholder; the caller supplies the real base URL

/**
 * @param {string} baseUrl   e.g. "https://erp.example.com/api/v1/store"
 * @param {string} apiKey    the outlet API key (X-API-Key)
 * @param {Object} [opts]    { timeoutMs, fetchImpl }
 */
function createErpStoreClient(baseUrl, apiKey, opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  const timeoutMs = opts.timeoutMs || 15000;

  if (!fetchImpl) {
    throw new Error('[erpStore] global fetch is not available in this runtime');
  }

  async function request(method, path, body, extraHeaders = {}) {
    const headers = Object.assign(
      { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      extraHeaders
    );
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const res = await fetchImpl(baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller ? controller.signal : undefined,
      });

      let payload = null;
      const text = await res.text();
      try { payload = text ? JSON.parse(text) : null; } catch (_) { payload = { raw: text }; }

      if (!res.ok) {
        const errors = (payload && payload.errors) || [];
        const err = new Error(errors[0] || `HTTP ${res.status}`);
        err.status = res.status;
        err.payload = payload;
        throw err;
      }
      return payload;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    /** Connection / health check. Returns the parsed payload. */
    async health() {
      return request('GET', '/health');
    },

    /**
     * How many products are READY right now.
     * @param {{includeZeroStock?: boolean}} [query]
     */
    async getReadyProducts(query = {}) {
      const qs = query.includeZeroStock ? '?include_zero_stock=1' : '';
      return request('GET', '/products' + qs);
    },

    /**
     * Move finished products from the ERP to THIS store.
     * @param {Array<{product_id: number, qty: number}>} items
     * @param {{notes?: string, dispatchId?: number}} [opts]
     *   pass dispatchId (the ERP's dispatch id) to retry WITHOUT double-counting.
     */
    async dispatch(items, opts = {}) {
      const body = { items, notes: opts.notes };
      if (opts.dispatchId) body.dispatch_id = opts.dispatchId;
      return request('POST', '/dispatch', body);
    },

    /** List dispatches sent to this store. */
    async listDispatches(status) {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      return request('GET', '/dispatches' + qs);
    },

    /** Detail of one dispatch. */
    async getDispatch(id) {
      return request('GET', `/dispatches/${id}`);
    },

    /** Acknowledge that goods arrived (ERP marks the dispatch "received"). */
    async receiveDispatch(id) {
      return request('POST', `/dispatches/${id}/receive`, {});
    },
  };
}

module.exports = { createErpStoreClient };
if (typeof window !== 'undefined') window.createErpStoreClient = createErpStoreClient;