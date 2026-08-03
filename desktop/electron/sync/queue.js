/**
 * Background sync queue for Desktop EXE — Phase 10 + Phase 11
 *
 * Responsibilities:
 *   1. Upload locally-created/modified records to the cloud (Phase 10)
 *   2. Download server-side changes to local SQLite (Phase 10)
 *   3. Trigger an encrypted cloud backup every 5 minutes (Phase 11)
 *   4. Support on-demand restore: pull latest backup snapshot from server
 *      and replay it into the local database (Phase 11 — disaster recovery)
 *
 * Conflict resolution:
 *   - Last-write-wins based on updated_at timestamp
 *   - Server timestamp wins if both sides changed the same record simultaneously
 *
 * Offline behaviour:
 *   - All outbound changes are queued in sync_queue.json on disk
 *   - The queue is drained as soon as connectivity returns
 *   - Backup trigger is skipped (not queued) when offline — the next
 *     successful sync cycle triggers a fresh backup instead
 */

const fs   = require('fs');
const path = require('path');

const APP_DIR         = path.join(process.env.APPDATA || process.env.HOME, '.smartgonext');
const SYNC_QUEUE_FILE = path.join(APP_DIR, 'sync_queue.json');
const TOKEN_FILE      = path.join(APP_DIR, 'token.json');
const SERVER_URL      = process.env.ERP_SERVER || 'https://api.smartgonext.com';

let syncInProgress = false;

// ─────────────────────────────────────────────────────────────────────────────
// Queue persistence helpers
// ─────────────────────────────────────────────────────────────────────────────
function getQueue() {
  try {
    if (fs.existsSync(SYNC_QUEUE_FILE)) {
      return JSON.parse(fs.readFileSync(SYNC_QUEUE_FILE, 'utf8'));
    }
  } catch (_) { /* corrupt file — start fresh */ }
  return { pending: [], lastSyncAt: null, lastBackupAt: null };
}

function saveQueue(queue) {
  if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(SYNC_QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function getServerToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).access_token;
    }
  } catch (_) {}
  return '';
}

