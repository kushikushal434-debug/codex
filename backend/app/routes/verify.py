import hashlib
from flask import Blueprint, request, jsonify, session
from ..db import get_db
from ..crypto_service import crypto_service
from ..file_validator import validate_file_content
from ..audit_service import AuditService

verify_bp = Blueprint("verify", __name__, url_prefix="/api")

@verify_bp.route("/provenance/public-key", methods=["GET"])
def get_public_key():
    """Return the authority's RSA public key for independent offline signature verification."""
    return jsonify({
        "algorithm": "RSA-PSS",
        "hash_algorithm": "SHA-256",
        "mgf": "MGF1-SHA256",
        "salt_length": "MAX_LENGTH",
        "fingerprint_sha256": crypto_service.public_key_fingerprint,
        "public_key_pem": crypto_service.public_key_pem
    })

@verify_bp.route("/verify", methods=["POST"])
def verify_file():
    """
    Verify candidate file bytes or candidate SHA-256 against registration record.
    Outputs mathematically sound tri-state evaluation: MATCH, MODIFIED, or UNKNOWN.
    """
    registration_id = ""
    candidate_hash = ""

    if request.is_json and request.json:
        registration_id = (request.json.get("registration_id") or "").strip()
        candidate_hash = (request.json.get("candidate_hash") or "").strip().lower()
    else:
        registration_id = (request.form.get("registration_id") or "").strip()
        candidate_hash = (request.form.get("candidate_hash") or "").strip().lower()

    # If candidate file is uploaded, compute its hash directly
    candidate_filename = None
    candidate_file_size = None
    if "file" in request.files:
        file_obj = request.files["file"]
        if file_obj and file_obj.filename:
            candidate_filename = file_obj.filename
            is_valid, err_msg, mime = validate_file_content(file_obj.stream, file_obj.filename)
            if not is_valid:
                return jsonify({"error": f"Candidate file invalid: {err_msg}"}), 400
            file_obj.stream.seek(0, 2)
            candidate_file_size = file_obj.stream.tell()
            file_obj.stream.seek(0)
            candidate_hash = crypto_service.compute_sha256_stream(file_obj.stream).lower()

    if not candidate_hash:
        return jsonify({"error": "Either upload a candidate file or provide a SHA-256 candidate hash."}), 400

    db = get_db()
    cursor = db.cursor()
    user_id = session.get("user_id")
    is_admin = session.get("role") == "admin"

    # Verifier telemetry hash for privacy-safe audit logging
    client_ip = request.remote_addr or "127.0.0.1"
    ip_hash = hashlib.sha256(client_ip.encode("utf-8")).hexdigest()[:16]
    user_agent = request.headers.get("User-Agent", "Unknown")[:128]

    # CASE A: Explicit Registration ID provided
    if registration_id:
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
        record = cursor.fetchone()

        if not record:
            # Registration ID unknown in database
            result = "UNKNOWN"
            explanation = (
                f"Registration ID '{registration_id}' does not exist in the provenance ledger. "
                "Because there is no recorded reference, file alteration cannot be evaluated."
            )
            _log_verification(cursor, db, registration_id, candidate_hash, result, user_id, ip_hash, user_agent, explanation)
            return jsonify({
                "result": result,
                "candidate_hash": candidate_hash,
                "registration_id": registration_id,
                "signature_valid": False,
                "explanation": explanation,
                "academic_disclaimer": "Tri-state rule: An unknown registration identifier cannot attest to either match or modification.",
                "provenance": None
            })

        # Privacy gate check
        is_owner = user_id == record["owner_id"]
        if record["privacy_level"] == "PRIVATE" and not (is_owner or is_admin):
            return jsonify({
                "error": "The owner has designated this file record as PRIVATE. Public verification is restricted.",
                "result": "RESTRICTED",
                "registration_id": registration_id
            }), 403

        # Registration ID exists! Compare candidate hash with registered reference
        registered_hash = record["file_hash"].lower()

        # Verify RSA-PSS signature over provenance payload
        sig_valid = False
        if record["canonical_payload"] and record["rsa_signature"]:
            sig_valid = crypto_service.verify_signature(
                record["canonical_payload"],
                record["rsa_signature"]
            )

        if candidate_hash == registered_hash:
            result = "MATCH"
            explanation = (
                f"Cryptographic hash match confirmed against registration record {registration_id}. "
                f"The candidate file has the identical SHA-256 digest ({candidate_hash}). "
                f"The digital RSA-PSS provenance signature was verified ({'VALID' if sig_valid else 'INVALID'})."
            )
        else:
            result = "MODIFIED"
            explanation = (
                f"Cryptographic integrity mismatch. The candidate file hash does not match "
                f"the reference hash stored under registration {registration_id}. "
                f"Candidate: {candidate_hash} | Reference: {registered_hash}. "
                "The file has been modified, corrupted, or replaced since its official registration."
            )

        _log_verification(cursor, db, registration_id, candidate_hash, result, user_id, ip_hash, user_agent, explanation)

        # Build response with privacy masking if VERIFY_ONLY and not owner
        is_redacted = record["privacy_level"] == "VERIFY_ONLY" and not (is_owner or is_admin)

        provenance_data = {
            "registration_id": record["registration_id"],
            "registered_hash": record["file_hash"],
            "registered_at": str(record["created_at"]),
            "privacy_level": record["privacy_level"],
            "signature_valid": sig_valid,
            "public_key_fingerprint": record["public_key_fingerprint"],
            "owner": "REDACTED (Privacy-Preserved)" if is_redacted else record["owner_username"],
            "original_filename": "REDACTED.bin" if is_redacted else record["original_filename"],
            "file_size": record["file_size"],
            "mime_type": record["mime_type"],
            "tags": None if is_redacted else record["tags"],
            "description": None if is_redacted else record["description"],
            "redacted": is_redacted
        }

        return jsonify({
            "result": result,
            "candidate_hash": candidate_hash,
            "registration_id": registration_id,
            "signature_valid": sig_valid,
            "explanation": explanation,
            "academic_disclaimer": "CRITICAL CYBERSECURITY NOTE: A cryptographic hash match proves bit-level consistency with the reference timestamped in this system. It does not attest to the real-world factual truth or accuracy of the underlying content.",
            "provenance": provenance_data
        })

    # CASE B: No registration_id specified - lookup by candidate hash
    cursor.execute(
        """
        SELECT f.*, u.username as owner_username, p.canonical_payload, p.rsa_signature, p.public_key_fingerprint
        FROM files f
        JOIN users u ON f.owner_id = u.id
        LEFT JOIN provenance_records p ON f.registration_id = p.registration_id
        WHERE LOWER(f.file_hash) = ?
        """,
        (candidate_hash,)
    )
    records = cursor.fetchall()

    if not records:
        result = "UNKNOWN"
        explanation = (
            f"The candidate hash {candidate_hash} was not found in any registered record. "
            "Without an established baseline reference, it cannot be determined whether this file was altered or unmonitored."
        )
        _log_verification(cursor, db, None, candidate_hash, result, user_id, ip_hash, user_agent, explanation)
        return jsonify({
            "result": result,
            "candidate_hash": candidate_hash,
            "registration_id": None,
            "signature_valid": False,
            "explanation": explanation,
            "academic_disclaimer": "Tri-state rule: A file unknown to the system cannot be claimed as modified; it is strictly UNKNOWN.",
            "provenance": None
        })

    # Record found by hash!
    record = records[0]
    is_owner = user_id == record["owner_id"]
    if record["privacy_level"] == "PRIVATE" and not (is_owner or is_admin):
        return jsonify({
            "error": "A matching file registration exists, but is marked PRIVATE by its owner. Direct lookup restricted.",
            "result": "RESTRICTED"
        }), 403

    sig_valid = False
    if record["canonical_payload"] and record["rsa_signature"]:
        sig_valid = crypto_service.verify_signature(
            record["canonical_payload"],
            record["rsa_signature"]
        )

    result = "MATCH"
    explanation = f"Exact hash match found in registration record {record['registration_id']}."
    _log_verification(cursor, db, record["registration_id"], candidate_hash, result, user_id, ip_hash, user_agent, explanation)

    is_redacted = record["privacy_level"] == "VERIFY_ONLY" and not (is_owner or is_admin)
    provenance_data = {
        "registration_id": record["registration_id"],
        "registered_hash": record["file_hash"],
        "registered_at": str(record["created_at"]),
        "privacy_level": record["privacy_level"],
        "signature_valid": sig_valid,
        "public_key_fingerprint": record["public_key_fingerprint"],
        "owner": "REDACTED (Privacy-Preserved)" if is_redacted else record["owner_username"],
        "original_filename": "REDACTED.bin" if is_redacted else record["original_filename"],
        "file_size": record["file_size"],
        "mime_type": record["mime_type"],
        "redacted": is_redacted
    }

    return jsonify({
        "result": result,
        "candidate_hash": candidate_hash,
        "registration_id": record["registration_id"],
        "signature_valid": sig_valid,
        "explanation": explanation,
        "academic_disclaimer": "CRITICAL CYBERSECURITY NOTE: A cryptographic hash match proves bit-level consistency with the reference timestamped in this system. It does not attest to the real-world factual truth or accuracy of the underlying content.",
        "provenance": provenance_data
    })

