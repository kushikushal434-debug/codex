import pytest
from app.audit_service import AuditService
from app.db import get_db

def test_hash_chain_formation_and_integrity(app):
    with app.app_context():
        db = get_db()

        # Record series of audit events
        b0 = AuditService.record_event("ACTION_A", 1, "RES-001", {"info": "step 1"}, db=db)
        b1 = AuditService.record_event("ACTION_B", 1, "RES-002", {"info": "step 2"}, db=db)
        b2 = AuditService.record_event("ACTION_C", 2, "RES-003", {"info": "step 3"}, db=db)

        assert b0["block_index"] == 0
        assert b0["prev_hash"] == "0" * 64

        assert b1["block_index"] == 1
        assert b1["prev_hash"] == b0["entry_hash"]

        assert b2["block_index"] == 2
        assert b2["prev_hash"] == b1["entry_hash"]

        # Validate whole chain
        check = AuditService.verify_chain_integrity(db=db)
        assert check["is_valid"] is True
        assert check["total_blocks"] >= 3
        assert check["broken_at_block"] is None

def test_audit_chain_tamper_detection(app):
    with app.app_context():
        db = get_db()

        # Build clean chain
        for i in range(5):
            AuditService.record_event(f"EVENT_{i}", 1, f"RES_{i}", {"seq": i}, db=db)

        # Confirm valid initial state
        clean_check = AuditService.verify_chain_integrity(db=db)
        assert clean_check["is_valid"] is True

        # Now simulate an attacker tampering with block 2 in the database!
        cursor = db.cursor()
        cursor.execute(
            "UPDATE audit_logs SET details = ? WHERE block_index = 2",
            ('{"seq": 2, "MALICIOUS_MODIFICATION": true}',)
        )
        db.commit()

        # Re-run integrity validation
        tampered_check = AuditService.verify_chain_integrity(db=db)
        assert tampered_check["is_valid"] is False
        assert tampered_check["broken_at_block"] == 2
        assert "tampering detected at block 2" in tampered_check["error_details"].lower()

def test_signed_checkpoint_creation_and_verification(app):
    with app.app_context():
        db = get_db()
        AuditService.record_event("STATE_CHECK", 1, "CHECK-1", {"val": 100}, db=db)

        checkpoint = AuditService.create_checkpoint(db=db)
        assert "checkpoint_id" in checkpoint
        assert "rsa_signature" in checkpoint
        assert len(checkpoint["rsa_signature"]) > 100

        # Verify the created checkpoint
        verif = AuditService.verify_checkpoint(checkpoint["checkpoint_id"], db=db)
        assert verif["is_valid"] is True
        assert verif["signature_valid"] is True
        assert verif["root_hash_matches_database"] is True
