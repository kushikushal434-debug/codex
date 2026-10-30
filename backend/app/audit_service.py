import uuid
import datetime
import hashlib
from .crypto_service import crypto_service
from .db import get_db

GENESIS_PREV_HASH = "0" * 64

class AuditService:
    @staticmethod
    def _compute_entry_hash(prev_hash: str, block_index: int, action: str, 
                            actor_id: int | None, resource_id: str | None, 
                            timestamp: str, details_canonical: str) -> str:
        """Deterministically calculate block entry hash."""
        raw = f"{prev_hash}|{block_index}|{action}|{actor_id or 'none'}|{resource_id or 'none'}|{timestamp}|{details_canonical}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @classmethod
    def record_event(cls, action: str, actor_id: int | None, resource_id: str | None, 
                     details: dict, db=None) -> dict:
        """
        Append a new hash-chained audit block to the audit log.
        """
        conn = db or get_db()
        cursor = conn.cursor()

        # Fetch latest block
        cursor.execute("SELECT block_index, entry_hash FROM audit_logs ORDER BY block_index DESC LIMIT 1")
        last_block = cursor.fetchone()

        if last_block is None:
            # First block (Genesis)
            block_index = 0
            prev_hash = GENESIS_PREV_HASH
        else:
            block_index = last_block["block_index"] + 1
            prev_hash = last_block["entry_hash"]

        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        canonical_details = crypto_service.canonical_json(details)
        entry_hash = cls._compute_entry_hash(
            prev_hash, block_index, action, actor_id, resource_id, timestamp, canonical_details
        )

        cursor.execute(
            """
            INSERT INTO audit_logs (block_index, prev_hash, entry_hash, action, actor_id, resource_id, details, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (block_index, prev_hash, entry_hash, action, actor_id, resource_id, canonical_details, timestamp)
        )
        conn.commit()

        return {
            "block_index": block_index,
            "prev_hash": prev_hash,
            "entry_hash": entry_hash,
            "action": action,
            "timestamp": timestamp
        }

    @classmethod
    def verify_chain_integrity(cls, db=None) -> dict:
        """
        Validate the entire audit chain from genesis block to the head block.
        Detects tampering, missing records, or modified fields.
        """
        conn = db or get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM audit_logs ORDER BY block_index ASC")
        blocks = cursor.fetchall()

        if not blocks:
            return {
                "is_valid": True,
                "total_blocks": 0,
                "broken_at_block": None,
                "error_details": "Audit chain is empty."
            }

        expected_prev_hash = GENESIS_PREV_HASH

        for idx, block in enumerate(blocks):
            b_index = block["block_index"]
            b_prev = block["prev_hash"]
            b_entry = block["entry_hash"]
            b_action = block["action"]
            b_actor = block["actor_id"]
            b_resource = block["resource_id"]
            b_details = block["details"]
            b_timestamp = block["timestamp"]

            # Sequence check
            if b_index != idx:
                return {
                    "is_valid": False,
                    "total_blocks": len(blocks),
                    "broken_at_block": idx,
                    "error_details": f"Block sequence violation: expected index {idx}, got {b_index}."
                }

            # Previous hash pointer check
            if b_prev != expected_prev_hash:
                return {
                    "is_valid": False,
                    "total_blocks": len(blocks),
                    "broken_at_block": b_index,
                    "error_details": f"Broken chain pointer at block {b_index}: prev_hash does not match previous block's entry_hash."
                }

            # Recompute and verify entry hash
            recomputed_hash = cls._compute_entry_hash(
                b_prev, b_index, b_action, b_actor, b_resource, b_timestamp, b_details
            )

            if recomputed_hash != b_entry:
                return {
                    "is_valid": False,
                    "total_blocks": len(blocks),
                    "broken_at_block": b_index,
                    "error_details": f"Tampering detected at block {b_index}: hash digest mismatch (stored: {b_entry[:16]}..., recomputed: {recomputed_hash[:16]}...)."
                }

            expected_prev_hash = b_entry

        return {
            "is_valid": True,
            "total_blocks": len(blocks),
            "broken_at_block": None,
            "head_hash": expected_prev_hash,
            "error_details": None
        }

    @classmethod
    def create_checkpoint(cls, db=None) -> dict:
        """
        Create a digitally signed checkpoint over all audit blocks up to the current head.
        """
        conn = db or get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT MIN(block_index) as min_idx, MAX(block_index) as max_idx FROM audit_logs")
        row = cursor.fetchone()

        if row is None or row["max_idx"] is None:
            raise ValueError("Cannot create checkpoint on an empty audit trail.")

        block_start = row["min_idx"]
        block_end = row["max_idx"]

        cursor.execute("SELECT entry_hash FROM audit_logs WHERE block_index = ?", (block_end,))
        root_row = cursor.fetchone()
        root_hash = root_row["entry_hash"]

        checkpoint_id = f"CP-{int(datetime.datetime.now().timestamp())}-{uuid.uuid4().hex[:8].upper()}"
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

        checkpoint_payload = {
            "checkpoint_id": checkpoint_id,
            "block_start": block_start,
            "block_end": block_end,
            "root_hash": root_hash,
            "timestamp": timestamp
        }
        canonical_str = crypto_service.canonical_json(checkpoint_payload)
        signature = crypto_service.sign_payload(canonical_str)

        cursor.execute(
            """
            INSERT INTO audit_checkpoints (checkpoint_id, block_start, block_end, root_hash, rsa_signature, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (checkpoint_id, block_start, block_end, root_hash, signature, timestamp)
        )
        conn.commit()

        # Also log the checkpoint creation itself as an audit event
        cls.record_event(
            action="CHECKPOINT_CREATED",
            actor_id=None,
            resource_id=checkpoint_id,
            details={"block_start": block_start, "block_end": block_end, "root_hash": root_hash},
            db=conn
        )

        return {
            "checkpoint_id": checkpoint_id,
            "block_start": block_start,
            "block_end": block_end,
            "root_hash": root_hash,
            "rsa_signature": signature,
            "timestamp": timestamp
        }

    @classmethod
    def verify_checkpoint(cls, checkpoint_id: str, db=None) -> dict:
        """Verify an existing checkpoint's digital signature and chain agreement."""
        conn = db or get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM audit_checkpoints WHERE checkpoint_id = ?", (checkpoint_id,))
        cp = cursor.fetchone()

        if not cp:
            return {"is_valid": False, "error": "Checkpoint record not found."}

        payload = {
            "checkpoint_id": cp["checkpoint_id"],
            "block_start": cp["block_start"],
            "block_end": cp["block_end"],
            "root_hash": cp["root_hash"],
            "timestamp": cp["timestamp"]
        }
        canonical_str = crypto_service.canonical_json(payload)
        sig_valid = crypto_service.verify_signature(canonical_str, cp["rsa_signature"])

        # Check block in audit_logs
        cursor.execute("SELECT entry_hash FROM audit_logs WHERE block_index = ?", (cp["block_end"],))
        block_row = cursor.fetchone()
        root_matches = block_row is not None and block_row["entry_hash"] == cp["root_hash"]

        return {
            "is_valid": sig_valid and root_matches,
            "signature_valid": sig_valid,
            "root_hash_matches_database": root_matches,
            "checkpoint": dict(cp)
        }
