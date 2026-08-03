/**
 * SmartGoNext Universal ERP — Desktop EXE Main Process
 *
 * Phases covered:
 *   Phase 8  — License enforcement, trial expiry, device registration
 *   Phase 9  — Auto-update & DB migration
 *   Phase 10 — Local DB, offline mode, background sync
 *   Phase 11 — Cloud backup IPC handlers, restore-on-reinstall flow
 *   Phase 12 — Server-command processing (force-logout, announcement, etc.)
 */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

const { verifyLicense, checkForUpdates, runMigrations } = require('./license/verify');
const { initLocalDB } = require('./local-db/setup');
const { startSyncQueue, getSyncStatus, restoreFromCloud, triggerCloudBackup, addToQueue } = require('./sync/queue');

const APP_DIR    = path.join(process.env.APPDATA || process.env.HOME, '.smartgonext');
const TOKEN_FILE = path.join(APP_DIR, 'token.json');

let mainWindow;
let syncInterval;
let licenseCheckInterval;

// ─────────────────────────────────────────────────────────────────────────────
// Window factory
// ─────────────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:    1280,
    height:   800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
    titleBarStyle: 'default',
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../frontend/dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup license check
// ─────────────────────────────────────────────────────────────────────────────
async function verifyOnStartup() {
  const result = await verifyLicense();
  if (!result.valid) {
    if (result.reason === 'expired' || result.reason === 'trial_expired') {
      mainWindow?.webContents?.send('license-expired', result);
    } else if (result.reason === 'suspended') {
      mainWindow?.webContents?.send('license-expired', {
        ...result,
        message: 'Your license has been suspended. Please contact support.',
      });
    } else {
      // Unknown / tampered — quit immediately
      dialog.showErrorBox(
        'License Error',
        result.message || 'License validation failed. The application will now close.'
      );
      app.quit();
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Check whether this is a fresh reinstall that needs a cloud restore
// ─────────────────────────────────────────────────────────────────────────────
function isFirstInstall() {
  const markerFile = path.join(APP_DIR, '.initialized');
  return !fs.existsSync(markerFile);
}

function markInstallComplete() {
  if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(path.join(APP_DIR, '.initialized'), new Date().toISOString());
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createWindow();

  // 1. Initialise local SQLite database
  await initLocalDB();

  // 2. Verify license (blocks or shows expired UI if invalid)
  const licenseResult = await verifyOnStartup();

  // 3. Check for software updates (Phase 9)
  const updateResult = await checkForUpdates();
  if (updateResult?.needs_update) {
    mainWindow?.webContents?.send('update-available', updateResult);
  }

  // 4. Run any pending DB schema migrations (Phase 9)
  await runMigrations();

  // 5. Phase 11: Offer restore on first install
  if (isFirstInstall() && licenseResult.valid) {
    const tokenExists = fs.existsSync(TOKEN_FILE);
    if (tokenExists) {
      // Notify the renderer — it will prompt the user to choose restore vs. fresh start
      mainWindow?.webContents?.send('offer-cloud-restore');
    }
    markInstallComplete();
  }

  // 6. Start background sync every 5 minutes (Phase 10 + 11 backup)
  syncInterval = setInterval(() => startSyncQueue(), 5 * 60 * 1000);
  // Run one sync immediately after startup
  setTimeout(() => startSyncQueue(), 10 * 1000);

  // 7. Periodic license re-verification every 30 minutes (Phase 13 hardening)
  licenseCheckInterval = setInterval(async () => {
    const res = await verifyLicense();
    if (!res.valid) {
      mainWindow?.webContents?.send('license-expired', res);
    }
  }, 30 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  clearInterval(syncInterval);
  clearInterval(licenseCheckInterval);
  if (process.platform !== 'darwin') app.quit();
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC handlers — license & updates
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('get-license-info', async () => {
  return await verifyLicense();
});

ipcMain.handle('check-update', async () => {
  return await checkForUpdates();
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC handlers — sync & local DB
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('get-sync-status', async () => {
  return await getSyncStatus();
});

ipcMain.handle('add-to-sync-queue', async (_event, { recordType, recordId, data }) => {
  return addToQueue(recordType, recordId, data);
});

ipcMain.handle('db-query', async (_event, { action, table, payload }) => {
  const { dbQuery } = require('./local-db/setup');
  return await dbQuery(action, table, payload);
});

ipcMain.handle('force-sync-now', async () => {
  await startSyncQueue();
  return await getSyncStatus();
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC handlers — Phase 11: Cloud Backup & Restore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger an immediate cloud backup outside the normal sync cycle.
 * Used by the "Backup Now" button in Settings.
 */
ipcMain.handle('trigger-backup-now', async () => {
  try {
    const { dbQuery } = require('./local-db/setup');
    const queue = { lastBackupAt: null, lastBackupId: null };
    await triggerCloudBackup(queue);
    return { success: true, lastBackupAt: queue.lastBackupAt, backupId: queue.lastBackupId };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

/**
 * Get backup status: last backup time and last backup ID from the sync queue file.
 */
ipcMain.handle('get-backup-status', async () => {
  return await getSyncStatus();
});

/**
 * Phase 11 — Restore from cloud.
 * Called when the user confirms "Restore my data" after a reinstall.
 * This replays the full decrypted snapshot into local SQLite.
 * Returns progress info so the renderer can show a progress dialog.
 */
ipcMain.handle('restore-from-cloud', async () => {
  try {
    mainWindow?.webContents?.send('restore-progress', { step: 'connecting', pct: 5 });
    const result = await restoreFromCloud();
    mainWindow?.webContents?.send('restore-progress', { step: 'complete', pct: 100 });
    return { success: true, ...result };
  } catch (e) {
    mainWindow?.webContents?.send('restore-progress', { step: 'error', pct: 0, error: e.message });
    return { success: false, error: e.message };
  }
});

/**
 * Cancel / skip restore — user chose to start fresh.
 * Just marks the install as complete with an empty local DB.
 */
ipcMain.handle('skip-restore', async () => {
  markInstallComplete();
  return { success: true };
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC handlers — Phase 12: Server-pushed admin commands
// These are also processed automatically inside the sync queue (queue.js),
// but the renderer can directly invoke them for testing / UI feedback.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Force logout: clear local token and reload to the login page.
 */
ipcMain.handle('execute-force-logout', async (_event, { reason }) => {
  try {
    if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
  } catch (_) {}
  mainWindow?.webContents?.send('force-logout', { reason: reason || 'Logged out remotely.' });
  return { success: true };
});

/**
 * Show an in-app announcement banner received from the server.
 */
ipcMain.handle('show-announcement', async (_event, { title, message, level }) => {
  mainWindow?.webContents?.send('server-announcement', { title, message, level });
  return { success: true };
});
