# Restaurant EXE ↔ ERP Integration (restaurant-client)

This folder is a **ready-to-drop-in client** for your **Restaurant / Billing EXE**
that connects to the SmartGoNext ERP's Store Dispatch API. The EXE's own stock
lives here; the ERP owns the manufacturer's stock.

> The ERP side (API) is implemented in `backend/app/routes/restaurant_api.py` and
> documented in `docs/RESTAURANT_INTEGRATION.md`.

## Layout

```
restaurant-client/
├── api/erpStore.js          # framework-agnostic API client (fetch-based)
├── local/localStore.js     # local stock ledger + applied-dispatch guard (idempotent)
├── local/syncEngine.js     # background sync: refresh ready products + apply dispatches
└── frontend/StoreDashboard.jsx  # React page (Tailwind + react-icons/fi)
```

## The 3 files you need in your EXE

1. **`api/erpStore.js`** — talks to the ERP (`/api/v1/store`) with `X-API-Key`.
   Provide it in both **Node (Electron main) and the browser**: it uses the global
   `fetch`, takes the base URL + api key, and returns a typed client.
   - Works anywhere: `const client = createErpStoreClient(baseUrl, apiKey);`
   - Methods: `health()`, `getReadyProducts()`, `dispatch(items)`,
     `listDispatches(status)`, `getDispatch(id)`, `receiveDispatch(id)`.

2. **`local/localStore.js`** — the EXE's OWN stock + `dispatch_ref` guard.
   Default storage is `localStorage`; in an Electron **main** process pass any
   object with `getItem/setItem/removeItem` (e.g. a map backed by your local DB).
   Methods: `addStock`, `upsertProduct`, `isDispatchApplied`, `markDispatchApplied`,
   `logEntry`, `getConfig/saveConfig`.

3. **`local/syncEngine.js`** — `createSyncEngine(client, local, { onStatus })`.
   On start and every 60s it (a) refreshes ready products, (b) pulls
   `status=dispatched`, applies each dispatch's `receivable_lines` to local stock
   **once**, logs it, and marks it `received` in the ERP. Offline-safe (queues, no
   double-count), never blocks billing.

## Electron wiring (main process example)

```js
// main.js
const { createErpStoreClient } = require('../restaurant-client/api/erpStore');
const { createLocalStore }    = require('../restaurant-client/local/localStore');
const { createSyncEngine }    = require('../restaurant-client/local/syncEngine');

const client = createErpStoreClient(cfg.erpBaseUrl, cfg.apiKey);
const local  = createLocalStore();     // uses in-memory+browser storage
const sync   = createSyncEngine(client, local, { onStatus: updateStatus });
sync.start();
```

## React page

`frontend/StoreDashboard.jsx` is a full page (dark-mode aware, Tailwind, uses
`react-icons/fi` + `react-hot-toast`) that:

- has a **Settings** modal for **ERP base URL + API key**,
- shows **Products ready at maker** with live stock,
- has a **Transfer** button (POST `/store/dispatch`) — the ERP reduces its stock,
  the EXE adds the same product (same name) to **My store stock**,
- **auto-detects new items** (NEW badge), and
- shows recent transfers + a sync indicator.

Wire it into your router:

```js
import StoreDashboard from './restaurant-client/frontend/StoreDashboard';
<Route path="/store" element={<StoreDashboard />} />
```

The three `.js` helpers are framework-agnostic and also work in a non-Electron
(browser/PWA/other) EXE — only `fetch` is required.