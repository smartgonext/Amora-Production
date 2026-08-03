# SmartGoNext Universal ERP — Installation Guide

This guide covers both paths to getting SmartGoNext ERP running:
- **Path A — SaaS Web** (access via browser, no installation)
- **Path B — Desktop EXE** (Windows installer, works offline)

---

## Path A — SaaS Web

### Step 1: Register

1. Open `https://app.smartgonext.com` in your browser (Chrome, Edge, or Firefox recommended).
2. Click **Start Free Trial**.
3. Fill in:
   - Company name
   - Subdomain (e.g., `myshop` → your ERP will be at `myshop.smartgonext.com`)
   - Your email address
   - A password (min 8 characters, must include uppercase, lowercase, digit, and special character)
4. Click **Create Account**.

You will be logged in immediately with a **15-day free trial** (up to 500 bills, 1 company, 3 users).

### Step 2: Complete the Setup Wizard

The Setup Wizard runs automatically on first login. It takes about 5–10 minutes and configures:

| Step | What you set |
|---|---|
| 1 | Company name, logo, GST number, address, currency |
| 2 | Business type (Retail, Restaurant, Hospital, etc.) |
| 3 | Tax rates (GST, CGST, SGST) |
| 4–9 | Invoice, agreement, receipt, quotation, PO, and challan templates |
| 10 | Review and activate |

Once you click **Activate ERP**, the system is live. Every document type is ready to use — you never need to design templates again.

### Step 3: Upgrade to a paid plan (optional)

Go to **Settings → Subscription** and choose a plan. After payment, your account upgrades immediately with no interruption to your data.

---

## Path B — Desktop EXE (Windows)

### Requirements

| Item | Minimum |
|---|---|
| OS | Windows 10 (64-bit) or Windows 11 |
| RAM | 4 GB |
| Disk | 500 MB free space |
| Internet | Required for first install and license verification; optional thereafter (offline mode supported) |

### Step 1: Purchase or start a trial

1. Visit `https://app.smartgonext.com`.
2. Either:
   - Click **Download Free Trial** — no payment required, 15-day trial starts immediately.
   - Or complete a paid subscription purchase, then proceed to download.

### Step 2: Download the installer

After registration/purchase, go to **Downloads** in your account dashboard. Click **Download Windows Installer**. The file is named:

```
SmartGoNext-ERP-Setup-1.0.0.exe
```

The installer is digitally signed. Windows may show a SmartScreen prompt — click **More Info → Run Anyway**.

### Step 3: Install

1. Run `SmartGoNext-ERP-Setup-1.0.0.exe`.
2. Accept the license agreement.
3. Choose the installation folder (default: `C:\Program Files\SmartGoNext ERP`).
4. Click **Install**. The installer takes about 30–60 seconds.
5. Click **Finish** — the ERP launches automatically.

### Step 4: First launch

On first launch the app:

1. Connects to the SmartGoNext server to verify your license.
2. If a previous installation's cloud backup exists, you'll be prompted:
   > **"A cloud backup was found. Restore your data?"**
   - Click **Restore** to recover all your previous data (invoices, customers, products, etc.).
   - Click **Start Fresh** to begin with an empty database.
3. The Setup Wizard opens (same as Path A, Step 2 above).

### Step 5: License activation

For **trial**: the license is activated automatically — no action needed.

For **paid plans**: after payment on the website, the desktop app detects the updated license on its next server check (within 5 minutes) and unlocks automatically. No reinstall required.

### Step 6: Offline use

Once set up, the ERP works fully offline:
- Billing, sales, stock, and printing all work without internet.
- Changes are queued and uploaded automatically when internet returns.
- A cloud backup is triggered automatically after each sync cycle (~every 5 minutes when online).

### Step 7: Automatic updates

The app checks for updates on every launch. If a new version is available it downloads and installs silently, then restarts. No manual download is ever needed.

---

## Multi-device setup

Your plan defines how many devices can run the ERP simultaneously (e.g., Professional plan: 2 devices). To add a second device:

1. Install the ERP on the second machine and log in with the same account credentials.
2. The server registers the new device automatically (up to your plan's device limit).
3. Both devices sync to the same cloud data.

To free up a device slot (e.g., replacing an old PC):
- Log in to `https://app.smartgonext.com` → **Settings → Devices** → click **Deactivate** next to the old device.

---

## Trial expiry

When the 15-day trial or 500-bill limit is reached:

```
⚠ Trial Expired — ERP is now in Read-Only Mode
[Buy Now]   [Enter Licence Key]   [Exit]
```

**Your data is never deleted.** The ERP becomes read-only until you purchase a plan. After payment, the app unlocks automatically within one sync cycle (≤ 5 minutes) — no reinstall needed.

---

## Subscription expiry warnings

| Timing | Message shown |
|---|---|
| 7 days before | ⚠ Your subscription expires in 7 days |
| 3 days before | ⚠ 3 days remaining |
| 1 day before | ⚠ Expires tomorrow |
| On expiry | Subscription Expired — Read Only Mode |

---

## Uninstall

Go to **Windows Settings → Apps → SmartGoNext ERP → Uninstall**.

Your local data in `%APPDATA%\.smartgonext\` is **not deleted** by the uninstaller (your data is also safely backed up in the cloud). If you reinstall and log in, you can restore from the cloud backup.

To completely remove all local data after uninstalling:
```
%APPDATA%\.smartgonext\
```
Delete this folder manually. This does not affect your cloud data.

---

## Keyboard shortcuts reference

Press **F1** from any screen inside the ERP to open the full keyboard shortcut overlay.

Quick reference:

| Key | Action |
|---|---|
| F2 | Save current record |
| F3 | Search |
| F7 | Product lookup |
| F8 | Print current document |
| F9 | Open payment entry |
| Ctrl+N | New record |
| Ctrl+K | Command palette |
| / | Global search |
| Esc | Close modal |

---

## Getting help

- In-app: click the **?** icon or press **F1**
- Email: support@smartgonext.com
- Admin panel (for resellers/enterprise): `https://app.smartgonext.com/admin`

---

*Last updated: 2026-07-28 | Version 1.0.0*
