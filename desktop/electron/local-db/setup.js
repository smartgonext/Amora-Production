/**
 * SmartGoNext ERP — Local Database (Phase 13: Security Hardening)
 *
 * The entire JSON database is encrypted at rest with AES-256-GCM using a
 * per-device key so that even if the file is copied off the machine the data
 * is unreadable without the same hardware fingerprint + app secret.
 *
 * Structure on disk: base64( IV[16] | GCMTag[16] | CipherText )
 * The plaintext is a JSON string of the full DB object.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const os     = require('os');

const APP_DIR = path.join(process.env.APPDATA || process.env.HOME, '.smartgonext');
const DB_DIR  = path.join(APP_DIR, 'data');
const DB_PATH = path.join(DB_DIR, 'erp_local_db.enc');  // .enc = encrypted

const ALG    = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;

// ---------------------------------------------------------------------------
// Key derivation (mirrors license/verify.js but separate purpose)
// ---------------------------------------------------------------------------
function _dbKey() {
  const deviceId = (() => {
    const raw = [os.hostname(), os.platform(), os.arch(), os.userInfo().username,
                 (os.cpus()[0] || {}).model || 'unknown'].join('|');
    return crypto.createHash('sha256').update(raw).digest('hex');
  })();
  const appSecret = process.env.APP_LICENSE_SECRET || 'smartgonext-license-secret-change-in-prod';
  return crypto.createHmac('sha256', appSecret)
    .update(`${deviceId}:local-db`)
    .digest(); // 32 bytes
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt helpers
// ---------------------------------------------------------------------------
function _encryptDB(obj) {
  const key    = _dbKey();
  const iv     = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
  const enc    = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function _decryptDB(b64) {
  try {
    const key     = _dbKey();
    const buf     = Buffer.from(b64, 'base64');
    const iv      = buf.subarray(0, IV_LEN);
    const tag     = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc     = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALG, key, iv, { authTagLength: TAG_LEN });
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    return JSON.parse(plain);
  } catch (_) {
    // Auth tag mismatch = tampered or from wrong device
    console.error('[LocalDB] Decryption failed — file may be tampered or from a different device.');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Default structure
// ---------------------------------------------------------------------------
const DEFAULT_DB = {
  products:   [],
  customers:  [],
  invoices:   [],
  suppliers:  [],
  employees:  [],
  sync_metadata: { db_schema_version: '1.0', last_pulled_at: null },
};

// ---------------------------------------------------------------------------
// Read / write (encrypted)
// ---------------------------------------------------------------------------
function readDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf8');
      const db = _decryptDB(content);
      if (db) return db;
      // Decryption failed — return in-memory default to avoid crash;
      // real data was irrecoverable (tampered). Cloud restore should be offered.
      console.warn('[LocalDB] Could not decrypt local DB. Starting fresh in-memory.');
    }
  } catch (e) {
    console.error('[LocalDB] Read error:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}

function writeDB(data) {
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, _encryptDB(data), 'utf8');
    return true;
  } catch (e) {
    console.error('[LocalDB] Write error:', e.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------
async function initLocalDB() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  if (!fs.existsSync(DB_PATH)) {
    writeDB(DEFAULT_DB);
    console.log('[LocalDB] Fresh encrypted database created at:', DB_PATH);
  } else {
    // Verify we can decrypt the existing file on startup
    const db = readDB();
    if (!db.sync_metadata) {
      console.warn('[LocalDB] Reinitialising corrupted database.');
      writeDB(DEFAULT_DB);
    } else {
      console.log('[LocalDB] Encrypted database loaded. Schema:', db.sync_metadata.db_schema_version);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------
async function dbQuery(action, table, payload = {}) {
  const db = readDB();
  if (!Array.isArray(db[table])) db[table] = [];

  switch (action) {

    case 'select': {
      return db[table].filter(item =>
        Object.entries(payload).every(([k, v]) => item[k] === v)
      );
    }

    case 'insert': {
      const newItem = {
        id:         payload.id || (Date.now() + Math.floor(Math.random() * 1000)),
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db[table].push(newItem);
      writeDB(db);
      return newItem;
    }

    case 'update': {
      const { id, ...rest } = payload;
      let found = null;
      db[table] = db[table].map(item => {
        if (item.id === id || item.server_id === id) {
          found = { ...item, ...rest, updated_at: new Date().toISOString() };
          return found;
        }
        return item;
      });
      if (found) writeDB(db);
      return found;
    }

    case 'delete': {
      const { id } = payload;
      let deleted = false;
      db[table] = db[table].filter(item => {
        if (item.id === id || item.server_id === id) { deleted = true; return false; }
        return true;
      });
      if (deleted) writeDB(db);
      return deleted;
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Schema migrations
// ---------------------------------------------------------------------------
async function applyMigration(fromVersion, toVersion) {
  console.log(`[LocalDB] Migrating schema ${fromVersion} → ${toVersion}`);
  const db = readDB();

  const from = parseFloat(fromVersion);

  if (from < 1.0) {
    db.sync_metadata.db_schema_version = '1.0';
  }
  if (from < 1.1) {
    (db.products || []).forEach(p => {
      if (p.wholesale_price === undefined) p.wholesale_price = p.selling_price;
    });
  }
  if (from < 1.2) {
    if (!db.suppliers)  db.suppliers  = [];
    if (!db.employees)  db.employees  = [];
  }

  db.sync_metadata.db_schema_version = toVersion;
  writeDB(db);
  console.log(`[LocalDB] Migration to ${toVersion} complete.`);
  return true;
}

module.exports = { initLocalDB, dbQuery, applyMigration };
