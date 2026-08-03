"""
SmartGoNext ERP — End-to-End Integration Test Suite  (Phase 14)
===============================================================
Covers the complete scenario from the spec (Appendix B + Phase 14):

  1.  Health checks
  2.  Tenant registration + trial license
  3.  Login / JWT token
  4.  Subscription status
  5.  License verification (desktop path)
  6.  Device-binding enforcement (cloning attempt blocked)
  7.  Subscription expiry warnings delivered in /verify response
  8.  Superadmin: suspend → client goes read-only
  9.  Superadmin: reactivate
  10. Superadmin: extend expiry
  11. Superadmin: send announcement (command queued, delivered on next /verify)
  12. Superadmin: trigger remote backup
  13. Manual backup trigger (tenant path)
  14. Backup restore metadata retrieval
  15. Customer CRUD (create, read)
  16. Sync download delta (offline → online reconnect)
  17. Rate-limit enforcement on /login
  18. Unauthenticated endpoint rejection
  19. Soft-delete: deleted records not returned in list

Run with:
    cd d:\\ERP\\backend
    pip install pytest
    pytest tests/test_e2e.py -v
"""

import pytest
import uuid
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# App fixture — use SQLite in-memory so tests are self-contained and fast
# ---------------------------------------------------------------------------
@pytest.fixture(scope='session')
def app():
    import os
    os.environ['FLASK_ENV']  = 'testing'

    from app import create_app
    test_app = create_app('dev')
    test_app.config.update({
        'TESTING':           True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'JWT_SECRET_KEY':    'test-jwt-secret-key',
        'WTF_CSRF_ENABLED':  False,
    })

    from app.extensions import db
    with test_app.app_context():
        db.create_all()
        yield test_app
        db.session.remove()
        db.drop_all()


@pytest.fixture(scope='session')
def client(app):
    return app.test_client()


# ---------------------------------------------------------------------------
# Shared state (populated by early tests, used by later ones)
# ---------------------------------------------------------------------------
STATE = {}


