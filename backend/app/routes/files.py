import uuid
import datetime
from pathlib import Path
from flask import Blueprint, request, jsonify, session, send_file, current_app
from werkzeug.utils import secure_filename
from ..config import Config
from ..db import get_db
from ..crypto_service import crypto_service
from ..file_validator import validate_file_content, sanitize_original_filename
from ..audit_service import AuditService
from .auth import login_required

files_bp = Blueprint("files", __name__, url_prefix="/api/files")

def generate_registration_id() -> str:
    """Generate high-entropy, structured registration ID."""
    timestamp_prefix = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    rand_suffix = uuid.uuid4().hex[:8].upper()
    return f"REG-{timestamp_prefix}-{rand_suffix}"

@files_bp.route("/register", methods=["POST"])
@login_required
def register_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded in form data."}), 400

    file_obj = request.files["file"]
    if not file_obj or file_obj.filename == "":
        return jsonify({"error": "Selected file has no filename."}), 400

    # Privacy level and metadata
    privacy_level = request.form.get("privacy_level", "PRIVATE").upper()
    if privacy_level not in {"PRIVATE", "VERIFY_ONLY", "PUBLIC"}:
        privacy_level = "PRIVATE"

    tags = (request.form.get("tags") or "").strip()
    description = (request.form.get("description") or "").strip()

    # Server-side validation (extension, size, magic bytes)
    is_valid, err_msg, mime_type = validate_file_content(file_obj.stream, file_obj.filename)
    if not is_valid:
        return jsonify({"error": err_msg}), 400

    # Calculate SHA-256 hash stream
    file_hash = crypto_service.compute_sha256_stream(file_obj.stream)

    # Get file size
    file_obj.stream.seek(0, 2)
    file_size = file_obj.stream.tell()
    file_obj.stream.seek(0)

    # Generate IDs
    registration_id = generate_registration_id()
    original_filename = sanitize_original_filename(file_obj.filename)
    stored_filename = f"{uuid.uuid4().hex}.bin"
    uploads_dir = Path(current_app.config.get("UPLOADS_DIR", Config.UPLOADS_DIR))
    uploads_dir.mkdir(parents=True, exist_ok=True)
    stored_filepath = uploads_dir / stored_filename

    # Save physical file outside public web root with random name
    file_obj.save(str(stored_filepath))

    user_id = session["user_id"]
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    db = get_db()
    cursor = db.cursor()

    # Save to files table
    cursor.execute(
        """
        INSERT INTO files (
            registration_id, original_filename, stored_filename, file_size, 
            mime_type, file_hash, owner_id, privacy_level, tags, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            registration_id, original_filename, stored_filename, file_size,
            mime_type, file_hash, user_id, privacy_level, tags, description, timestamp
        )
    )

    # Create canonical provenance payload for cryptographic signing
    canonical_payload_dict = {
        "created_at": timestamp,
        "file_hash": file_hash,
        "file_size": file_size,
        "mime_type": mime_type,
        "original_filename": original_filename,
        "owner_id": user_id,
        "registration_id": registration_id
    }
    canonical_str = crypto_service.canonical_json(canonical_payload_dict)
    rsa_signature = crypto_service.sign_payload(canonical_str)
    pub_fingerprint = crypto_service.public_key_fingerprint

    # Store provenance record
    cursor.execute(
        """
        INSERT INTO provenance_records (
            registration_id, file_hash, canonical_payload, rsa_signature, public_key_fingerprint, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (registration_id, file_hash, canonical_str, rsa_signature, pub_fingerprint, timestamp)
    )
    db.commit()

    # Append to hash-chained audit trail
    audit_block = AuditService.record_event(
        action="FILE_REGISTERED",
        actor_id=user_id,
        resource_id=registration_id,
        details={
            "registration_id": registration_id,
            "original_filename": original_filename,
            "file_size": file_size,
            "file_hash": file_hash,
            "privacy_level": privacy_level
        },
        db=db
    )

    return jsonify({
        "message": "File registered and provenance record digitally signed.",
        "file": {
            "registration_id": registration_id,
            "original_filename": original_filename,
            "file_size": file_size,
            "mime_type": mime_type,
            "file_hash": file_hash,
            "privacy_level": privacy_level,
            "tags": tags,
            "description": description,
            "created_at": timestamp
        },
        "provenance": {
            "registration_id": registration_id,
            "file_hash": file_hash,
            "rsa_signature": rsa_signature,
            "public_key_fingerprint": pub_fingerprint,
            "canonical_payload": canonical_payload_dict,
            "audit_block_index": audit_block["block_index"]
        }
    }), 201

@files_bp.route("", methods=["GET"])
@login_required
def list_files():
    user_id = session["user_id"]
    is_admin = session.get("role") == "admin"
    db = get_db()
    cursor = db.cursor()

    if is_admin and request.args.get("all") == "true":
        cursor.execute(
            """
            SELECT f.*, u.username as owner_username, p.rsa_signature, p.public_key_fingerprint
            FROM files f
            JOIN users u ON f.owner_id = u.id
            LEFT JOIN provenance_records p ON f.registration_id = p.registration_id
            ORDER BY f.created_at DESC
            """
        )
    else:
        cursor.execute(
            """
            SELECT f.*, u.username as owner_username, p.rsa_signature, p.public_key_fingerprint
            FROM files f
            JOIN users u ON f.owner_id = u.id
            LEFT JOIN provenance_records p ON f.registration_id = p.registration_id
            WHERE f.owner_id = ?
            ORDER BY f.created_at DESC
            """,
            (user_id,)
        )

    rows = cursor.fetchall()
    files_list = []
    for r in rows:
        files_list.append({
            "id": r["id"],
            "registration_id": r["registration_id"],
            "original_filename": r["original_filename"],
            "file_size": r["file_size"],
            "mime_type": r["mime_type"],
            "file_hash": r["file_hash"],
            "owner_id": r["owner_id"],
            "owner_username": r["owner_username"],
            "privacy_level": r["privacy_level"],
            "tags": r["tags"],
            "description": r["description"],
            "created_at": str(r["created_at"]),
            "has_signature": bool(r["rsa_signature"]),
            "public_key_fingerprint": r["public_key_fingerprint"]
        })

    return jsonify({"files": files_list})

@files_bp.route("/<registration_id>", methods=["GET"])
def get_file_detail(registration_id: str):
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        """
        SELECT f.*, u.username as owner_username, p.canonical_payload, p.rsa_signature, p.public_key_fingerprint
        FROM files f
        JOIN users u ON f.owner_id = u.id
        LEFT JOIN provenance_records p ON f.registration_id = p.registration_id
        WHERE f.registration_id = ?
        """,
        (registration_id,)
    )
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "Provenance registration record not found."}), 404

    user_id = session.get("user_id")
    is_owner = user_id == row["owner_id"]
    is_admin = session.get("role") == "admin"

    # Privacy Enforcement
    if row["privacy_level"] == "PRIVATE" and not (is_owner or is_admin):
        return jsonify({"error": "This file is marked private by the owner. Access restricted."}), 403

    if row["privacy_level"] == "VERIFY_ONLY" and not (is_owner or is_admin):
        # Redact sensitive metadata for third-party verifiers
        return jsonify({
            "registration_id": row["registration_id"],
            "file_hash": row["file_hash"],
            "file_size": row["file_size"],
            "mime_type": row["mime_type"],
            "privacy_level": row["privacy_level"],
            "created_at": str(row["created_at"]),
            "public_key_fingerprint": row["public_key_fingerprint"],
            "rsa_signature": row["rsa_signature"],
            "redacted": True,
            "notice": "Owner identity and original filename are redacted per user privacy policy."
        })

    # Full details
    return jsonify({
        "id": row["id"],
        "registration_id": row["registration_id"],
        "original_filename": row["original_filename"],
        "file_size": row["file_size"],
        "mime_type": row["mime_type"],
        "file_hash": row["file_hash"],
        "owner_id": row["owner_id"],
        "owner_username": row["owner_username"],
        "privacy_level": row["privacy_level"],
        "tags": row["tags"],
        "description": row["description"],
        "created_at": str(row["created_at"]),
        "rsa_signature": row["rsa_signature"],
        "public_key_fingerprint": row["public_key_fingerprint"],
        "canonical_payload": row["canonical_payload"],
        "is_owner": is_owner
    })

