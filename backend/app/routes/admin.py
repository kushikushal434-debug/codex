import os
from flask import Blueprint, request, jsonify, session
from ..config import Config
from ..db import get_db
from ..audit_service import AuditService
from .auth import admin_required

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

@admin_bp.route("/stats", methods=["GET"])
@admin_required
def get_system_stats():
    """Aggregate real-time metrics across files, verifications, users, and audit chain."""
    db = get_db()
    cursor = db.cursor()

    cursor.execute("SELECT COUNT(*) as count FROM users")
    total_users = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM files")
    total_files = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM verifications")
    total_verifications = cursor.fetchone()["count"]

    cursor.execute("SELECT result, COUNT(*) as count FROM verifications GROUP BY result")
    verif_breakdown = {r["result"]: r["count"] for r in cursor.fetchall()}

    cursor.execute("SELECT COUNT(*) as count FROM audit_logs")
    total_audit_blocks = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM audit_checkpoints")
    total_checkpoints = cursor.fetchone()["count"]

    # Calculate stored files directory size
    total_storage_bytes = 0
    if Config.UPLOADS_DIR.exists():
        for f in Config.UPLOADS_DIR.glob("*.bin"):
            try:
                total_storage_bytes += f.stat().st_size
            except OSError:
                pass

    return jsonify({
        "total_users": total_users,
        "total_files": total_files,
        "total_verifications": total_verifications,
        "verifications_breakdown": {
            "MATCH": verif_breakdown.get("MATCH", 0),
            "MODIFIED": verif_breakdown.get("MODIFIED", 0),
            "UNKNOWN": verif_breakdown.get("UNKNOWN", 0)
        },
        "total_audit_blocks": total_audit_blocks,
        "total_checkpoints": total_checkpoints,
        "storage_bytes_used": total_storage_bytes
    })

@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_users():
    """List all registered users with file registration counts."""
    db = get_db()
    cursor = db.cursor()

    cursor.execute(
        """
        SELECT u.id, u.username, u.email, u.role, u.created_at,
               COUNT(f.id) as files_count
        FROM users u
        LEFT JOIN files f ON u.id = f.owner_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        """
    )
    rows = cursor.fetchall()

    users = []
    for r in rows:
        users.append({
            "id": r["id"],
            "username": r["username"],
            "email": r["email"],
            "role": r["role"],
            "created_at": str(r["created_at"]),
            "files_count": r["files_count"]
        })

    return jsonify({"users": users})

@admin_bp.route("/users/<int:user_id>/role", methods=["PATCH"])
@admin_required
def update_user_role(user_id: int):
    """Change a user's role between 'user' and 'admin'."""
    data = request.get_json() or {}
    new_role = data.get("role")

    if new_role not in {"user", "admin"}:
        return jsonify({"error": "Role must be 'user' or 'admin'."}), 400

    if user_id == session["user_id"] and new_role != "admin":
        return jsonify({"error": "Cannot demote your own administrator account."}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT id, username, role FROM users WHERE id = ?", (user_id,))
    target = cursor.fetchone()
    if not target:
        return jsonify({"error": "Target user not found."}), 404

    cursor.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, user_id))
    db.commit()

    AuditService.record_event(
        action="USER_ROLE_CHANGED",
        actor_id=session["user_id"],
        resource_id=str(user_id),
        details={"username": target["username"], "old_role": target["role"], "new_role": new_role},
        db=db
    )

    return jsonify({"message": f"User role updated to '{new_role}'."})
