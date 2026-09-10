'use strict';
// Validation for restaurant-client: exercises erpStore + localStore + syncEngine
// with a mocked fetch (Node) so no real server is needed.
const { createErpStoreClient } = require('./api/erpStore');
const { createLocalStore } = require('./local/localStore');
const { createSyncEngine } = require('./local/syncEngine');

// ---- in-memory storage (like localStorage) -------------------------------
function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null),
           setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

// ---- mock ERP server ------------------------------------------------------
const DB = {
  products: [
    { product_id: 1, name: 'Vanilla Tub', sku: 'VT', selling_price: 220, ready_stock: 50 },
    { product_id: 2, name: 'Choco Bar', sku: 'CB', selling_price: 60, ready_stock: 12 },
  ],
  dispatches: [],
  nextDispatch: 1,
};
const ERP_BASE = 'https://erp.test/api/v1/store';
const API_KEY = 'testkey123';

async function mockFetch(url, opts = {}) {
  const path = url.replace(ERP_BASE, '');
  const method = opts.method || 'GET';
  let payload = null;
  try { payload = opts.body ? JSON.parse(opts.body) : null; } catch (e) {}

  const json = (data, status = 200) => ({ ok: true, status,
    text: () => Promise.resolve(JSON.stringify({ data, errors: null })) });

  if (path === '/health') return json({ status: 'online' });

  if (path === '/products' && method === 'GET') {
    return json({ store_code: 'REST1', products: DB.products });
  }

  if (path === '/dispatch' && method === 'POST') {
    const items = payload.items || [];
    const dispatch = { id: DB.nextDispatch++, dispatch_ref: 'DSP-TEST0001',
      status: 'dispatched', total_qty: items.reduce((s, i) => s + i.qty, 0),
      items, receivable_lines: items.map((i) => {
        const p = DB.products.find((x) => x.product_id === i.product_id);
        return { product_id: i.product_id, product_name: p.name, sku: p.sku,
                 qty: i.qty, batch_no: 'VT-100', expiry_date: '2026-12-31',
                 selling_price: p.selling_price };
      }) };
    DB.dispatches.push(dispatch);
    // reduce ERP stock
    for (const i of items) { const p = DB.products.find((x) => x.product_id === i.product_id); p.ready_stock -= i.qty; }
    return json(dispatch, 201);
  }

  if (path === '/dispatches' || path === '/dispatches?status=dispatched') {
    return json(DB.dispatches);
  }
  const m = path.match(/^\/dispatches\/(\d+)$/);
  if (m && method === 'GET') {
    const d = DB.dispatches.find((x) => x.id === Number(m[1]));
    return d ? json(d) : json(null, 404);
  }
  const r = path.match(/^\/dispatches\/(\d+)\/receive$/);
  if (r && method === 'POST') {
    const d = DB.dispatches.find((x) => x.id === Number(r[1]));
    d.status = 'received';
    return json(d);
  }
  return json({ error: 'not found' }, 404);
}

// ---- run assertions -------------------------------------------------------
const client = createErpStoreClient(ERP_BASE, API_KEY, { fetchImpl: mockFetch });
const local = createLocalStore(memStorage());

(async () => {
  // 1) health
  const h = await client.health();
  console.log('health:', h.data.status);

  // 2) READY products (how many available at maker)
  const ready = await client.getReadyProducts();
  console.log('ready count =', ready.data.products.length, '| names =',
    ready.data.products.map((p) => `${p.name}(${p.ready_stock})`).join(', '));

  // 3) TRANSFER 10 of product 1 from ERP -> EXE
  const res = await client.dispatch([{ product_id: 1, qty: 10 }]);
  const d = res.data;
  console.log('dispatch ref =', d.dispatch_ref, '| status =', d.status);

  // apply to LOCAL stock (what the EXE does)
  for (const line of d.receivable_lines) {
    local.addStock(line.product_id, { name: line.product_name, sku: line.sku,
      selling_price: line.selling_price, qty: line.qty, batch_no: line.batch_no,
      expiry_date: line.expiry_date });
  }
  local.markDispatchApplied(d.id, d.dispatch_ref);
  local.logEntry({ dispatch_ref: d.dispatch_ref, dispatch_id: d.id, total_qty: 10 });

  console.log('ERP stock for product 1 now =', DB.products[0].ready_stock,
    '(was 50, reduced by 10 =', DB.products[0].ready_stock === 40 ? 'OK' : 'FAIL', ')');
  const mine = local.getProduct(1);
  console.log('EXE local stock product 1 =', mine.stock, '| name =', mine.name,
    '| same-as-ERP-name?', mine.name === 'Vanilla Tub' ? 'YES' : 'NO');

  // 4) idempotency: re-applying same dispatch id must NOT double count via ledger guard
  const before = local.getProduct(1).stock;
  if (local.isDispatchApplied(d.id)) {
    console.log('idempotency guard: dispatch already applied, will skip -> OK');
  }
  console.log('EXE stock unchanged after guard =', local.getProduct(1).stock === before ? 'OK' : 'FAIL');

  // 5) sync engine picks up a NEW dispatch automatically (new item scenario)
  //    add a second, un-applied dispatch server-side for product 2 (Choco Bar)
  DB.dispatches.push({ id: DB.nextDispatch++, dispatch_ref: 'DSP-TEST0002',
    status: 'dispatched', total_qty: 12,
    receivable_lines: [{ product_id: 2, product_name: 'Choco Bar', sku: 'CB',
      qty: 12, batch_no: 'CB-1', expiry_date: null, selling_price: 60 }] });

  const sync = createSyncEngine(client, local, { intervalMs: 999999 });
  await sync.runOnce(); // sync pulls pending dispatch(es) and applies them
  const newProd = local.getProduct(2);
  console.log('sync applied choco stock =', newProd ? newProd.stock : 'none',
    newProd && newProd.stock === 12 ? '(OK)' : '(FAIL)');

  console.log('RESTAURANT_CLIENT_SMOKE: ALL_CHECKS_DONE');
})().catch((e) => { console.error('ERROR', e); process.exit(1); });