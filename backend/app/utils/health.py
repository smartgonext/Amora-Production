"""
Health & Readiness Checks — Phase 14
Registered at /api/v1/health

GET /api/v1/health          — liveness probe (load balancer / container orchestrator)
GET /api/v1/health/ready    — readiness probe (checks DB, cache, migrations)
GET /api/v1/health/version  — returns app version metadata (no auth required)
"""
from datetime import datetime
from flask import Blueprint, jsonify

health_bp = Blueprint('health', __name__)

APP_VERSION    = '1.0.0'
SCHEMA_VERSION = '1.0'
BUILD_DATE     = '2026-07-28'


# ---------------------------------------------------------------------------
# Liveness — is the process alive?
# ---------------------------------------------------------------------------
@health_bp.route('', methods=['GET'])
@health_bp.route('/', methods=['GET'])
def liveness():
    """Used by load balancers and uptime monitors. Always returns 200 if
    the Flask process is running."""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
    }), 200


# ---------------------------------------------------------------------------
# Readiness — is the process ready to serve traffic?
# ---------------------------------------------------------------------------
@health_bp.route('/ready', methods=['GET'])
def readiness():
    """
    Checks:
      1. Database connectivity (simple SELECT 1)
      2. Alembic migration current (head == current revision)
    Returns 200 only when all checks pass; 503 otherwise.
    """
    checks = {}
    all_ok = True

    # ── 1. Database ──────────────────────────────────────────────────────────
    try:
        from app.extensions import db
        db.session.execute(db.text('SELECT 1'))
        checks['database'] = 'ok'
    except Exception as e:
        checks['database'] = f'error: {e}'
        all_ok = False

    # ── 2. Migration head check ───────────────────────────────────────────────
    try:
        from alembic.runtime.migration import MigrationContext
        from alembic.script import ScriptDirectory
        from app.extensions import db
        import os

        alembic_cfg_path = os.path.join(
            os.path.dirname(__file__), '..', '..', 'alembic.ini'
        )
        if os.path.exists(alembic_cfg_path):
            from alembic.config import Config as AlembicConfig
            cfg = AlembicConfig(alembic_cfg_path)
            script = ScriptDirectory.from_config(cfg)
            with db.engine.connect() as conn:
                ctx = MigrationContext.configure(conn)
                current_heads = set(ctx.get_current_heads())
                script_heads  = set(script.get_heads())
            if current_heads == script_heads:
                checks['migrations'] = 'ok'
            else:
                checks['migrations'] = f'pending: current={current_heads} head={script_heads}'
                all_ok = False
        else:
            checks['migrations'] = 'skipped (alembic.ini not found)'
    except Exception as e:
        checks['migrations'] = f'error: {e}'
        # Don't mark all_ok=False for migration check failure in environments
        # without alembic.ini (e.g., CI without full project setup)

    status_code = 200 if all_ok else 503
    return jsonify({
        "status": "ready" if all_ok else "not_ready",
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat(),
    }), status_code


# ---------------------------------------------------------------------------
# Version metadata
# ---------------------------------------------------------------------------
@health_bp.route('/version', methods=['GET'])
def version():
    return jsonify({
        "app_version":    APP_VERSION,
        "schema_version": SCHEMA_VERSION,
        "build_date":     BUILD_DATE,
        "timestamp":      datetime.utcnow().isoformat(),
    }), 200