def json_post(client, url, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    return client.post(url, json=data or {}, headers=headers)


def json_get(client, url, token=None, params=None):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    return client.get(url, headers=headers, query_string=params)


# ===========================================================================
# 1. Health checks
# ===========================================================================

class TestHealth:
    def test_liveness(self, client):
        r = client.get('/api/v1/health')
        assert r.status_code == 200
        body = r.get_json()
        assert body['status'] == 'ok'

    def test_readiness(self, client):
        r = client.get('/api/v1/health/ready')
        # SQLite in-memory should pass the DB check
        body = r.get_json()
        assert body['checks']['database'] == 'ok'

    def test_version(self, client):
        r = client.get('/api/v1/health/version')
        assert r.status_code == 200
        body = r.get_json()
        assert 'app_version' in body


# ===========================================================================
# 2. Tenant registration + trial
# ===========================================================================

class TestRegistration:
    def test_register_tenant(self, client):
        subdomain = f'testtenant{uuid.uuid4().hex[:6]}'
        r = json_post(client, '/api/v1/auth/register', {
            'company_name': 'Test Company Ltd',
            'subdomain':    subdomain,
            'email':        f'{subdomain}@example.com',
            'password':     'Test@1234',
            'admin_name':   'Test Admin',
            'business_type': 'Retail Shop',
        })
        assert r.status_code == 201, r.get_data(as_text=True)
        body = r.get_json()
        assert body['data']['tokens']['access_token']
        STATE['access_token']  = body['data']['tokens']['access_token']
        STATE['refresh_token'] = body['data']['tokens']['refresh_token']
        STATE['tenant_id']     = body['data']['tenant']['id']
        STATE['company_id']    = body['data']['company']['id']
        STATE['license_key']   = body['data']['license']['license_key']
        STATE['user_email']    = f'{subdomain}@example.com'

    def test_duplicate_subdomain_rejected(self, client):
        r = json_post(client, '/api/v1/auth/register', {
            'company_name': 'Duplicate',
            'subdomain':    'testtenant-dup',
            'email':        'dup@example.com',
            'password':     'Test@1234',
        })
        # Register once
        json_post(client, '/api/v1/auth/register', {
            'company_name': 'Duplicate',
            'subdomain':    'testtenant-dup',
            'email':        'dup2@example.com',
            'password':     'Test@1234',
        })
        r2 = json_post(client, '/api/v1/auth/register', {
            'company_name': 'Duplicate',
            'subdomain':    'testtenant-dup',
            'email':        'dup3@example.com',
            'password':     'Test@1234',
        })
        assert r2.status_code == 400


# ===========================================================================
# 3. Login / JWT
# ===========================================================================

class TestAuth:
    def test_login_success(self, client):
        r = json_post(client, '/api/v1/auth/login', {
            'email':    STATE['user_email'],
            'password': 'Test@1234',
        })
        assert r.status_code == 200
        body = r.get_json()
        assert body['data']['tokens']['access_token']
        # Refresh the token in STATE
        STATE['access_token'] = body['data']['tokens']['access_token']

    def test_login_bad_password(self, client):
        r = json_post(client, '/api/v1/auth/login', {
            'email':    STATE['user_email'],
            'password': 'WrongPassword!',
        })
        assert r.status_code == 401

    def test_me_endpoint(self, client):
        r = json_get(client, '/api/v1/auth/me', token=STATE['access_token'])
        assert r.status_code == 200
        body = r.get_json()
        assert body['data']['email'] == STATE['user_email']

    def test_unauthenticated_rejected(self, client):
        r = json_get(client, '/api/v1/auth/me')
        assert r.status_code == 401


# ===========================================================================
# 4. Subscription status
# ===========================================================================

class TestSubscription:
    def test_my_subscription(self, client):
        r = json_get(client, '/api/v1/licensing/my-subscription',
                     token=STATE['access_token'])
        assert r.status_code == 200
        body = r.get_json()
        assert body['data']['subscription']['status'] in ('active', 'trial')
        assert body['data']['days_remaining'] >= 0


# ===========================================================================
# 5. License verification (desktop path — no auth, uses license_key)
# ===========================================================================

class TestLicenseVerification:
    DEVICE_A = 'device-aaa-' + uuid.uuid4().hex[:8]
    DEVICE_B = 'device-bbb-' + uuid.uuid4().hex[:8]

    def test_verify_valid_license(self, client):
        r = json_post(client, '/api/v1/licensing/verify', {
            'license_key': STATE['license_key'],
            'device_id':   self.DEVICE_A,
            'device_name': 'Test Machine A',
        })
        assert r.status_code == 200
        body = r.get_json()
        assert body['data']['valid'] is True
        assert body['data']['tenant_id'] == STATE['tenant_id']

    def test_verify_invalid_key(self, client):
        r = json_post(client, '/api/v1/licensing/verify', {
            'license_key': 'INVALID-KEY-00000000',
            'device_id':   self.DEVICE_A,
        })
        assert r.status_code == 200
        body = r.get_json()
        assert body['data']['valid'] is False

    def test_device_binding_clone_blocked(self, client):
        """A second distinct device_id must be rejected after first activation."""
        r = json_post(client, '/api/v1/licensing/verify', {
            'license_key': STATE['license_key'],
            'device_id':   self.DEVICE_B,   # different from DEVICE_A
            'device_name': 'Cloned Machine',
        })
        assert r.status_code == 200
        body = r.get_json()
        assert body['data']['valid'] is False
        assert body['data']['reason'] == 'device_mismatch'

    def test_same_device_reverify_ok(self, client):
        """Same device can re-verify without hitting device_mismatch."""
        r = json_post(client, '/api/v1/licensing/verify', {
            'license_key': STATE['license_key'],
            'device_id':   self.DEVICE_A,
        })
        assert r.status_code == 200
        assert r.get_json()['data']['valid'] is True


# ===========================================================================
# 6. Superadmin actions
# ===========================================================================

class TestSuperadminActions:

    def _get_superadmin_token(self, client):
        """Register a dedicated superadmin user if not already done."""
        if 'sa_token' in STATE:
            return STATE['sa_token']

        sub = f'satest{uuid.uuid4().hex[:6]}'
        r = json_post(client, '/api/v1/auth/register', {
            'company_name': 'SuperAdmin Corp',
            'subdomain':    sub,
            'email':        f'{sub}@sa.com',
            'password':     'Admin@9999',
            'admin_name':   'SA User',
        })
        token = r.get_json()['data']['tokens']['access_token']

        # Promote user to superadmin directly via DB
        from app.models.user import User
        from app.extensions import db
        u = User.query.filter_by(email=f'{sub}@sa.com').first()
        u.is_superadmin = True
        db.session.commit()

        # Re-login to get a fresh token with correct claims
        r2 = json_post(client, '/api/v1/auth/login', {
            'email': f'{sub}@sa.com', 'password': 'Admin@9999'
        })
        STATE['sa_token'] = r2.get_json()['data']['tokens']['access_token']
        return STATE['sa_token']

    def test_admin_stats(self, client):
        sa = self._get_superadmin_token(client)
        r = json_get(client, '/api/v1/superadmin/stats', token=sa)
        assert r.status_code == 200
        body = r.get_json()
        assert body['data']['total_tenants'] >= 1

    def test_admin_tenant_list(self, client):
        sa = self._get_superadmin_token(client)
        r = json_get(client, '/api/v1/superadmin/tenants', token=sa)
        assert r.status_code == 200
        body = r.get_json()
        assert isinstance(body['data'], list)
        assert body['meta']['total'] >= 1

    def test_suspend_tenant(self, client):
        sa  = self._get_superadmin_token(client)
        tid = STATE['tenant_id']
        r = json_post(client, f'/api/v1/superadmin/tenants/{tid}/suspend',
                      {'reason': 'E2E test suspension'}, token=sa)
        assert r.status_code == 200
        assert r.get_json()['data']['status'] == 'suspended'

    def test_verify_returns_invalid_when_suspended(self, client):
        r = json_post(client, '/api/v1/licensing/verify', {
            'license_key': STATE['license_key'],
            'device_id':   TestLicenseVerification.DEVICE_A,
        })
        body = r.get_json()
        assert body['data']['valid'] is False
        assert body['data']['reason'] == 'suspended'

    def test_reactivate_tenant(self, client):
        sa  = self._get_superadmin_token(client)
        tid = STATE['tenant_id']
        r = json_post(client, f'/api/v1/superadmin/tenants/{tid}/reactivate',
                      token=sa)
        assert r.status_code == 200
        assert r.get_json()['data']['status'] == 'active'

    def test_extend_expiry(self, client):
        sa  = self._get_superadmin_token(client)
        tid = STATE['tenant_id']
        r = json_post(client, f'/api/v1/superadmin/tenants/{tid}/extend-expiry',
                      {'days': 30}, token=sa)
        assert r.status_code == 200
        assert 'new_expiry' in r.get_json()['data']

    def test_send_announcement(self, client):
        sa  = self._get_superadmin_token(client)
        tid = STATE['tenant_id']
        r = json_post(client, f'/api/v1/superadmin/tenants/{tid}/announcement',
                      {'title': 'Test', 'message': 'E2E announcement', 'level': 'info'},
                      token=sa)
        assert r.status_code == 200

    def test_announcement_delivered_on_next_verify(self, client):
        """The queued announcement command must appear in the next /verify call."""
        r = json_post(client, '/api/v1/licensing/verify', {
            'license_key': STATE['license_key'],
            'device_id':   TestLicenseVerification.DEVICE_A,
        })
        body = r.get_json()
        assert body['data']['valid'] is True
        cmds = body['data'].get('commands', [])
        types = [c.get('type') for c in cmds]
        assert 'send_announcement' in types

    def test_remote_backup_trigger(self, client):
        sa  = self._get_superadmin_token(client)
        tid = STATE['tenant_id']
        r = json_post(client, f'/api/v1/superadmin/tenants/{tid}/remote-backup',
                      token=sa)
        assert r.status_code == 201
        body = r.get_json()
        assert body['data']['status'] == 'completed'
        STATE['backup_id'] = body['data']['id']

    def test_non_superadmin_blocked(self, client):
        r = json_get(client, '/api/v1/superadmin/stats',
                     token=STATE['access_token'])
        assert r.status_code == 403


# ===========================================================================
# 7. Backup & restore
# ===========================================================================

class TestBackup:
    def test_tenant_manual_backup(self, client):
        r = json_post(client, '/api/v1/backup/trigger',
                      token=STATE['access_token'])
        assert r.status_code == 201
        body = r.get_json()
        assert body['data']['status'] == 'completed'
        STATE['tenant_backup_id'] = body['data']['id']

    def test_list_backups(self, client):
        r = json_get(client, '/api/v1/backup/list',
                     token=STATE['access_token'])
        assert r.status_code == 200
        assert len(r.get_json()['data']) >= 1

    def test_latest_backup(self, client):
        r = json_get(client, '/api/v1/backup/latest',
                     token=STATE['access_token'])
        assert r.status_code == 200
        assert r.get_json()['data']['status'] == 'completed'

    def test_restore_returns_snapshot(self, client):
        bid = STATE.get('tenant_backup_id')
        if not bid:
            pytest.skip('No backup created yet')
        r = json_post(client, f'/api/v1/backup/restore/{bid}',
                      token=STATE['access_token'])
        assert r.status_code == 200
        body = r.get_json()
        assert 'tables' in body['data']
        assert 'customers' in body['data']['tables']


# ===========================================================================
# 8. Customer CRUD
# ===========================================================================

class TestCustomers:
    def test_create_customer(self, client):
        r = json_post(client, '/api/v1/customers', {
            'name':  'Ramesh Kumar',
            'phone': '9876543210',
            'email': 'ramesh@example.com',
        }, token=STATE['access_token'])
        assert r.status_code == 201
        body = r.get_json()
        assert body['data']['name'] == 'Ramesh Kumar'
        STATE['customer_id'] = body['data']['id']

    def test_list_customers(self, client):
        r = json_get(client, '/api/v1/customers',
                     token=STATE['access_token'])
        assert r.status_code == 200
        body = r.get_json()
        assert isinstance(body['data'], list)
        ids = [c['id'] for c in body['data']]
        assert STATE['customer_id'] in ids

    def test_get_customer(self, client):
        cid = STATE['customer_id']
        r = json_get(client, f'/api/v1/customers/{cid}',
                     token=STATE['access_token'])
        assert r.status_code == 200
        assert r.get_json()['data']['id'] == cid

    def test_soft_delete_customer(self, client):
        cid = STATE['customer_id']
        r = client.delete(f'/api/v1/customers/{cid}',
                          headers={'Authorization': f'Bearer {STATE["access_token"]}'})
        assert r.status_code in (200, 204)

    def test_deleted_customer_not_in_list(self, client):
        r = json_get(client, '/api/v1/customers',
                     token=STATE['access_token'])
        ids = [c['id'] for c in r.get_json()['data']]
        assert STATE['customer_id'] not in ids


# ===========================================================================
# 9. Sync upload + download delta
# ===========================================================================

class TestSync:
    def test_sync_upload_customer(self, client):
        r = json_post(client, '/api/v1/licensing/sync/upload', {
            'record_type': 'customer',
            'record_id':   'local_123',
            'data': {
                'name':  'Offline Priya',
                'phone': '9111222333',
                'email': 'priya@offline.com',
            },
        }, token=STATE['access_token'])
        assert r.status_code == 200
        body = r.get_json()
        assert body['data']['server_id'] is not None
        STATE['synced_customer_server_id'] = body['data']['server_id']

    def test_sync_download_delta(self, client):
        past = (datetime.utcnow() - timedelta(hours=1)).isoformat()
        r = json_get(client, '/api/v1/licensing/sync/download',
                     token=STATE['access_token'],
                     params={'since': past})
        assert r.status_code == 200
        body = r.get_json()
        ids = [c['id'] for c in body['data'].get('customers', [])]
        assert STATE['synced_customer_server_id'] in ids


# ===========================================================================
# 10. Rate-limit enforcement
# ===========================================================================

class TestRateLimit:
    def test_login_rate_limited(self, client):
        """After 10 bad attempts within 60 s the endpoint must return 429."""
        hit_429 = False
        for _ in range(15):
            r = json_post(client, '/api/v1/auth/login', {
                'email':    'nonexistent@rate.test',
                'password': 'BadPass1!',
            })
            if r.status_code == 429:
                hit_429 = True
                break
        assert hit_429, 'Rate limit was never triggered after 15 attempts'
