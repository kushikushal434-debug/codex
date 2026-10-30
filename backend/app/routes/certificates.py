"""
Certificates Blueprint - Privacy-Preserving Certificate Verification System
Endpoints for Issuer Dashboard, Certificate Holder, and Verifier.
"""

import json
import secrets
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify, g
from werkzeug.utils import secure_filename

from ..db import get_db
from ..certificate_service import CertificateCryptoService, CertificateManager

certificates_bp = Blueprint("certificates", __name__, url_prefix="/api/certificates")


def _safe_str(val, default=""):
    """Safely return stripped string even if None or not a string."""
    if val is None:
        return default
    return str(val).strip()


@certificates_bp.route("/issuer/keys", methods=["GET"])
def get_issuer_keys():
    """Return the current Issuer Ed25519 public key info (no private key exposed)."""
    try:
        key_info = CertificateCryptoService.get_issuer_public_key_info()
        return jsonify({
            "success": True,
            "issuer_id": "Tech University Cryptographic Authority",
            "public_key_pem": key_info["public_key_pem"],
            "public_key_base64": key_info["public_key_base64"],
            "public_key_hex": key_info["public_key_hex"],
            "algorithm": "Ed25519",
            "description": "Public verification key used by verifiers to locally verify certificates.",
        })
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve issuer keys: {str(e)}"}), 500


@certificates_bp.route("/issuer/generate-keys", methods=["POST"])
def generate_new_keys():
    """Generate and configure a brand new Ed25519 keypair for the Issuer."""
    try:
        data = CertificateCryptoService.generate_new_keypair()
        with open(CertificateCryptoService.ISSUER_KEY_PATH, "w") as f:
            f.write(data["private_key_pem"])
        with open(CertificateCryptoService.ISSUER_PUB_PATH, "w") as f:
            f.write(data["public_key_pem"])

        return jsonify({
            "success": True,
            "message": "New Ed25519 keypair generated and activated successfully.",
            "public_key_pem": data["public_key_pem"],
            "public_key_base64": data["public_key_base64"],
            "public_key_hex": data["public_key_hex"],
        })
    except Exception as e:
        return jsonify({"error": f"Failed to generate keys: {str(e)}"}), 500


