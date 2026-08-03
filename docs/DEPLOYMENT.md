# SmartGoNext Universal ERP — Deployment Guide

**Target audience:** DevOps / SRE / System Administrator  
**Scope:** Production deployment of the SaaS backend + desktop client distribution

---

## Architecture Overview

SmartGoNext ERP has two deployment surfaces:

1. **SaaS Backend** — Python Flask REST API + MySQL database, deployed on a cloud provider
2. **Desktop Client** — Electron EXE distributed as a signed Windows installer, auto-updates from a CDN

Both surfaces share the same backend control plane for licensing, device management, and cloud backup.

---

## Part 1 — SaaS Backend Deployment

### 1.1 Hosting Requirements

- **OS:** Ubuntu 22.04 LTS or Amazon Linux 2
- **Python:** 3.11+
- **Database:** MySQL 8.0+ (InnoDB, UTF8MB4)
- **Cache/Queue:** Redis 7+ (for Celery broker + caching layer)
- **Web Server:** Nginx (reverse proxy, TLS termination, static file serving)
- **Process Manager:** Gunicorn (WSGI server) + Supervisor/systemd (process supervision)
- **Celery Worker:** For background jobs (backups, email, reminders)

### 1.2 Infrastructure Recommendation

**Single-tenant (up to 10k tenants):**
- 1× Application server (4 vCPU, 8 GB RAM)
- 1× MySQL managed instance (db.t3.medium or equivalent)
- 1× Redis managed instance (cache.t3.micro)
- 1× S3 bucket or equivalent for backups

**Multi-region HA (10k–100k+ tenants):**
- Application tier: 3+ app servers behind an ALB/NLB
- Database: MySQL RDS Multi-AZ with read replicas
- Redis: ElastiCache cluster mode
- CDN: CloudFront for static assets + desktop installer distribution
- Monitoring: CloudWatch / Datadog / Prometheus + Grafana

### 1.3 Environment Variables

Create a `.env` file at `/opt/smartgonext-erp/backend/.env`:

```bash
FLASK_ENV=production
FLASK_APP=run.py

# Database
DATABASE_URL=mysql+pymysql://erp_user:SECURE_PASSWORD@mysql.example.com:3306/smartgonext_erp?charset=utf8mb4

# JWT
JWT_SECRET_KEY=<64-char-random-hex>
JWT_ACCESS_TOKEN_EXPIRES=1800  # 30 minutes
JWT_REFRESH_TOKEN_EXPIRES=2592000  # 30 days

# Redis (Celery broker + cache)
REDIS_URL=redis://redis.example.com:6379/0

# Backup encryption master secret
BACKUP_MASTER_SECRET=<64-char-random-hex>

# CORS (comma-separated origins)
CORS_ORIGINS=https://app.smartgonext.com,https://admin.smartgonext.com

# Email (for reminders / notifications)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxx
SMTP_FROM=noreply@smartgonext.com

# Optional: Sentry DSN for error tracking
SENTRY_DSN=https://xxxxx@sentry.io/12345
```

### 1.4 Deployment Steps

#### Step 1: Clone repo + dependencies

```bash
sudo mkdir -p /opt/smartgonext-erp
cd /opt/smartgonext-erp
git clone https://github.com/yourusername/smartgonext-erp.git .
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
```

#### Step 2: Database initialization

```bash
# Run Alembic migrations
flask db upgrade head

# (Optional) Seed initial subscription plans
python seed.py
```

#### Step 3: Run Gunicorn via systemd

Create `/etc/systemd/system/smartgonext-api.service`:

```ini
[Unit]
Description=SmartGoNext ERP API
After=network.target mysql.service redis.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/smartgonext-erp/backend
Environment="PATH=/opt/smartgonext-erp/backend/venv/bin"
EnvironmentFile=/opt/smartgonext-erp/backend/.env
ExecStart=/opt/smartgonext-erp/backend/venv/bin/gunicorn \
    --workers 4 \
    --bind 127.0.0.1:8000 \
    --timeout 120 \
    --access-logfile /var/log/smartgonext/api-access.log \
    --error-logfile /var/log/smartgonext/api-error.log \
    run:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo mkdir -p /var/log/smartgonext
sudo chown www-data:www-data /var/log/smartgonext
sudo systemctl daemon-reload
sudo systemctl enable smartgonext-api
sudo systemctl start smartgonext-api
```

#### Step 4: Celery worker service

Create `/etc/systemd/system/smartgonext-worker.service`:

```ini
[Unit]
Description=SmartGoNext ERP Celery Worker
After=network.target redis.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/smartgonext-erp/backend
Environment="PATH=/opt/smartgonext-erp/backend/venv/bin"
EnvironmentFile=/opt/smartgonext-erp/backend/.env
ExecStart=/opt/smartgonext-erp/backend/venv/bin/celery -A celery_worker.celery worker \
    --loglevel=info \
    --logfile=/var/log/smartgonext/celery-worker.log
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable smartgonext-worker
sudo systemctl start smartgonext-worker
```