@files_bp.route("/<registration_id>", methods=["PATCH"])
@login_required
def update_file(registration_id: str):
    data = request.get_json() or {}
    privacy_level = data.get("privacy_level")
    tags = data.get("tags")
    description = data.get("description")

    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT id, owner_id, privacy_level FROM files WHERE registration_id = ?", (registration_id,))
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "File not found."}), 404

    is_owner = session["user_id"] == row["owner_id"]
    is_admin = session.get("role") == "admin"
    if not (is_owner or is_admin):
        return jsonify({"error": "Permission denied. Only the owner or admin can edit file properties."}), 403

    updates = []
    params = []
    if privacy_level:
        if privacy_level.upper() in {"PRIVATE", "VERIFY_ONLY", "PUBLIC"}:
            updates.append("privacy_level = ?")
            params.append(privacy_level.upper())
    if tags is not None:
        updates.append("tags = ?")
        params.append(tags.strip())
    if description is not None:
        updates.append("description = ?")
        params.append(description.strip())

    if not updates:
        return jsonify({"message": "No changes specified."})

    params.append(registration_id)
    cursor.execute(f"UPDATE files SET {', '.join(updates)} WHERE registration_id = ?", tuple(params))
    db.commit()

    AuditService.record_event(
        action="FILE_PRIVACY_UPDATED",
        actor_id=session["user_id"],
        resource_id=registration_id,
        details={"updated_fields": list(data.keys())},
        db=db
    )

    return jsonify({"message": "File properties successfully updated."})

@files_bp.route("/<registration_id>/download", methods=["GET"])
@login_required
def download_file(registration_id: str):
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "SELECT stored_filename, original_filename, owner_id, mime_type FROM files WHERE registration_id = ?",
        (registration_id,)
    )
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "File record not found."}), 404

    is_owner = session["user_id"] == row["owner_id"]
    is_admin = session.get("role") == "admin"
    if not (is_owner or is_admin):
        return jsonify({"error": "Unauthorized. You do not have permission to download this file."}), 403

    uploads_dir = Path(current_app.config.get("UPLOADS_DIR", Config.UPLOADS_DIR))
    file_path = uploads_dir / row["stored_filename"]
    if not file_path.exists():
        return jsonify({"error": "Physical file does not exist on storage disk."}), 404

    AuditService.record_event(
        action="FILE_DOWNLOADED",
        actor_id=session["user_id"],
        resource_id=registration_id,
        details={"original_filename": row["original_filename"]},
        db=db
    )

    return send_file(
        str(file_path),
        as_attachment=True,
        download_name=row["original_filename"],
        mimetype=row["mime_type"]
    )