def _log_verification(cursor, db, reg_id, candidate_hash, result, user_id, ip_hash, user_agent, details):
    cursor.execute(
        """
        INSERT INTO verifications (registration_id, candidate_hash, result, verifier_id, verifier_ip_hash, user_agent, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (reg_id, candidate_hash, result, user_id, ip_hash, user_agent, details)
    )
    db.commit()

    # Append to hash-chained audit trail
    AuditService.record_event(
        action="FILE_VERIFIED",
        actor_id=user_id,
        resource_id=reg_id or "ANON_HASH",
        details={
            "registration_id": reg_id,
            "candidate_hash": candidate_hash,
            "result": result,
            "ip_hash": ip_hash
        },
        db=db
    )

@verify_bp.route("/verify/<registration_id>/history", methods=["GET"])
def verification_history(registration_id: str):
    """Retrieve the provenance timeline and audit history for a specific registered file."""
    db = get_db()
    cursor = db.cursor()

    cursor.execute("SELECT * FROM files WHERE registration_id = ?", (registration_id,))
    file_record = cursor.fetchone()
    if not file_record:
        return jsonify({"error": "File registration record not found."}), 404

    # Privacy check
    user_id = session.get("user_id")
    is_owner = user_id == file_record["owner_id"]
    is_admin = session.get("role") == "admin"

    if file_record["privacy_level"] == "PRIVATE" and not (is_owner or is_admin):
        return jsonify({"error": "Access to verification history is restricted by owner."}), 403

    cursor.execute(
        """
        SELECT v.*, u.username as verifier_username
        FROM verifications v
        LEFT JOIN users u ON v.verifier_id = u.id
        WHERE v.registration_id = ?
        ORDER BY v.timestamp DESC
        """,
        (registration_id,)
    )
    rows = cursor.fetchall()

    history = []
    for r in rows:
        history.append({
            "id": r["id"],
            "candidate_hash": r["candidate_hash"],
            "result": r["result"],
            "verifier": r["verifier_username"] or "Anonymous Verifier",
            "verifier_ip_hash": r["verifier_ip_hash"],
            "timestamp": str(r["timestamp"]),
            "details": r["details"]
        })

    return jsonify({
        "registration_id": registration_id,
        "registered_at": str(file_record["created_at"]),
        "history": history
    })