#### Step 5: Nginx reverse proxy + TLS

Create `/etc/nginx/sites-available/smartgonext-api`:

```nginx
server {
    listen 80;
    server_name api.smartgonext.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.smartgonext.com;

    ssl_certificate /etc/letsencrypt/live/api.smartgonext.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.smartgonext.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /api/v1/health {
        proxy_pass http://127.0.0.1:8000;
        proxy_connect_timeout 5s;
        proxy_read_timeout 5s;
        access_log off;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/smartgonext-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 6: Health checks

```bash
curl https://api.smartgonext.com/api/v1/health
curl https://api.smartgonext.com/api/v1/health/ready
```

Both should return `200 OK`.

---

## Part 2 — Frontend Deployment (SaaS Web App)

### 2.1 Build

```bash
cd /opt/smartgonext-erp/frontend
npm install
npm run build
```

Output: `dist/` folder containing static assets.

### 2.2 Serve via Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name app.smartgonext.com;

    ssl_certificate /etc/letsencrypt/live/app.smartgonext.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.smartgonext.com/privkey.pem;

    root /opt/smartgonext-erp/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Part 3 — Desktop Client Distribution

### 3.1 Build the installer

```bash
cd /opt/smartgonext-erp/desktop/electron
npm install
npm run build:win  # or build:mac / build:linux
```

Output: `dist/SmartGoNext-ERP-Setup-1.0.0.exe`

### 3.2 Code signing (Windows)

Purchase a code-signing certificate from a trusted CA (DigiCert, Sectigo, etc.) and sign the installer:

```bash
signtool sign /f cert.pfx /p PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 SmartGoNext-ERP-Setup-1.0.0.exe
```

### 3.3 Upload to CDN

```bash
aws s3 cp SmartGoNext-ERP-Setup-1.0.0.exe s3://smartgonext-downloads/erp/v1.0.0/ --acl public-read
aws cloudfront create-invalidation --distribution-id EXXXXX --paths "/erp/v1.0.0/*"
```

Update the version manifest at:  
`s3://smartgonext-downloads/erp/latest.json`:

```json
{
  "version": "1.0.0",
  "releaseDate": "2026-07-28",
  "downloadUrl": "https://downloads.smartgonext.com/erp/v1.0.0/SmartGoNext-ERP-Setup-1.0.0.exe",
  "sha256": "<hash>",
  "releaseNotes": "Initial production release"
}
```

---

## Part 4 — Monitoring & Observability

### 4.1 Application logs

- API logs: `/var/log/smartgonext/api-*.log`
- Celery logs: `/var/log/smartgonext/celery-*.log`
- Ship to a central aggregator (ELK, Splunk, CloudWatch Logs)

### 4.2 Health endpoints

Configure load-balancer health checks:

- **Liveness:** `GET /api/v1/health` → 200 if process is alive
- **Readiness:** `GET /api/v1/health/ready` → 200 if DB + migrations are OK

### 4.3 Metrics

- Prometheus exporter: use `prometheus-flask-exporter` for request rates, latencies, error rates
- Database: monitor query times, connection pool usage
- Redis: monitor memory, eviction rate, keyspace size

### 4.4 Error tracking

Set `SENTRY_DSN` in `.env` to enable automatic exception reporting to Sentry.

---

## Part 5 — Backup & Disaster Recovery

### 5.1 Database backups

- **Automated:** RDS automated backups (7–35 day retention) + daily manual snapshot
- **Cross-region replication:** Enable for HA

### 5.2 Tenant data backups

Tenant backups are stored in `BackupLog.encrypted_payload` (inline in DB for moderate sizes).  
For large tenants, modify `backup_service.py` to upload to S3 and store only the object key in the DB.

### 5.3 Restore procedure

See `docs/SUPPORT_RUNBOOK.md` section "Disaster Recovery".

---

## Part 6 — Security Checklist

- [ ] TLS 1.2+ enforced on all endpoints
- [ ] Database credentials rotated quarterly
- [ ] JWT secret rotated annually
- [ ] Rate limiting enabled on auth endpoints
- [ ] CORS origins restricted to known domains
- [ ] All desktop installers code-signed
- [ ] Backup encryption master secret stored in a secrets manager (AWS Secrets Manager / Azure Key Vault)
- [ ] Audit logs reviewed weekly
- [ ] License verification endpoint monitored for anomalous patterns (spike in device_mismatch = cloning attempts)

---

## Part 7 — Rollback Plan

1. Identify the last known-good Git commit SHA
2. SSH into the application server
3. `cd /opt/smartgonext-erp && git checkout <SHA>`
4. `cd backend && source venv/bin/activate && flask db downgrade <previous-revision>`
5. `sudo systemctl restart smartgonext-api smartgonext-worker`
6. Verify health checks
7. Notify users via the admin announcement endpoint

---

**Document version:** 1.0  
**Last updated:** 2026-07-28  
**Maintained by:** SmartGoNext DevOps Team
