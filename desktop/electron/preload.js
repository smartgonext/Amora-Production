/**
 * SmartGoNext ERP — Electron Preload Script
 * Phase 13: Security Hardening
 *
 * Exposes a narrow, typed API surface to the renderer via contextBridge.
 * The renderer never gets access to Node.js or Electron internals.
 * Every channel name is explicitly allowlisted — no wildcard passthrough.
 */
const { contextBridge, ipcRenderer } = require('electron');

// ---------------------------------------------------------------------------
// Allowlisted one-way renderer → main channels (invoke/handle)
// ---------------------------------------------------------------------------
const INVOKE_CHANNELS = new Set([
  'get-license-info',
  'check-update',
  'get-sync-status',
  'add-to-sync-queue',
  'db-query',
  'force-sync-now',
  // Phase 11 — backup
  'trigger-backup-now',
  'get-backup-status',
  'restore-from-cloud',
  'skip-restore',
  // Phase 12 — admin commands
  'execute-force-logout',
  'show-announcement',
]);

// ---------------------------------------------------------------------------
// Allowlisted one-way main → renderer channels (on)
// ---------------------------------------------------------------------------
const EVENT_CHANNELS = new Set([
  'license-expired',
  'update-available',
  'force-logout',
  'server-announcement',
  'check-update-now',
  'offer-cloud-restore',
  'restore-progress',
]);

// ---------------------------------------------------------------------------
// Safe wrappers
// ---------------------------------------------------------------------------
function safeInvoke(channel, ...args) {
  if (!INVOKE_CHANNELS.has(channel)) {
    console.error(`[Preload] Blocked unauthorised invoke channel: ${channel}`);
    return Promise.reject(new Error(`Channel not allowed: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

function safeOn(channel, callback) {
  if (!EVENT_CHANNELS.has(channel)) {
    console.error(`[Preload] Blocked unauthorised event channel: ${channel}`);
    return;
  }
  // Wrap to strip the internal Electron Event object from callback args
  ipcRenderer.on(channel, (_event, data) => callback(data));
}

function safeOnce(channel, callback) {
  if (!EVENT_CHANNELS.has(channel)) return;
  ipcRenderer.once(channel, (_event, data) => callback(data));
}

function removeListener(channel, callback) {
  ipcRenderer.removeListener(channel, callback);
}

// ---------------------------------------------------------------------------
// Exposed API
// ---------------------------------------------------------------------------
contextBridge.exposeInMainWorld('electronAPI', {
  // ── License & updates ─────────────────────────────────────────────────────
  getLicenseInfo:   ()  => safeInvoke('get-license-info'),
  checkUpdate:      ()  => safeInvoke('check-update'),

  // ── Sync ──────────────────────────────────────────────────────────────────
  getSyncStatus:    ()  => safeInvoke('get-sync-status'),
  forceSyncNow:     ()  => safeInvoke('force-sync-now'),
  addToSyncQueue:   (recordType, recordId, data) =>
    safeInvoke('add-to-sync-queue', { recordType, recordId, data }),

  // ── Local DB ──────────────────────────────────────────────────────────────
  dbQuery: (action, table, payload) =>
    safeInvoke('db-query', { action, table, payload }),

  // ── Phase 11: Backup & Restore ────────────────────────────────────────────
  triggerBackupNow:   () => safeInvoke('trigger-backup-now'),
  getBackupStatus:    () => safeInvoke('get-backup-status'),
  restoreFromCloud:   () => safeInvoke('restore-from-cloud'),
  skipRestore:        () => safeInvoke('skip-restore'),

  // ── Phase 12: Admin commands ──────────────────────────────────────────────
  executeForceLogout: (reason) =>
    safeInvoke('execute-force-logout', { reason }),
  showAnnouncement: (title, message, level) =>
    safeInvoke('show-announcement', { title, message, level }),

  // ── Server-pushed event listeners ─────────────────────────────────────────
  onLicenseExpired:     (cb) => safeOn('license-expired',     cb),
  onUpdateAvailable:    (cb) => safeOn('update-available',    cb),
  onForceLogout:        (cb) => safeOn('force-logout',        cb),
  onServerAnnouncement: (cb) => safeOn('server-announcement', cb),
  onCheckUpdateNow:     (cb) => safeOn('check-update-now',    cb),
  onOfferCloudRestore:  (cb) => safeOnce('offer-cloud-restore', cb),
  onRestoreProgress:    (cb) => safeOn('restore-progress',    cb),

  // ── Utility ───────────────────────────────────────────────────────────────
  removeListener,

  // ── Environment flag (read-only, set by main process) ─────────────────────
  isDesktop: true,
});
