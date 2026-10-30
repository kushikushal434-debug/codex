import os
import sys
import uuid
import datetime
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from werkzeug.security import generate_password_hash
from app.config import Config
from app.db import init_db, get_db
from app.crypto_service import crypto_service
from app.audit_service import AuditService

def create_sample_files_on_disk():
    """Create sample valid files with appropriate magic bytes."""
    samples_dir = Config.STORAGE_DIR / "sample_files"
    samples_dir.mkdir(parents=True, exist_ok=True)

    # 1. Valid PDF file
    pdf_content = (
        b"%PDF-1.5\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n185\n%%EOF\n"
    )
    pdf_path = samples_dir / "provenance_whitepaper.pdf"
    pdf_path.write_bytes(pdf_content)

    # 2. Valid PNG file (minimal 1x1 transparent PNG)
    png_content = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
        b"\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    png_path = samples_dir / "system_architecture.png"
    png_path.write_bytes(png_content)

    # 3. Valid TXT file
    txt_content = (
        "TRUST, PRIVACY & DIGITAL PROVENANCE SYSTEM POLICY\n"
        "===================================================\n"
        "1. Every registered asset must have a deterministic SHA-256 digest.\n"
        "2. Provenance records are non-repudiable through RSA-PSS 2048-bit signatures.\n"
        "3. Audit trails are sequentially chained with cryptographic hash pointers.\n"
        "4. A hash match confirms bitstream consistency with a recorded reference.\n"
    ).encode("utf-8")
    txt_path = samples_dir / "security_policy.txt"
    txt_path.write_bytes(txt_content)

    # 4. Valid DOCX mock (PKZIP container)
    docx_content = (
        b"PK\x03\x04\x14\x00\x00\x00\x08\x00\x00\x00!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
        b"[Content_Types].xml<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        b"<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"></Types>"
    )
    docx_path = samples_dir / "compliance_audit.docx"
    docx_path.write_bytes(docx_content)

    return {
        "pdf": pdf_path,
        "png": png_path,
        "txt": txt_path,
        "docx": docx_path
    }

