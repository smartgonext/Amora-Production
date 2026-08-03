"""
Cloud Backup & Disaster Recovery API — Phase 11
Endpoints:
  POST   /api/v1/backup/trigger           — tenant triggers a manual backup
  GET    /api/v1/backup/list              — list tenant's backup history
  GET    /api/v1/backup/latest            — meta of most recent successful backup
  POST   /api/v1/backup/restore/<id>      — get decrypted snapshot for reinstall
  POST   /api/v1/backup/remote/<tenant_id> — superadmin triggers remote backup
"""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app.extensions import db
from app.models.audit import BackupLog
from app.models.user import User
from app.services.backup_service import (
    create_backup, get_latest_backup, restore_from_backup, list_backups
)

backup_bp = Blueprint('backup', __name__)


def _current_user():
    uid = get_jwt_identity()
    return User.query.get(int(uid)) if uid else None


# ── Helper: require superadmin ─────────────────────────────────────────────
def _require_superadmin():
    user = _current_user()
    if not user or not user.is_superadmin:
        return jsonify({"data": None, "meta": None, "errors": ["Superadmin access required."]}), 403
    return None


# ── Tenant: trigger manual backup ─────────────────────────────────────────
@backup_bp.route('/trigger', methods=['POST'])
@jwt_required()
def trigger_backup():
    user = _current_user()
    if not user or not user.tenant_id:
        return jsonify({"data": None, "meta": None, "errors": ["No tenant context."]}), 403

    try:
        log = create_backup(
            tenant_id=user.tenant_id,
            backup_type='manual',
            triggered_by_user_id=user.id
        )
        return jsonify({
            "data": {
                "id": log.id,
                "file_name": log.file_name,
                "file_size": log.file_size,
                "status": log.status,
                "started_at": log.started_at.isoformat(),
                "completed_at": log.completed_at.isoformat() if log.completed_at else None,
            },
            "meta": None,
            "errors": None
        }), 201
    except Exception as e:
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 500


# ── Tenant: list backup history ────────────────────────────────────────────
@backup_bp.route('/list', methods=['GET'])
@jwt_required()
def list_tenant_backups():
    user = _current_user()
    if not user or not user.tenant_id:
        return jsonify({"data": None, "meta": None, "errors": ["No tenant context."]}), 403

    page = int(request.args.get('page', 1))
    page_size = min(int(request.args.get('page_size', 20)), 100)

    records, total = list_backups(user.tenant_id, page, page_size)

    return jsonify({
        "data": [
            {
                "id": r.id,
                "backup_type": r.backup_type,
                "file_name": r.file_name,
                "file_size": r.file_size,
                "status": r.status,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "notes": r.notes,
            }
            for r in records
        ],
        "meta": {"page": page, "page_size": page_size, "total": total},
        "errors": None
    }), 200


# ── Tenant: latest backup metadata ────────────────────────────────────────
@backup_bp.route('/latest', methods=['GET'])
@jwt_required()
def latest_backup():
    user = _current_user()
    if not user or not user.tenant_id:
        return jsonify({"data": None, "meta": None, "errors": ["No tenant context."]}), 403

    log = get_latest_backup(user.tenant_id)
    if not log:
        return jsonify({"data": None, "meta": None, "errors": ["No backup found."]}), 404

    return jsonify({
        "data": {
            "id": log.id,
            "file_name": log.file_name,
            "file_size": log.file_size,
            "status": log.status,
            "completed_at": log.completed_at.isoformat() if log.completed_at else None,
        },
        "meta": None,
        "errors": None
    }), 200


# ── Tenant / Desktop: restore snapshot ────────────────────────────────────
@backup_bp.route('/restore/<int:backup_id>', methods=['POST'])
@jwt_required()
def restore_backup(backup_id):
    """
    Returns the decrypted snapshot JSON.
    The desktop client calls this on reinstall to pull all its data back.
    """
    user = _current_user()
    if not user or not user.tenant_id:
        return jsonify({"data": None, "meta": None, "errors": ["No tenant context."]}), 403

    try:
        snapshot = restore_from_backup(backup_id, user.tenant_id)
        return jsonify({
            "data": snapshot,
            "meta": {"backup_id": backup_id, "restored_at": datetime.utcnow().isoformat()},
            "errors": None
        }), 200
    except ValueError as e:
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 400
    except Exception as e:
        return jsonify({"data": None, "meta": None, "errors": ["Restore failed: " + str(e)]}), 500


# ── Superadmin: trigger remote backup for any tenant ──────────────────────
@backup_bp.route('/remote/<int:tenant_id>', methods=['POST'])
@jwt_required()
def remote_backup(tenant_id):
    err = _require_superadmin()
    if err:
        return err

    try:
        log = create_backup(
            tenant_id=tenant_id,
            backup_type='remote',
            triggered_by_user_id=int(get_jwt_identity())
        )
        return jsonify({
            "data": {
                "id": log.id,
                "tenant_id": tenant_id,
                "file_name": log.file_name,
                "file_size": log.file_size,
                "status": log.status,
                "completed_at": log.completed_at.isoformat() if log.completed_at else None,
            },
            "meta": None,
            "errors": None
        }), 201
    except Exception as e:
        return jsonify({"data": None, "meta": None, "errors": [str(e)]}), 500


# ── Superadmin: list backups for any tenant ────────────────────────────────
@backup_bp.route('/admin/<int:tenant_id>/list', methods=['GET'])
@jwt_required()
def admin_list_backups(tenant_id):
    err = _require_superadmin()
    if err:
        return err

    page = int(request.args.get('page', 1))
    page_size = min(int(request.args.get('page_size', 20)), 100)
    records, total = list_backups(tenant_id, page, page_size)

    return jsonify({
        "data": [
            {
                "id": r.id,
                "backup_type": r.backup_type,
                "file_name": r.file_name,
                "file_size": r.file_size,
                "status": r.status,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in records
        ],
        "meta": {"page": page, "page_size": page_size, "total": total},
        "errors": None
    }), 200
