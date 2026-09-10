/**
 * restaurant-client / syncEngine.js
 * ---------------------------------------------------------------------------
 * Background sync for the Restaurant EXE.
 *
 * Ties together {@link createErpStoreClient} (ERP API) and
 * {@link createLocalStore} (local stock) so that:
 *
 *   (a) every ~60s (and on app start) we pull the ERP's READY products and the
 *       list of pending dispatches, and
 *   (b) each pending dispatch's `receivable_lines` are ADDED to local stock
 *       exactly ONCE (guarded by dispatch_ref), then marked received in the ERP.
 *
 * Usage:
 *   const client  = createErpStoreClient(baseUrl, apiKey);
 *   const local   = createLocalStore();
 *   const sync    = createSyncEngine(client, local, { onStatus });
 *   sync.start();     // begins polling
 *   sync.stop();      // stops polling
 *   await sync.runOnce(); // run one sync cycle manually
 * ---------------------------------------------------------------------------
 */

'use strict';

function createSyncEngine(client, local, opts = {}) {
  const intervalMs = opts.intervalMs || 60000;
  let timer = null;
  let running = false;

  function setStatus(status, extra) {
    if (typeof opts.onStatus === 'function') {
      opts.onStatus({ status, ...extra, at: new Date().toISOString() });
    }
  }

  /**
   * One full sync cycle:
   *  1. refresh ready products (so the UI shows the maker's available stock)
   *  2. pull pending dispatches and apply them to local stock (idempotent)
   */
  async function runOnce() {
    if (running) return { skipped: true };
    running = true;
    const summary = { applied: 0, received: 0, newProducts: 0, errors: [] };

    try {
      // 1) Ready products -> keep the local catalogue + available stock in sync.
      const ready = await client.getReadyProducts({ includeZeroStock: true });
      const products = (ready && ready.data && ready.data.products) || [];
      for (const p of products) {
        const before = local.getProduct(p.product_id);
        const nameChanged = before && before.name !== p.name;
        if (!before) summary.newProducts += 1;
        if (nameChanged) summary.newProducts += 1; // treat renames as "new" signal
        local.upsertProduct(p);
      }

      // 2) Pending dispatches.
      const dispatched = await client.listDispatches('dispatched');
      const dispatches = (dispatched && dispatched.data) || [];
      for (const d of dispatches) {
        const id = d.id;
        if (local.isDispatchApplied(id)) continue;

        const detail = await client.getDispatch(id);
        const data = detail.data || d;
        const lines = data.receivable_lines || data.items || [];

        for (const line of lines) {
          local.addStock(line.product_id, {
            name: line.product_name,
            sku: line.sku,
            selling_price: line.selling_price,
            qty: line.qty,
            batch_no: line.batch_no,
            expiry_date: line.expiry_date,
          });
        }

        local.markDispatchApplied(id, data.dispatch_ref);
        local.logEntry({
          dispatch_ref: data.dispatch_ref,
          dispatch_id: id,
          total_lines: lines.length,
          total_qty: lines.reduce((s, l) => s + (l.qty || 0), 0),
        });
        summary.applied += 1;

        // acknowledge in the ERP so it no longer shows as pending.
        try {
          await client.receiveDispatch(id);
          summary.received += 1;
        } catch (e) {
          summary.errors.push(`receive ${id}: ${e.message}`);
        }
      }

      setStatus('synced', summary);
    } catch (e) {
      summary.errors.push(e.message);
      setStatus('error', { error: e.message });
    } finally {
      running = false;
    }
    return summary;
  }

  return {
    runOnce,
    start() {
      if (timer) return;
      // fire immediately, then on the interval.
      runOnce();
      timer = setInterval(() => runOnce(), intervalMs);
      if (timer.unref) timer.unref();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    isRunning() {
      return running;
    },
  };
}

module.exports = { createSyncEngine };
if (typeof window !== 'undefined') window.createSyncEngine = createSyncEngine;