def seed_database(db_path=None):
    """Seed users, files, provenance records, verifications, and audit blocks."""
    init_db(db_path)
    import sqlite3
    conn = sqlite3.connect(db_path or Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Check if users already seeded
    cursor.execute("SELECT COUNT(*) as count FROM users")
    if cursor.fetchone()["count"] > 0:
        conn.close()
        return

    print("Seeding demo accounts and provenance records...")

    # 1. Users
    users_data = [
        ("admin", "admin@provenance.local", "AdminPass123!", "admin"),
        ("alice", "alice@example.com", "AlicePass123!", "user"),
        ("bob", "bob@example.com", "BobPass123!", "user")
    ]
    user_ids = {}
    for username, email, pwd, role in users_data:
        p_hash = generate_password_hash(pwd, method="scrypt")
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (username, email, p_hash, role)
        )
        user_ids[username] = cursor.lastrowid
        AuditService.record_event(
            action="USER_REGISTERED",
            actor_id=user_ids[username],
            resource_id=str(user_ids[username]),
            details={"username": username, "email": email, "role": role},
            db=conn
        )
    conn.commit()

    # 2. Files
    sample_files = create_sample_files_on_disk()

    files_to_register = [
        {
            "owner": "alice",
            "file_path": sample_files["pdf"],
            "filename": "provenance_whitepaper.pdf",
            "mime": "application/pdf",
            "privacy": "PUBLIC",
            "tags": "whitepaper, cryptographic-integrity, pss",
            "desc": "Official technical whitepaper on digital provenance and privacy controls."
        },
        {
            "owner": "alice",
            "file_path": sample_files["png"],
            "filename": "system_architecture.png",
            "mime": "image/png",
            "privacy": "VERIFY_ONLY",
            "tags": "diagram, architecture, audit-chain",
            "desc": "Internal system architecture diagram. Publicly verifiable, metadata redacted."
        },
        {
            "owner": "bob",
            "file_path": sample_files["txt"],
            "filename": "security_policy.txt",
            "mime": "text/plain",
            "privacy": "PRIVATE",
            "tags": "policy, cybersecurity, zero-knowledge",
            "desc": "Confidential corporate cybersecurity policy."
        },
        {
            "owner": "admin",
            "file_path": sample_files["docx"],
            "filename": "compliance_audit.docx",
            "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "privacy": "PUBLIC",
            "tags": "audit, compliance, iso27001",
            "desc": "Third-party compliance evaluation and assurance report."
        }
    ]

    registered_files = []

    for item in files_to_register:
        content = item["file_path"].read_bytes()
        file_hash = crypto_service.compute_sha256_bytes(content)
        file_size = len(content)
        reg_id = f"REG-20261030-{uuid.uuid4().hex[:8].upper()}"
        stored_name = f"{uuid.uuid4().hex}.bin"
        stored_path = Config.UPLOADS_DIR / stored_name
        stored_path.write_bytes(content)

        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        owner_id = user_ids[item["owner"]]

        cursor.execute(
            """
            INSERT INTO files (
                registration_id, original_filename, stored_filename, file_size,
                mime_type, file_hash, owner_id, privacy_level, tags, description, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                reg_id, item["filename"], stored_name, file_size,
                item["mime"], file_hash, owner_id, item["privacy"], item["tags"], item["desc"], timestamp
            )
        )

        # Provenance signing
        canonical_dict = {
            "created_at": timestamp,
            "file_hash": file_hash,
            "file_size": file_size,
            "mime_type": item["mime"],
            "original_filename": item["filename"],
            "owner_id": owner_id,
            "registration_id": reg_id
        }
        canonical_str = crypto_service.canonical_json(canonical_dict)
        sig = crypto_service.sign_payload(canonical_str)
        fingerprint = crypto_service.public_key_fingerprint

        cursor.execute(
            """
            INSERT INTO provenance_records (
                registration_id, file_hash, canonical_payload, rsa_signature, public_key_fingerprint, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (reg_id, file_hash, canonical_str, sig, fingerprint, timestamp)
        )
        conn.commit()

        AuditService.record_event(
            action="FILE_REGISTERED",
            actor_id=owner_id,
            resource_id=reg_id,
            details={
                "registration_id": reg_id,
                "original_filename": item["filename"],
                "file_hash": file_hash,
                "privacy_level": item["privacy"]
            },
            db=conn
        )

        registered_files.append((reg_id, file_hash))

    # 3. Sample Verifications
    # MATCH verification
    whitepaper_reg, whitepaper_hash = registered_files[0]
    cursor.execute(
        """
        INSERT INTO verifications (registration_id, candidate_hash, result, verifier_id, verifier_ip_hash, user_agent, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (whitepaper_reg, whitepaper_hash, "MATCH", user_ids["bob"], "a1b2c3d4e5f60718", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Exact match confirmed.")
    )
    AuditService.record_event(
        action="FILE_VERIFIED",
        actor_id=user_ids["bob"],
        resource_id=whitepaper_reg,
        details={"result": "MATCH", "candidate_hash": whitepaper_hash},
        db=conn
    )

    # MODIFIED verification
    tampered_hash = whitepaper_hash[:-4] + "dead"
    cursor.execute(
        """
        INSERT INTO verifications (registration_id, candidate_hash, result, verifier_id, verifier_ip_hash, user_agent, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (whitepaper_reg, tampered_hash, "MODIFIED", None, "f8e7d6c5b4a31209", "Mozilla/5.0 (Macintosh; Intel Mac OS X)", "Candidate hash mismatch against registered reference.")
    )
    AuditService.record_event(
        action="FILE_VERIFIED",
        actor_id=None,
        resource_id=whitepaper_reg,
        details={"result": "MODIFIED", "candidate_hash": tampered_hash},
        db=conn
    )
    conn.commit()

    # 4. Create an Initial Signed Checkpoint
    try:
        AuditService.create_checkpoint(conn)
    except Exception as e:
        print("Checkpoint generation notice:", e)

    conn.close()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed_database()
