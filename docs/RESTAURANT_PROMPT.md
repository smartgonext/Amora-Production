# Restaurant EXE ↔ ERP — Paste-Ready Prompt

Paste the block below into your AI agent (or the tool you use to edit the
restaurant software at `D:\restorent\apps`). It is tailored to that exact
stack: **Fastify (Node) API + Prisma/SQLite + React + Electron**.

It uses the ERP "Store Dispatch" API already implemented in
`backend/app/routes/restaurant_api.py` (base path `/api/v1/store`, secured by
the `X-API-Key` header you get from the ERP Settings → Store/Restaurant page).

Copy between `BEGIN PROMPT` and `END PROMPT`.

```
BEGIN PROMPT

You are integrating a Restaurant SaaS POS (the repo at D:\restorent\apps) with a
remote manufacturer ERP. The manufacturer (bakery) makes finished products and
dispatches them to this restaurant store. This POS must:

 (1) show the operator which products are READY at the manufacturer and their
     stock,
 (2) when the manufacturer dispatches products to this store, INCREASE this
     restaurant's own inventory stock by the dispatched quantities, and
 (3) be idempotent (never apply the same dispatch twice) and offline-safe.

TECH STACK (use existing conventions, do not reinvent)
 - Node/Fastify API under apps/api/src (routes registered in src/app.js with
   prefix /api/restaurant, middleware in src/middleware/authenticate.js and
   src/middleware/tenantScope.js expose request.restaurantId).
 - Prisma ORM; the Prisma client is exported from src/app.js as `prisma`.
 - The main Prisma schema is apps/api/prisma/schema.prisma. Key models:
     InventoryItem { id, restaurantId, categoryId, unitId, name, sku?, barcode?,
                     thresholdQty, currentStock, costPerUnit }
     InventoryItemMRP { id, inventoryItemId, supplierId?, mrp, purchaseRate,
                        profitPercent?, isActive }
     WarehouseTransfer / WarehouseTransferItem  (existing inter-branch transfer)
 - React+Vite web under apps/web/src (Hooks/React Query + Tailwind).

ERP API (the manufacturer REST API you must call; every request sends header
 X-API-Key: <apiKey>. Base URL example:
 https://<erp-host>/api/v1/store )

 1) GET  /store/products
      Optional query  ?include_zero_stock=1
      Response: { data: { products: [ { product_id, name, sku, selling_price,
        is_batch_tracked, ready_stock, batches[] } ] } }
      USE: render the "ready products from maker" list and its available stock.

 2) GET  /store/dispatches?status=dispatched
      Response: { data: [ { id, dispatch_ref, status, total_qty, dispatched_at,
        items[], receivable_lines[] } ] }

 3) GET  /store/dispatches/<id>
      Returns one dispatch detail (same shape as above).

 4) POST /store/dispatches/<id>/receive    (body: {})
      Tells the ERP the goods arrived (sets status=received). Call it AFTER
      applying the stock locally.

 5) GET  /store/health
      Simple online check.

HOW A DISPATCH WORKS
 - When the ERP dispatches, IT already reduced ITS own stock and recorded the
   movement. Your POS must ADD the quantities locally.
 - Each receivable line looks like:
     { product_id, product_name, sku, qty, batch_no, mfg_date, expiry_date,
       selling_price }
 - Match lines to InventoryItem by sku when possible; if an InventoryItem does
   not exist, find (or create) it under the restaurant, then increase
   currentStock by qty. Set costPerUnit/selling info from selling_price if the
   item is new.
REQUIREMENTS

 A. NEW Fastify route module: apps/api/src/routes/restaurant/erpStore.js
    Register it in src/app.js (prefix /api/restaurant):
      await app.register(erpStoreRoutes, { prefix: '/api/restaurant' });
    Provide:
      - endpoints to save/read RESTAURANT-side ERP config (baseUrl, apiKey)
        stored per restaurant (add these fields to Restaurant/settings or a new
        small ErpSyncConfig table; do not store the apiKey in logs or client JS
        bundle — keep it server-side, protected by authenticate).
      - GET  /erp-store/ready-products  -> proxy: call ERP GET /store/products
        with the saved apiKey (header X-API-Key) and return products.
      - POST /erp-store/sync           -> run one pull/apply cycle (see B).
      - Each route must send X-API-Key: <apiKey> and parse the ERP envelope
        { data, errors }. Return the ERP's { data } to the frontend.
    Also expose an endpoint so the POS can trigger a manual transfer
    (POST /erp-store/dispatch { items:[{product_id,qty}] }) that calls the ERP
    POST /store/dispatch, then immediately applies the returned
    receivable_lines locally (same apply logic) and marks received.

 B. Background sync (per restaurant, only when config is present)
    - On server start and every 60 seconds, for each restaurant that has an
      ERP baseUrl+apiKey:
        1) call GET /store/dispatches?status=dispatched
        2) for each dispatch not already applied, apply receivable_lines to
           InventoryItem.currentStock (upsert by sku), record dispatch id as
           applied (persist in a table with a unique dispatch-id column), then
           call POST /store/dispatches/<id>/receive.
    - Idempotency is REQUIRED: guard by dispatch id so re-sync never double
      counts. Wrap the sync in a per-restaurant lock so concurrent runs don't
      double-apply.
    - Offline-safe: if the ERP is unreachable, silently skip and retry next
      tick; never block POS billing.
    - Log a small audit entry (dispatch_ref, qty, item, timestamp) for the owner.

 C. React page: apps/web/src/pages/restaurant/erpStore/ErpStoreDashboard.jsx
    - Settings modal: ERP base URL + API key (POST to /api/restaurant/erp-store/config).
    - "Products ready from Maker": table of ready_stock + selling_price.
    - "My stock": InventoryItem.currentStock for the items fed from the ERP.
    - A "Sync now" button calling /api/restaurant/erp-store/sync.
    - A sync-status indicator (Synced / Offline). Use the existing UI/theme
      components (Tailwind + icons) already in apps/web/src/components.

 D. Units / shipping
    - For new InventoryItem created from an ERP dispatch, pick the restaurant's
      default InventoryUnit (or reuse an existing unit id). Assume same unit.

CONSTRAINTS
 - Keep everything in the Fastify/Prisma/React conventions already in the repo.
 - Never expose the ERP apiKey to the browser bundle or logs.
 - Follow the existing error envelope: { success, data|error }.
 - Add the necessary Prisma models/migrations (use the local SQLite schema
   variant apps/api/prisma/schema.sqlite.prisma / schema.electron.sqlite.prisma
   when appropriate).

DELIVERABLES
 Implement A, B, C with the schema changes, and wire the route + page. Make it
 minimal, correct, idempotent, and consistent with the existing code style.

END PROMPT
```

---

## After the AI runs it — what to verify
1. Build the EXE: `npm run build:exe` (in `D:\restorent\apps`).
2. In the restaurant app Settings → ERP, enter the **ERP URL** (`…/api/v1/store`)
   and the **API key** you copied from the ERP Settings → Store/Restaurant page.
3. Create a product + a dispatch in the ERP → within 60s the restaurant's
   InventoryItem stock should rise, and the ERP dispatch status flips to `received`.

## Useful reference files (for the AI)
- ERP API implementation: `D:\ERP\backend\app\routes\restaurant_api.py`
- Ready-to-reuse JS client you can copy in: `D:\ERP\restaurant-client\`
  (`api/erpStore.js`, `local/localStore.js`, `local/syncEngine.js`)
- ERP-side doc: `D:\ERP\docs\RESTAURANT_INTEGRATION.md`