from flask import Blueprint, request, jsonify, session
from ..db import get_db
from ..audit_service import AuditService
from .auth import login_required, admin_required

audit_bp = Blueprint("audit", __name__, url_prefix="/api/audit")

@audit_bp.route("/logs", methods=["GET"])
def get_audit_logs():
    """Retrieve audit log blocks with pagination."""
    limit = min(int(request.args.get("limit", 50)), 200)
    offset = int(request.args.get("offset", 0))

    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM audit_logs")
    total_blocks = cursor.fetchone()["count"]

    cursor.execute(
        """
        SELECT a.*, u.username as actor_username
        FROM audit_logs a
        LEFT JOIN users u ON a.actor_id = u.id
        ORDER BY a.block_index DESC
        LIMIT ? OFFSET ?
        """,
        (limit, offset)
    )
    rows = cursor.fetchall()

    blocks = []
    for r in rows:
        blocks.append({
            "id": r["id"],
            "block_index": r["block_index"],
            "prev_hash": r["prev_hash"],
            "entry_hash": r["entry_hash"],
            "action": r["action"],
            "actor_id": r["actor_id"],
            "actor_username": r["actor_username"] or "SYSTEM",
            "resource_id": r["resource_id"],
            "details": r["details"],
            "timestamp": str(r["timestamp"])
        })

    return jsonify({
        "total_blocks": total_blocks,
        "limit": limit,
        "offset": offset,
        "blocks": blocks
    })

@audit_bp.route("/verify-chain", methods=["POST"])
def verify_audit_chain():
    """Execute live mathematical validation of the entire hash chain."""
    result = AuditService.verify_chain_integrity()
    return jsonify(result)

@audit_bp.route("/checkpoints", methods=["GET"])
def get_checkpoints():
    """List all digitally signed checkpoints."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM audit_checkpoints ORDER BY block_end DESC")
    rows = cursor.fetchall()
    return jsonify({"checkpoints": [dict(r) for r in rows]})

@audit_bp.route("/checkpoint", methods=["POST"])
@admin_required
def create_checkpoint():
    """Create a new signed checkpoint up to the current audit head."""
    try:
        cp = AuditService.create_checkpoint()
        return jsonify({
            "message": "Signed checkpoint created successfully.",
            "checkpoint": cp
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

@audit_bp.route("/checkpoint/<checkpoint_id>/verify", methods=["POST"])
def verify_checkpoint(checkpoint_id: str):
    """Verify an individual signed checkpoint."""
    res = AuditService.verify_checkpoint(checkpoint_id)
    return jsonify(res)

@audit_bp.route("/simulate-tamper", methods=["POST"])
@admin_required
def simulate_tamper():
    """
    Demonstration tool for academic defense:
    Artificially alters an audit record to demonstrate how the hash chain
    instantly catches and locates tampering.
    """
    data = request.get_json() or {}
    block_index = data.get("block_index")
    action = data.get("action", "tamper")  # 'tamper' or 'restore'

    db = get_db()
    cursor = db.cursor()

    if action == "tamper":
        cursor.execute("SELECT * FROM audit_logs WHERE block_index = ?", (block_index,))
        block = cursor.fetchone()
        if not block:
            return jsonify({"error": "Block not found."}), 404

        # Alter the details field without updating the cryptographic entry_hash
        tampered_details = '{"TAMPERED": true, "note": "Unauthorized record alteration injected for audit demo"}'
        cursor.execute(
            "UPDATE audit_logs SET details = ? WHERE block_index = ?",
            (tampered_details, block_index)
        )
        db.commit()

        # Re-run chain verification to show the detection
        check = AuditService.verify_chain_integrity(db)

        return jsonify({
            "message": f"Block {block_index} details modified in database.",
            "verification_after_tamper": check
        })

    return jsonify({"error": "Unknown action."}), 400
