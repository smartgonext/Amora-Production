# Maker → Restaurant Integration (Store Dispatch API)

Connects the **SmartGoNext ERP (bakery / manufacturer side)** to your client's
**Restaurant / Billing software (a local EXE that has internet)**.

## What it does (your concept)

1. The ERP turns **raw material → finished products** (Manufacturing engine).
2. Finished products are **dispatched from the bakery to restaurant outlets/stores**.
3. The restaurant EXE talks to the ERP over the internet and:
   - Ask a question: **"How many products are ready?"**
   - Receives product details (name, price, stock, batch, expiry).
   - When a product **moves from manufacturing → the store**, a call happens and:
        * **ERP adjusts its stock down** (records the movement in the Stock
          Ledger and saves the dispatch record), and
        * the **restaurant software increases its own stock**.
4. Each restaurant/outlet gets its own **API key** so it only ever sees its own data.

---

## Setup (one time, inside the ERP)

> These calls require a normal logged-in ERP user (JWT token = `Authorization: Bearer <token>`).

**Register the restaurant outlet to get its API key:**

```
POST /api/v1/store/channels
Authorization: Bearer <admin_token>
Body: { "name": "Downtown Restaurant", "code": "DOWNTOWN1", "location": "Chennai" }
```

Response:
```json
{ "data": { "id": 1, "name": "Downtown Restaurant", "code": "DOWNTOWN1",
             "api_key": "90b719f2...bfdd557", "is_active": true }, "errors": null }
```

> Save the `api_key` — it is the EXE's password/credential. It is shown only here
> (and when you rotate it). Give one API key to each restaurant EXE.

To list outlets, rotate a key, or see history:
- `GET  /api/v1/store/channels`                        → list my outlets
- `POST /api/v1/store/channels/<id>/rotate-key`        → issue a new API key
- `GET  /api/v1/store/channels/<id>/dispatches`        → dispatch history for one outlet

---

## API Reference (used by the Restaurant EXE)

**Base URL:** `https://<your-erp-host>/api/v1/store`
**Auth header (every call):** `X-API-Key: <the api_key above>`

All responses use this envelope: `{ "data": ..., "errors": [...] }`.

### 1) How many products are ready?

```
GET /api/v1/store/products
Headers: X-API-Key: <key>
```

Returns only **finished products** (raw materials & services are excluded) that
currently have stock, plus their batch/expiry details.

```json
{ "data": {
    "store_code": "DOWNTOWN1",
    "synced_at": "2026-08-28T08:23:17",
    "count": 1,
    "products": [{
      "product_id": 7,
      "name": "Vanilla Tub",
      "sku": null,
      "gst_rate": 18.0,
      "selling_price": 220.0,
      "is_batch_tracked": false,
      "ready_stock": 50,
      "stock_from_manufacturing": 50,
      "batches": [{ "batch_no": "VT-100", "quantity": 50,
                    "mfg_date": null, "expiry_date": "2026-12-31" }]
    }]
  }, "errors": null }
```

Optional query param `?include_zero_stock=1` to also list products with 0 stock.

### 2) Move product from manufacturing → store (the transfer call)

```
POST /api/v1/store/dispatch
Headers: X-API-Key: <key>
Body: { "items": [ { "product_id": 7, "qty": 12 } ], "notes": "First delivery" }
```

What this single call DOES in the ERP (in one atomic transaction):
- Validates there is enough stock; fails cleanly otherwise.
- **Reduces** `Product.current_stock`.
- For **batch-tracked** products: reduces the batch quantity (FEFO — oldest expiry
  first) and returns that batch/expiry to the restaurant.
- Writes a `StockLedger` `Transfer` movement (record saved).
- Creates a `StoreDispatch` + line items (`status = dispatched`).
- Returns everything the restaurant EXE needs to **increase its own stock**.

```json
{ "data": {
    "id": 1, "dispatch_ref": "DSP-745C782601", "status": "dispatched",
    "dispatched_at": "2026-08-28T08:23:17", "total_qty": 12,
    "items": [ { "product_id": 7, "product_name": "Vanilla Tub", "qty": 12,
                 "batch_no": "VT-100", "expiry_date": "2026-12-31",
                 "selling_price": 220.0 } ],
    "receivable_lines": [ { "product_id": 7, "product_name": "Vanilla Tub",
                 "sku": null, "qty": 12, "batch_no": "VT-100",
                 "mfg_date": null, "expiry_date": "2026-12-31",
                 "selling_price": 220.0 } ]
  }, "errors": null }
```

**This is the special unit of work the EXE must apply to its own stock:** loop
over `receivable_lines` and ADD each qty to the matching local product.

> Idempotency: if you re-send the same `dispatch_id`, it returns the existing
> dispatch instead of applying twice.

### 3) List dispatches sent to this store (sync / history)

```
GET /api/v1/store/dispatches                # all
GET /api/v1/store/dispatches?status=dispatched
GET /api/v1/store/dispatches/<id>           # one dispatch + items
```

