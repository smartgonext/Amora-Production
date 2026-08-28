"""
Security Utilities — Phase 13
Provides:
  - Input sanitisation helpers
  - Simple in-process rate limiter (decorator)
  - Audit log helper (write one AuditLog row safely from any route)
  - Password strength validator
  - Safe redirect validator (prevent open-redirect)
"""
import re
import time
import html
import hashlib
from collections import defaultdict
from functools import wraps
from datetime import datetime
from typing import Optional

from flask import request, jsonify, current_app

# ---------------------------------------------------------------------------
# Input sanitisation
# ---------------------------------------------------------------------------

def sanitise_string(value: str, max_length: int = 255) -> str:
    """Strip leading/trailing whitespace, escape HTML entities, truncate."""
    if not isinstance(value, str):
        return ''
    return html.escape(value.strip())[:max_length]


def sanitise_phone(value: str) -> str:
    """Keep only digits, +, spaces, dashes, parentheses. Max 20 chars."""
    if not isinstance(value, str):
        return ''
    return re.sub(r'[^\d\+\s\-\(\)]', '', value)[:20]


def sanitise_email(value: str) -> str:
    """Lowercase, strip, basic format check. Returns '' if invalid."""
    if not isinstance(value, str):
        return ''
    v = value.strip().lower()[:100]
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', v):
        return ''
    return v


def sanitise_integer(value, min_val: int = 0, max_val: int = 2_147_483_647) -> Optional[int]:
    """Coerce to int within bounds, return None if invalid."""
    try:
        v = int(value)
        return max(min_val, min(max_val, v))
    except (TypeError, ValueError):
        return None


def sanitise_decimal(value, min_val: float = 0.0, max_val: float = 999_999_999.99) -> Optional[float]:
    try:
        v = float(value)
        return max(min_val, min(max_val, round(v, 4)))
    except (TypeError, ValueError):
        return None


ALLOWED_SORT_FIELDS_RE = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_.]{0,49}$')

def sanitise_sort_field(value: str) -> Optional[str]:
    """Allowlist sort field names to prevent ORDER BY injection."""
    if not value or not ALLOWED_SORT_FIELDS_RE.match(value):
        return None
    return value


def sanitise_sort_dir(value: str) -> str:
    return 'asc' if str(value).lower() != 'desc' else 'desc'


# ---------------------------------------------------------------------------
# Password strength validator
# ---------------------------------------------------------------------------

def validate_password_strength(password: str) -> list:
    """Return list of error strings; empty list = password is strong enough."""
    errors = []
    if len(password) < 8:
        errors.append('Password must be at least 8 characters.')
    if not re.search(r'[A-Z]', password):
        errors.append('Password must contain at least one uppercase letter.')
    if not re.search(r'[a-z]', password):
        errors.append('Password must contain at least one lowercase letter.')
    if not re.search(r'\d', password):
        errors.append('Password must contain at least one digit.')
    if not re.search(r'[^a-zA-Z0-9]', password):
        errors.append('Password must contain at least one special character.')
    return errors


# ---------------------------------------------------------------------------
# In-process rate limiter  (per-IP, configurable window + max hits)
# Suitable for single-process deployments. For multi-process, swap the
# _hits dict for a Redis counter (redis.incr + redis.expire).
# ---------------------------------------------------------------------------

_hits: dict = defaultdict(list)   # { "ip:endpoint" -> [timestamp, ...] }


def rate_limit(max_calls: int = 60, window_seconds: int = 60):
    """
    Decorator — apply to a Flask route to enforce a rate limit.

    Usage:
        @app.route('/api/v1/auth/login', methods=['POST'])
        @rate_limit(max_calls=10, window_seconds=60)
        def login(): ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if current_app.config.get('TESTING') and not current_app.config.get('RATELIMIT_ENABLED'):
                return fn(*args, **kwargs)
            ip  = request.remote_addr or 'unknown'
            key = f"{ip}:{request.endpoint}"
            now = time.monotonic()

            # Prune expired entries
            _hits[key] = [t for t in _hits[key] if now - t < window_seconds]

            if len(_hits[key]) >= max_calls:
                return jsonify({
                    "data": None, "meta": None,
                    "errors": [f"Too many requests. Max {max_calls} per {window_seconds}s."]
                }), 429

            _hits[key].append(now)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# Audit log helper
# ---------------------------------------------------------------------------

def write_audit_log(
    tenant_id: Optional[int],
    user_id: Optional[int],
    entity_type: str,
    entity_id: Optional[int],
    action: str,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
) -> None:
    """
    Write a row to audit_logs. Swallows its own exceptions so it never
    breaks the calling request — audit failure is logged to stderr only.
    """
    try:
        from app.extensions import db
        from app.models.audit import AuditLog
        log = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            old_values_json=old_values,
            new_values_json=new_values,
            ip_address=request.remote_addr if request else None,
            timestamp=datetime.utcnow(),
        )
        db.session.add(log)
        # Flush without a new commit so the caller controls the transaction
        db.session.flush()
    except Exception as exc:
        import sys
        print(f"[AuditLog] Failed to write audit row: {exc}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Safe redirect validator
# ---------------------------------------------------------------------------

SAFE_REDIRECT_RE = re.compile(r'^/[^/\\]')   # must start with single /

def safe_redirect_url(url: str, fallback: str = '/dashboard') -> str:
    """Reject open-redirect attempts; only allow same-origin relative paths."""
    if url and SAFE_REDIRECT_RE.match(url):
        return url
    return fallback