@certificates_bp.route("/issuer/issue", methods=["POST"])
def issue_certificate():
    """
    Issue a new verifiable certificate with cryptographic selective disclosure commitments.
    Accepts JSON or multipart/form-data.
    """
    db = get_db()
    file_bytes = None
    filename = "certificate.pdf"

    if request.is_json:
        payload = request.get_json() or {}
        certificate_id = _safe_str(payload.get("certificate_id"))
        issuer_id = _safe_str(payload.get("issuer_id"), "Decentralized Academic Authority")
        issue_date = _safe_str(payload.get("issue_date"), datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        expiry_raw = _safe_str(payload.get("expiry_date"))
        expiry_date = expiry_raw if expiry_raw else None
        claims = payload.get("claims", {})
    else:
        certificate_id = _safe_str(request.form.get("certificate_id"))
        issuer_id = _safe_str(request.form.get("issuer_id"), "Decentralized Academic Authority")
        issue_date = _safe_str(request.form.get("issue_date"), datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        expiry_raw = _safe_str(request.form.get("expiry_date"))
        expiry_date = expiry_raw if expiry_raw else None
        claims_raw = request.form.get("claims", "{}")
        try:
            claims = json.loads(claims_raw)
        except Exception:
            claims = {}

        if "file" in request.files:
            file_obj = request.files["file"]
            if file_obj and file_obj.filename:
                filename = secure_filename(file_obj.filename)
                file_bytes = file_obj.read()

    if not certificate_id:
        certificate_id = f"CERT-{datetime.now().year}-{secrets.token_hex(4).upper()}"

    if not claims or not isinstance(claims, dict):
        return jsonify({"error": "Certificate claims dictionary is required."}), 400

    # Check if certificate_id already exists
    existing = db.execute("SELECT id FROM issued_certificates WHERE certificate_id = ?", (certificate_id,)).fetchone()
    if existing:
        return jsonify({"error": f"Certificate ID '{certificate_id}' already exists."}), 409

    try:
        credential_package = CertificateManager.issue_certificate(
            certificate_id=certificate_id,
            issuer_id=issuer_id,
            claims=claims,
            issue_date=issue_date,
            expiry_date=expiry_date,
            document_bytes=file_bytes,
            document_filename=filename,
        )

        manifest = credential_package["manifest"]
        root_commitment = manifest["root_commitment"]
        sig = credential_package["issuer_signature"]
        issuer_pub = manifest["issuer_public_key"]
        doc_hash = manifest["document_hash"]

        db.execute(
            """
            INSERT INTO issued_certificates 
            (certificate_id, issuer_id, document_filename, document_hash, root_commitment, 
             ed25519_signature, issuer_public_key, claims_json, issue_date, expiry_date, is_revoked)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            """,
            (
                certificate_id,
                issuer_id,
                filename,
                doc_hash,
                root_commitment,
                sig,
                issuer_pub,
                json.dumps(credential_package["claims"]),
                issue_date,
                expiry_date or "NONE",
            ),
        )
        db.commit()

        return jsonify({
            "success": True,
            "message": f"Certificate {certificate_id} issued successfully with cryptographic commitments.",
            "certificate_id": certificate_id,
            "credential_package": credential_package,
        })
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to issue certificate: {str(e)}"}), 500


@certificates_bp.route("/issuer/certificates", methods=["GET"])
def list_issued_certificates():
    """List all certificates issued by the authority with revocation status."""
    db = get_db()
    rows = db.execute(
        """
        SELECT c.*, r.revocation_reason, r.revoked_at
        FROM issued_certificates c
        LEFT JOIN certificate_revocations r ON c.certificate_id = r.certificate_id
        ORDER BY c.created_at DESC
        """
    ).fetchall()

    items = []
    for r in rows:
        try:
            claims = json.loads(r["claims_json"])
            clean_claims = {k: v.get("value", "") for k, v in claims.items()}
        except Exception:
            clean_claims = {}

        items.append({
            "id": r["id"],
            "certificate_id": r["certificate_id"],
            "issuer_id": r["issuer_id"],
            "document_filename": r["document_filename"],
            "document_hash": r["document_hash"],
            "root_commitment": r["root_commitment"],
            "issue_date": r["issue_date"],
            "expiry_date": r["expiry_date"],
            "is_revoked": bool(r["is_revoked"]),
            "revocation_reason": r["revocation_reason"],
            "revoked_at": r["revoked_at"],
            "claims": clean_claims,
            "created_at": r["created_at"],
        })

    return jsonify({"success": True, "certificates": items})


@certificates_bp.route("/issuer/revoke", methods=["POST"])
def revoke_certificate():
    """Revoke a previously issued certificate."""
    db = get_db()
    data = request.get_json() or {}
    certificate_id = _safe_str(data.get("certificate_id"))
    reason = _safe_str(data.get("reason"), "Revoked by issuer")

    if not certificate_id:
        return jsonify({"error": "certificate_id is required."}), 400

    cert = db.execute("SELECT * FROM issued_certificates WHERE certificate_id = ?", (certificate_id,)).fetchone()
    if not cert:
        return jsonify({"error": f"Certificate '{certificate_id}' not found."}), 404

    try:
        db.execute(
            """
            INSERT OR REPLACE INTO certificate_revocations (certificate_id, revocation_reason, revoked_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            """,
            (certificate_id, reason),
        )
        db.execute("UPDATE issued_certificates SET is_revoked = 1 WHERE certificate_id = ?", (certificate_id,))
        db.commit()

        return jsonify({
            "success": True,
            "message": f"Certificate {certificate_id} has been revoked successfully.",
            "certificate_id": certificate_id,
            "reason": reason,
        })
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to revoke certificate: {str(e)}"}), 500


@certificates_bp.route("/issuer/revocation-list", methods=["GET"])
def get_revocation_list():
    """Export the current revocation list."""
    db = get_db()
    rows = db.execute("SELECT certificate_id, revocation_reason, revoked_at FROM certificate_revocations ORDER BY revoked_at DESC").fetchall()
    revocations = [
        {
            "certificate_id": r["certificate_id"],
            "reason": r["revocation_reason"],
            "revoked_at": r["revoked_at"],
        }
        for r in rows
    ]
    return jsonify({
        "success": True,
        "issuer_id": "Decentralized Academic Authority",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_revoked": len(revocations),
        "revoked_certificate_ids": [r["certificate_id"] for r in revocations],
        "revocations": revocations,
    })


@certificates_bp.route("/verifier/nonce", methods=["POST"])
def generate_nonce():
    """
    Generate a unique, single-use verification challenge (nonce) to prevent replay attacks.
    Has a 10-minute expiration window.
    """
    db = get_db()
    data = request.get_json() or {}
    verifier_label = _safe_str(data.get("verifier_label"), "Online Verifier")

    nonce = f"chlg_{secrets.token_hex(20)}"
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(minutes=10)).isoformat()

    try:
        db.execute(
            """
            INSERT INTO verification_nonces (nonce, created_at, expires_at, is_used, verifier_label)
            VALUES (?, ?, ?, 0, ?)
            """,
            (nonce, now.isoformat(), expires_at, verifier_label),
        )
        db.commit()

        return jsonify({
            "success": True,
            "nonce": nonce,
            "expires_at": expires_at,
            "ttl_seconds": 600,
            "verifier_label": verifier_label,
            "message": "Challenge nonce generated. Pass this to the Certificate Holder to bind their presentation.",
        })
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to generate nonce: {str(e)}"}), 500


@certificates_bp.route("/holder/present", methods=["POST"])
def create_presentation():
    """Certificate Holder Dashboard: Build a selective disclosure presentation."""
    data = request.get_json() or {}
    credential_package = data.get("credential_package")
    disclosed_keys = data.get("disclosed_keys", [])
    verifier_nonce = _safe_str(data.get("nonce"))

    if not credential_package:
        return jsonify({"error": "credential_package is required."}), 400
    if not verifier_nonce:
        return jsonify({"error": "verifier challenge nonce is required to prevent replay attacks."}), 400

    try:
        presentation = CertificateManager.create_selective_presentation(
            credential_package=credential_package,
            disclosed_keys=disclosed_keys,
            verifier_nonce=verifier_nonce,
        )
        return jsonify({
            "success": True,
            "presentation": presentation,
            "message": f"Generated presentation with {len(presentation['disclosed_claims'])} disclosed and {len(presentation['hidden_claims'])} cryptographically hidden claims.",
        })
    except Exception as e:
        return jsonify({"error": f"Failed to build presentation: {str(e)}"}), 500


@certificates_bp.route("/verifier/verify", methods=["POST"])
def verify_certificate():
    """Verifier Dashboard: Cryptographically verifies a presentation."""
    db = get_db()
    data = request.get_json() or {}
    presentation = data.get("presentation")
    trusted_pubkey = _safe_str(data.get("trusted_issuer_pubkey")) or None
    provided_revocation_list = data.get("revocation_list")

    if not presentation or not isinstance(presentation, dict):
        return jsonify({"error": "presentation payload is required."}), 400

    nonce = _safe_str(presentation.get("nonce"))

    # Verify nonce in database
    valid_nonces = set()
    if nonce:
        row = db.execute("SELECT nonce, expires_at, is_used FROM verification_nonces WHERE nonce = ?", (nonce,)).fetchone()
        if row:
            exp_str = row["expires_at"]
            try:
                exp_dt = datetime.fromisoformat(exp_str)
                if datetime.now(timezone.utc) <= exp_dt and row["is_used"] == 0:
                    valid_nonces.add(nonce)
                    db.execute("UPDATE verification_nonces SET is_used = 1 WHERE nonce = ?", (nonce,))
                    db.commit()
            except Exception:
                pass

    # Revocation list
    local_revoked = db.execute("SELECT certificate_id FROM certificate_revocations").fetchall()
    all_revoked = {r["certificate_id"] for r in local_revoked}
    if provided_revocation_list and isinstance(provided_revocation_list, list):
        for item in provided_revocation_list:
            if isinstance(item, str):
                all_revoked.add(item.strip())
            elif isinstance(item, dict) and "certificate_id" in item:
                all_revoked.add(str(item["certificate_id"]).strip())

    if not trusted_pubkey:
        try:
            key_info = CertificateCryptoService.get_issuer_public_key_info()
            trusted_pubkey = key_info["public_key_hex"]
        except Exception:
            trusted_pubkey = None

    result = CertificateManager.verify_presentation(
        presentation=presentation,
        trusted_issuer_pubkey=trusted_pubkey,
        revocation_list=list(all_revoked),
        valid_nonces_set=valid_nonces if nonce else None,
    )

    try:
        db.execute(
            """
            INSERT INTO certificate_verification_logs 
            (presentation_id, certificate_id, verification_result, disclosed_fields, hidden_fields_count, details)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                presentation.get("presentation_id", "UNKNOWN"),
                result.get("certificate_id", "UNKNOWN"),
                result.get("result", "UNKNOWN"),
                json.dumps(list(result.get("disclosed_fields", {}).keys())),
                result.get("hidden_fields_count", 0),
                json.dumps(result.get("checks", {})),
            ),
        )
        db.commit()
    except Exception:
        pass

    return jsonify({"success": True, "verification": result})


@certificates_bp.route("/inspect-file", methods=["POST"])
def inspect_file():
    """Examines an uploaded certificate file (PDF, PNG, JPG)."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    f = request.files["file"]
    if not f or not f.filename:
        return jsonify({"error": "Empty filename."}), 400

    filename = secure_filename(f.filename)
    data = f.read()
    file_size = len(data)
    digest = CertificateCryptoService.compute_sha256(data)

    db = get_db()
    match = db.execute("SELECT certificate_id, issuer_id, issue_date FROM issued_certificates WHERE document_hash = ?", (digest,)).fetchone()

    is_tracked = match is not None
    matched_cert_id = match["certificate_id"] if match else None

    is_pdf = data.startswith(b"%PDF-")
    is_png = data.startswith(b"\x89PNG\r\n\x1a\n")
    is_jpg = data.startswith(b"\xff\xd8\xff")

    explanation = (
        "Cryptographic Notice: A raw PDF or image file contains binary content but does not contain "
        "cryptographic salt commitments or selective disclosure proofs. To verify this certificate "
        "without revealing private fields, the certificate must be issued with a cryptographic credential manifest."
    )

    return jsonify({
        "success": True,
        "filename": filename,
        "size_bytes": file_size,
        "sha256_hash": digest,
        "format": "PDF" if is_pdf else "PNG" if is_png else "JPEG" if is_jpg else "Binary",
        "is_registered_in_authority": is_tracked,
        "matched_certificate_id": matched_cert_id,
        "explanation": explanation,
    })