### 4) Confirm the goods arrived (optional)

```
POST /api/v1/store/dispatches/<id>/receive
```
Marks the dispatch `received` in the ERP (closed the loop on the ERP side).

### 5) Connection health check

```
GET /api/v1/store/health
```

---

## Recommended EXE flow (pseudo)

1. On startup / every N minutes:
   `GET /store/products` → refresh the "ready products" grid + their stock.
2. When a dispatch has been created in the ERP (bakery shipped product):
   `GET /store/dispatches?status=dispatched` → new items arrive.
3. For each new dispatch: read `receivable_lines`, **add** qty to your local
   stock, store the `dispatch_ref` so you don't apply it twice.
4. Optionally call `POST /store/dispatches/<id>/receive` to acknowledge receipt
   (this keeps the ERP's dispatch list accurate).
---

## 📋 READY-TO-PASTE PROMPT FOR YOUR RESTAURANT SOFTWARE AI AGENT

Paste the block below into your restaurant/billing software's AI assistant to
have it build the matching client side. (Copy everything between the
`BEGIN PROMPT` / `END PROMPT` lines.)

```
BEGIN PROMPT

You are helping integrate a Restaurant / Billing desktop application (a local
EXE with internet access) with a remote ERP that belongs to the manufacturer
(bakery) that supplies this restaurant.

CONTEXT / GOAL
The manufacturer produces finished products and sends them to this restaurant
store/outlet. The EXE must:
 1) Show the operator "how many products are ready" at the manufacturer.
 2) When products are dispatched from the manufacturer to this store, fetch the
    dispatch and INCREASE this restaurant's local stock accordingly.
 3) Keep everything idempotent so nothing is applied twice.

API ENDPOINTS (base URL configured in settings, e.g.
   https://<erp-host>/api/v1/store)
Every call below must send header:
   X-API-Key: <this restaurant's api key, stored in EXE settings>

 1. GET  /store/products
      Optional: ?include_zero_stock=1
      Response: data.products[] with fields
        product_id, name, sku, gst_rate, selling_price, is_batch_tracked,
        ready_stock (== stock_from_manufacturing),
        batches[](batch_no, quantity, mfg_date, expiry_date).
      USE: display the ready-products grid and its stock. Only finished products
      with ready_stock > 0 are returned by default.

 2. POST /store/dispatch
      Body: { "items": [ { "product_id": <id>, "qty": <n> } ], "notes": "..." }
      Response: data with id, dispatch_ref, status, total_qty,
        items[] and data.receivable_lines[]. Each receivable line has:
          product_id, product_name, sku, qty, batch_no, mfg_date, expiry_date,
          selling_price.
      RULE: after this call the ERP has ALREADY reduced ITS stock. The EXE must
      now INCREASE its own local stock by "qty" for each receivable line,
      matched by product_id (create/map the product if missing).
      RULE: if the EXE re-sends the same request, include the returned data.id
      as "dispatch_id" in the body so the ERP returns the existing dispatch
      instead of creating a new one. Never double-count.

 3. GET  /store/dispatches
      Optional: ?status=dispatched
      USE: periodic sync to find dispatches the restaurant hasn't applied yet.
      For each un-applied dispatch: add the receivable lines to local stock and
      record the dispatch_ref as processed.

 4. GET  /store/dispatches/<id>          Detail of a single dispatch.
 5. POST /store/dispatches/<id>/receive  Acknowledge arrival (sets status
      "received" in the ERP). Call after applying stock locally.

 6. GET  /store/health                   Simple online check.

IMPLEMENTATION REQUIREMENTS
 - Add a "Settings" screen: ERP base URL + API key, save to local config.
 - Add a "Products from Manufacturer / Ready Products" view showing ready_stock,
   selling_price, and batch/expiry when available.
 - Add background sync (every ~60s and on app start) that:
     (a) refreshes ready products, and
     (b) pulls /store/dispatches?status=dispatched and applies pending ones.
 - Persist a local ledger of applied dispatch_refs for idempotency.
 - When applying a dispatch, log (product, qty, batch, ref, timestamp) for audit.
 - Error handling: on network failure keep pending dispatches and retry later;
   never block billing. Show a small "sync status" indicator.
 - Map the ERP product_id into the EXE's catalogue so billed items link back to
   the manufacturer's product.

DELIVERABLES
 Generate the code for the sync module, the ready-products view, the local
 settings (base URL + API key), and the idempotent stock-application logic,
 matched to the EXE's existing tech stack and code style.

END PROMPT
```

---

## Security notes
- Keep each restaurant's `api_key` secret (like a password). Rotate it from the
  ERP if it leaks (`POST /store/channels/<id>/rotate-key`).
- Dispatch reduces ERP stock only when enough stock exists, and always records
  the movement — so ERP stock and the ledger stay accurate.
- Use HTTPS on the production host so the API key travels encrypted.