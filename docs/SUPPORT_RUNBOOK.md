# SmartGoNext Universal ERP — Internal Support Runbook
### Confidential - For Internal Support/Operations Teams Only

This document contains step-by-step procedures for the internal support team to handle customer escalations, manual overrides, system updates, and disaster recovery operations.

---

## 1. Manual License Overrides
When a customer cannot verify their license (e.g., hardware changes causing device ID mismatches or urgent offline needs), follow these steps:

### 1.1 Device ID Mismatch Override
If a tenant gets the error "License key already bound to another device", do NOT have them reinstall.
1. Log into the platform Superadmin panel.
2. Search for the Tenant using their subdomain or registered email.
3. Locate the active license entry.
4. Click **Reset Registered Device**.
   - *Backend alternative via SQL:*
     ```sql
     UPDATE devices SET is_active = 0, deleted_at = NOW() WHERE tenant_id = <TENANT_ID> AND is_active = 1;
     UPDATE licenses SET device_id = NULL WHERE tenant_id = <TENANT_ID>;
     ```
5. Ask the customer to re-run their application and click "Activate". It will bind to the new device ID automatically.

### 1.2 Manual Expiry Date Extension
If a customer needs temporary access during a payment billing issue:
1. Locate the tenant's license in the Admin Panel.
2. Select **Extend Expiry Date** and specify the number of days (e.g., +7 days).
3. The next time the client runs the automatic check (every launch or 24 hours), the desktop client will dynamically update its local SQLite license token.

---

## 2. Emergency Update Pushed
If a critical hotfix must be rolled out immediately to all desktop installations:

1. Build and package the new EXE installer:
   ```bash
   npm run build:win
   ```
2. Upload the installer to the CDN storage bucket and invalidate the cache.
3. Update `latest.json` on the updates server.
4. From the Superadmin dashboard, select **Broadcast Announcement / Force Update**.
5. Set the announcement target to `ALL` with type `FORCE_UPDATE`.
6. On the next heartbeat/verification request, the clients will immediately download and trigger the local update installer.

---

## 3. Interpreting the Admin Dashboard
During a support call, review the following key indicators on the Admin dashboard:
* **License Status:** Active / Suspended / Expired.
* **Trial Status:** Days remaining or bills generated count.
* **Sync Health:** Compare the customer's local database version timestamp with the central cloud ledger. If it's more than 24 hours behind, check the client's network connectivity or sync log warnings.

---

## 4. Disaster Recovery & Snapshot Restore
If a customer reports a local database crash or data corruption:
1. Instruct the customer to perform a fresh installation of the desktop client.
2. In the setup screen, select **Restore from Cloud Backup**.
3. Have them enter their original Email, Password, and License Key.
4. The desktop client will query the cloud endpoint `/api/v1/licensing/backup/latest` to retrieve their encrypted SQLite database snapshot.
5. The local application automatically decrypts the snapshot file using the client key and replaces the corrupted local database file.
6. Verify data parity by comparing recent invoice totals on the dashboard.