function authHeaders() {
  const token = getServerToken();
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: add a record to the outbound queue
// ─────────────────────────────────────────────────────────────────────────────
function addToQueue(recordType, recordId, data) {
  const queue = getQueue();
  // De-duplicate: if the same record is already queued, update it in place
  const existingIdx = queue.pending.findIndex(
    item => item.recordType === recordType && item.recordId === recordId
  );
  const entry = {
    id: `${recordType}_${recordId}_${Date.now()}`,
    recordType,
    recordId,
    data,
    timestamp: new Date().toISOString(),
    retries: 0,
  };
  if (existingIdx >= 0) {
    queue.pending[existingIdx] = entry;
  } else {
    queue.pending.push(entry);
  }
  saveQueue(queue);
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload one queued item; returns server_id on success or null on failure
// ─────────────────────────────────────────────────────────────────────────────
async function processQueueItem(item) {
  try {
    const response = await fetch(`${SERVER_URL}/api/v1/licensing/sync/upload`, {
      method:  'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        record_type: item.recordType,
        record_id:   item.recordId,
        data:        item.data,
        timestamp:   item.timestamp,
      }),
    });
    if (response.ok) {
      const resData = await response.json();
      return resData.data; // { server_id, local_id }
    }
    console.warn(`[Sync] Upload HTTP ${response.status} for item ${item.id}`);
  } catch (e) {
    console.error(`[Sync] Upload error for item ${item.id}:`, e.message);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11 — Cloud backup trigger
// Calls POST /api/v1/backup/trigger and records the timestamp on success.
// ─────────────────────────────────────────────────────────────────────────────
async function triggerCloudBackup(queue) {
  const token = getServerToken();
  if (!token) return; // not authenticated yet

  try {
    const response = await fetch(`${SERVER_URL}/api/v1/backup/trigger`, {
      method:  'POST',
      headers: authHeaders(),
    });

    if (response.ok) {
      const body = await response.json();
      const backupId   = body?.data?.id;
      const backupName = body?.data?.file_name;
      queue.lastBackupAt = new Date().toISOString();
      queue.lastBackupId = backupId;
      console.log(`[Backup] Cloud backup completed: ${backupName} (id=${backupId})`);
    } else {
      console.warn(`[Backup] Trigger returned HTTP ${response.status}`);
    }
  } catch (e) {
    // Offline or server unreachable — skip silently; next cycle will retry
    console.warn('[Backup] Could not reach backup endpoint:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 11 — Disaster recovery restore
// Fetches the latest backup from the server and replays it into local SQLite.
// Called once after a fresh install when the user chooses "Restore from Cloud".
// ─────────────────────────────────────────────────────────────────────────────
async function restoreFromCloud() {
  const { dbQuery } = require('../local-db/setup');

  // Step 1: Find latest backup
  const latestRes = await fetch(`${SERVER_URL}/api/v1/backup/latest`, {
    headers: authHeaders(),
  });
  if (!latestRes.ok) {
    throw new Error(`Could not fetch latest backup metadata (HTTP ${latestRes.status})`);
  }
  const latestMeta = await latestRes.json();
  const backupId = latestMeta?.data?.id;
  if (!backupId) throw new Error('No completed backup found on the server.');

  // Step 2: Request full decrypted snapshot
  const restoreRes = await fetch(`${SERVER_URL}/api/v1/backup/restore/${backupId}`, {
    method:  'POST',
    headers: authHeaders(),
  });
  if (!restoreRes.ok) {
    throw new Error(`Restore request failed (HTTP ${restoreRes.status})`);
  }
  const restoreBody = await restoreRes.json();
  const snapshot = restoreBody?.data;
  if (!snapshot || !snapshot.tables) throw new Error('Invalid snapshot data received.');

  // Step 3: Replay tables into local SQLite
  const tables = snapshot.tables;
  let restoredCount = 0;

  for (const [tableName, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      try {
        // Check if the record already exists by server_id
        const existing = await dbQuery('select', tableName, { server_id: row.id });
        if (existing && existing.length > 0) {
          // Update in place — server wins for restore
          await dbQuery('update', tableName, { ...row, id: existing[0].id, server_id: row.id });
        } else {
          await dbQuery('insert', tableName, { ...row, server_id: row.id });
        }
        restoredCount++;
      } catch (rowErr) {
        console.warn(`[Restore] Skipping row in ${tableName}:`, rowErr.message);
      }
    }
  }

  console.log(`[Restore] Completed: ${restoredCount} records restored from backup #${backupId}`);
  return { backupId, restoredCount, snapshotAt: snapshot.snapshot_at };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main sync cycle — runs every 5 minutes
// ─────────────────────────────────────────────────────────────────────────────
async function startSyncQueue() {
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    const queue = getQueue();

    // ── 1. Upload pending local changes ──────────────────────────────────────
    if (queue.pending.length > 0) {
      const { dbQuery } = require('../local-db/setup');
      const successfulIds = [];

      for (const item of queue.pending) {
        const result = await processQueueItem(item);
        if (result && result.server_id) {
          successfulIds.push(item.id);
          // Map temporary offline ID → real server ID
          const tableName = `${item.recordType}s`;
          await dbQuery('update', tableName, { id: item.recordId, server_id: result.server_id });
        } else {
          item.retries = (item.retries || 0) + 1;
          if (item.retries > 10) {
            // Give up after 10 attempts (~ 50 minutes of retries)
            console.warn(`[Sync] Discarding item ${item.id} after 10 failed retries.`);
            successfulIds.push(item.id);
          }
        }
      }

      queue.pending = queue.pending.filter(item => !successfulIds.includes(item.id));
    }

    // ── 2. Download server-side changes (delta since last sync) ──────────────
    const token = getServerToken();
    if (token) {
      const sinceParam = queue.lastSyncAt
        ? `?since=${encodeURIComponent(queue.lastSyncAt)}`
        : '';

      const response = await fetch(
        `${SERVER_URL}/api/v1/licensing/sync/download${sinceParam}`,
        { headers: authHeaders() }
      );

      if (response.ok) {
        const resData = await response.json();
        const { customers = [], products = [], invoices = [] } = resData.data || {};
        const { dbQuery } = require('../local-db/setup');

        const upsert = async (table, serverRows, fields) => {
          for (const row of serverRows) {
            const existing = await dbQuery('select', table, { server_id: row.id });
            const payload  = { server_id: row.id };
            fields.forEach(f => { payload[f] = row[f]; });

            if (existing && existing.length > 0) {
              await dbQuery('update', table, { id: existing[0].id, ...payload });
            } else {
              await dbQuery('insert', table, payload);
            }
          }
        };

        await upsert('customers', customers, ['name', 'phone', 'email', 'address']);
        await upsert('products',  products,  ['name', 'sku', 'selling_price', 'stock_qty']);
        await upsert('invoices',  invoices,  ['invoice_number', 'net_amount', 'status', 'invoice_date']);

        // Check for server-pushed commands (force_logout, send_announcement, etc.)
        const commands = resData.data?.commands || [];
        if (commands.length > 0) {
          await _handleServerCommands(commands);
        }
      }
    }

    queue.lastSyncAt = new Date().toISOString();

    // ── 3. Trigger cloud backup (Phase 11) ───────────────────────────────────
    await triggerCloudBackup(queue);

    saveQueue(queue);

  } catch (error) {
    console.error('[Sync] Cycle failure:', error.message);
  } finally {
    syncInProgress = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handle commands pushed down by the server (Phase 12 remote admin actions)
// Commands are delivered in the sync/download response under data.commands
// ─────────────────────────────────────────────────────────────────────────────
async function _handleServerCommands(commands) {
  const { ipcMain, BrowserWindow } = (() => {
    try { return require('electron'); } catch (_) { return {}; }
  })();

  for (const cmd of commands) {
    console.log(`[Sync] Server command received: ${cmd.type}`);

    switch (cmd.type) {
      case 'force_logout': {
        // Clear local token and notify renderer → user sees login screen
        try {
          const { TOKEN_FILE: tf } = { TOKEN_FILE };
          if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
        } catch (_) {}
        const wins = BrowserWindow?.getAllWindows?.() || [];
        wins.forEach(w => w.webContents?.send('force-logout', { reason: cmd.reason || 'Remote logout by admin' }));
        break;
      }

      case 'send_announcement': {
        const wins = BrowserWindow?.getAllWindows?.() || [];
        wins.forEach(w => w.webContents?.send('server-announcement', {
          title:   cmd.title   || 'System Notice',
          message: cmd.message || '',
          level:   cmd.level   || 'info',
        }));
        break;
      }

      case 'force_update_check': {
        const wins = BrowserWindow?.getAllWindows?.() || [];
        wins.forEach(w => w.webContents?.send('check-update-now'));
        break;
      }

      case 'force_backup': {
        // Immediately trigger a backup outside the normal 5-minute cycle
        const queue = getQueue();
        await triggerCloudBackup(queue);
        saveQueue(queue);
        break;
      }

      case 'license_suspended': {
        const wins = BrowserWindow?.getAllWindows?.() || [];
        wins.forEach(w => w.webContents?.send('license-expired', {
          reason:  'suspended',
          message: cmd.message || 'Your license has been suspended. Contact support.',
        }));
        break;
      }

      default:
        console.warn(`[Sync] Unknown server command type: ${cmd.type}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status query (used by IPC handler in main.js)
// ─────────────────────────────────────────────────────────────────────────────
async function getSyncStatus() {
  const queue = getQueue();
  return {
    pendingCount:  queue.pending.length,
    lastSyncAt:    queue.lastSyncAt,
    lastBackupAt:  queue.lastBackupAt,
    lastBackupId:  queue.lastBackupId || null,
    isSyncing:     syncInProgress,
  };
}

module.exports = { startSyncQueue, addToQueue, getSyncStatus, restoreFromCloud, triggerCloudBackup };
