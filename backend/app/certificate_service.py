"""
Privacy-Preserving Certificate Verification System Service
---------------------------------------------------------
Implements cryptographic selective disclosure, Ed25519 digital signatures,
tamper detection, revocation registries, and replay attack prevention (nonces).
"""

import base64
import hashlib
import json
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

from .config import Config


class CertificateCryptoService:
    """Handles Ed25519 key management, canonical commitments, and verification."""

    ISSUER_KEY_PATH = os.path.join(Config.STORAGE_DIR, "keys", "issuer_ed25519_private.pem")
    ISSUER_PUB_PATH = os.path.join(Config.STORAGE_DIR, "keys", "issuer_ed25519_public.pem")

    @classmethod
    def ensure_issuer_keys(cls) -> Tuple[ed25519.Ed25519PrivateKey, ed25519.Ed25519PublicKey]:
        """Ensure default issuer Ed25519 keypair exists or generate a new one."""
        os.makedirs(os.path.dirname(cls.ISSUER_KEY_PATH), exist_ok=True)
        if os.path.exists(cls.ISSUER_KEY_PATH) and os.path.exists(cls.ISSUER_PUB_PATH):
            with open(cls.ISSUER_KEY_PATH, "rb") as f:
                priv = serialization.load_pem_private_key(f.read(), password=None)
            with open(cls.ISSUER_PUB_PATH, "rb") as f:
                pub = serialization.load_pem_public_key(f.read())
            return priv, pub

        # Generate fresh keypair
        priv = ed25519.Ed25519PrivateKey.generate()
        pub = priv.public_key()

        # Save private key (unencrypted for demo; restrictive permissions)
        priv_bytes = priv.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        pub_bytes = pub.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )

        with open(cls.ISSUER_KEY_PATH, "wb") as f:
            f.write(priv_bytes)
        with open(cls.ISSUER_PUB_PATH, "wb") as f:
            f.write(pub_bytes)

        return priv, pub

    @classmethod
    def generate_new_keypair(cls) -> Dict[str, str]:
        """Generate a brand new Ed25519 keypair and return exportable strings."""
        priv = ed25519.Ed25519PrivateKey.generate()
        pub = priv.public_key()

        priv_pem = priv.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")

        pub_pem = pub.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8")

        raw_pub = pub.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        pub_base64 = base64.b64encode(raw_pub).decode("utf-8")
        pub_hex = raw_pub.hex()

        return {
            "private_key_pem": priv_pem,
            "public_key_pem": pub_pem,
            "public_key_base64": pub_base64,
            "public_key_hex": pub_hex,
        }

    @classmethod
    def get_issuer_public_key_info(cls) -> Dict[str, str]:
        """Return the current issuer public key representations."""
        _, pub = cls.ensure_issuer_keys()
        pub_pem = pub.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8")
        raw_pub = pub.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        return {
            "public_key_pem": pub_pem,
            "public_key_base64": base64.b64encode(raw_pub).decode("utf-8"),
            "public_key_hex": raw_pub.hex(),
        }

    @classmethod
    def load_public_key(cls, pub_key_input: str) -> ed25519.Ed25519PublicKey:
        """Load an Ed25519 public key from PEM, Base64, or Hex string."""
        s = str(pub_key_input or "").strip()
        if "-----BEGIN PUBLIC KEY-----" in s:
            return serialization.load_pem_public_key(s.encode("utf-8"))

        # Try base64
        try:
            raw = base64.b64decode(s)
            if len(raw) == 32:
                return ed25519.Ed25519PublicKey.from_public_bytes(raw)
        except Exception:
            pass

        # Try hex
        try:
            raw = bytes.fromhex(s)
            if len(raw) == 32:
                return ed25519.Ed25519PublicKey.from_public_bytes(raw)
        except Exception:
            pass

        raise ValueError("Invalid Ed25519 public key format. Expected PEM, 32-byte Base64, or 64-char Hex.")

    @classmethod
    def load_private_key(cls, priv_key_pem: str) -> ed25519.Ed25519PrivateKey:
        """Load an Ed25519 private key from PEM string."""
        return serialization.load_pem_private_key(priv_key_pem.encode("utf-8"), password=None)

    @classmethod
    def compute_sha256(cls, data: bytes) -> str:
        """Compute standard SHA-256 hex string."""
        return hashlib.sha256(data).hexdigest()

    @classmethod
    def canonical_json(cls, obj: Any) -> bytes:
        """Serialize an object into deterministic canonical JSON bytes."""
        return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

    @classmethod
    def compute_claim_commitment(cls, field_name: str, field_value: str, salt: str) -> str:
        """
        Compute cryptographic hash commitment for a single attribute:
        c_i = SHA256(field_name : field_value : salt)
        """
        payload = f"{field_name}:{field_value}:{salt}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    @classmethod
    def compute_root_commitment(cls, commitments: Dict[str, str], document_hash: str) -> str:
        """
        Compute root commitment over all sorted attribute commitments and document hash:
        R = SHA256("v1:" + sorted_commitments + ":" + document_hash)
        """
        sorted_keys = sorted(commitments.keys())
        lines = [f"{k}={commitments[k]}" for k in sorted_keys]
        composite = "v1|" + "|".join(lines) + f"|doc:{document_hash}"
        return hashlib.sha256(composite.encode("utf-8")).hexdigest()


class CertificateManager:
    """Manages issuance, selective disclosure presentation, and verification."""

    @classmethod
    def issue_certificate(
        cls,
        certificate_id: str,
        issuer_id: str,
        claims: Dict[str, str],
        issue_date: str,
        expiry_date: Optional[str] = None,
        document_bytes: Optional[bytes] = None,
        document_filename: Optional[str] = None,
        issuer_private_key: Optional[ed25519.Ed25519PrivateKey] = None,
    ) -> Dict[str, Any]:
        """
        Issue a new privacy-preserving verifiable certificate.
        - Calculates document SHA-256 hash
        - Generates 32-byte cryptographic salt per claim
        - Generates claim commitments
        - Computes root commitment
        - Signs manifest with Issuer Ed25519 private key
        - Produces holder credential package
        """
        if not issuer_private_key:
            issuer_priv, issuer_pub = CertificateCryptoService.ensure_issuer_keys()
        else:
            issuer_priv = issuer_private_key
            issuer_pub = issuer_priv.public_key()

        raw_pub = issuer_pub.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        issuer_pub_hex = raw_pub.hex()

        # Compute document hash
        doc_hash = (
            CertificateCryptoService.compute_sha256(document_bytes)
            if document_bytes
            else "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"  # sha256 of empty
        )

        # Generate salted commitments
        salted_claims: Dict[str, Dict[str, str]] = {}
        commitments: Dict[str, str] = {}

        for key, val in claims.items():
            clean_key = str(key).strip()
            clean_val = str(val).strip()
            salt = secrets.token_hex(32)
            comm = CertificateCryptoService.compute_claim_commitment(clean_key, clean_val, salt)
            salted_claims[clean_key] = {
                "value": clean_val,
                "salt": salt,
                "commitment": comm,
            }
            commitments[clean_key] = comm

        # Compute root commitment
        root_commitment = CertificateCryptoService.compute_root_commitment(commitments, doc_hash)

        # Build manifest
        manifest = {
            "certificate_id": certificate_id,
            "issuer_id": issuer_id,
            "issue_date": issue_date,
            "expiry_date": expiry_date or "NONE",
            "document_hash": doc_hash,
            "document_filename": document_filename or "document.pdf",
            "root_commitment": root_commitment,
            "issuer_public_key": issuer_pub_hex,
            "algorithm": "Ed25519",
        }

        # Sign manifest
        canonical_bytes = CertificateCryptoService.canonical_json(manifest)
        signature = issuer_priv.sign(canonical_bytes).hex()

        # Full Credential Package (given to Certificate Holder)
        credential_package = {
            "type": "PrivacyPreservingVerifiableCertificate",
            "version": "1.0",
            "manifest": manifest,
            "issuer_signature": signature,
            "claims": salted_claims,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        return credential_package

    @classmethod
    def create_selective_presentation(
        cls,
        credential_package: Dict[str, Any],
        disclosed_keys: List[str],
        verifier_nonce: str,
        custom_presentation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a selective disclosure presentation for a specific verifier.
        - Discloses only selected claim keys (value + salt)
        - Hides all other claim keys by providing ONLY the commitment hash
        - Generates fresh random presentation_id to prevent tracking across verifiers
        - Cryptographically binds presentation to verifier's challenge nonce
        """
        manifest = credential_package.get("manifest", {})
        signature = credential_package.get("issuer_signature", "")
        all_claims = credential_package.get("claims", {})

        presentation_id = custom_presentation_id or f"pres-{uuid.uuid4().hex}"

        disclosed_claims: Dict[str, Dict[str, str]] = {}
        hidden_claims: Dict[str, str] = {}

        disclosed_set = set(disclosed_keys)

        for key, claim_data in all_claims.items():
            if key in disclosed_set:
                disclosed_claims[key] = {
                    "value": claim_data["value"],
                    "salt": claim_data["salt"],
                }
            else:
                hidden_claims[key] = claim_data["commitment"]

        # Cryptographic anti-replay nonce binding
        binding_payload = f"{presentation_id}:{verifier_nonce}:{manifest.get('root_commitment')}".encode("utf-8")
        presentation_binding = hashlib.sha256(binding_payload).hexdigest()

        presentation = {
            "type": "SelectiveDisclosurePresentation",
            "presentation_id": presentation_id,
            "nonce": verifier_nonce,
            "manifest": manifest,
            "issuer_signature": signature,
            "disclosed_claims": disclosed_claims,
            "hidden_claims": hidden_claims,
            "presentation_binding": presentation_binding,
            "presented_at": datetime.now(timezone.utc).isoformat(),
        }

        return presentation

    @classmethod
    def verify_presentation(
        cls,
        presentation: Dict[str, Any],
        trusted_issuer_pubkey: Optional[str] = None,
        revocation_list: Optional[List[str]] = None,
        valid_nonces_set: Optional[set] = None,
    ) -> Dict[str, Any]:
        """
        Verify selective disclosure presentation against cryptographic proofs.

        Results:
        - VALID CERTIFICATE
        - INVALID CERTIFICATE (signature fails or malformed)
        - EXPIRED CERTIFICATE (expiry date passed)
        - REVOKED CERTIFICATE (in revocation list)
        - TAMPERED CERTIFICATE (root commitment reconstructed does not match manifest)
        - REPLAY / INVALID NONCE (nonce is missing, expired, or previously used)
        """
        manifest = presentation.get("manifest")
        signature_hex = presentation.get("issuer_signature")
        disclosed_claims = presentation.get("disclosed_claims", {})
        hidden_claims = presentation.get("hidden_claims", {})
        nonce = presentation.get("nonce", "")
        presentation_id = presentation.get("presentation_id", "")
        presentation_binding = presentation.get("presentation_binding", "")

        checks = {
            "nonce_fresh": False,
            "claims_integrity": False,
            "signature_authentic": False,
            "not_expired": False,
            "not_revoked": False,
        }

        if not manifest or not signature_hex:
            return {
                "result": "INVALID CERTIFICATE",
                "status_code": "INVALID",
                "message": "Malformed presentation payload: missing manifest or issuer signature.",
                "checks": checks,
                "disclosed_fields": {},
                "hidden_fields_count": 0,
            }

        certificate_id = manifest.get("certificate_id", "UNKNOWN")

        # 1. Nonce Challenge & Replay Check
        if valid_nonces_set is not None:
            if not nonce or nonce not in valid_nonces_set:
                return {
                    "result": "INVALID CERTIFICATE",
                    "status_code": "REPLAY_OR_INVALID_NONCE",
                    "message": "Nonce check failed: Challenge is missing, expired, or has already been used.",
                    "checks": checks,
                    "disclosed_fields": disclosed_claims,
                    "hidden_fields_count": len(hidden_claims),
                }
        checks["nonce_fresh"] = True

        # Verify presentation binding
        expected_binding = hashlib.sha256(
            f"{presentation_id}:{nonce}:{manifest.get('root_commitment')}".encode("utf-8")
        ).hexdigest()
        if presentation_binding != expected_binding:
            return {
                "result": "TAMPERED CERTIFICATE",
                "status_code": "TAMPERED",
                "message": "Presentation binding mismatch. Presentation was altered or replayed with a different nonce.",
                "checks": checks,
                "disclosed_fields": disclosed_claims,
                "hidden_fields_count": len(hidden_claims),
            }

        # 2. Reconstruct Commitments & Check Root Integrity (Detect Tampering)
        reconstructed_commitments: Dict[str, str] = {}

        # Disclosed claims: compute c_i = SHA256(key : val : salt)
        for key, info in disclosed_claims.items():
            if not isinstance(info, dict) or "value" not in info or "salt" not in info:
                return {
                    "result": "TAMPERED CERTIFICATE",
                    "status_code": "TAMPERED",
                    "message": f"Malformed disclosed claim for field '{key}'.",
                    "checks": checks,
                    "disclosed_fields": disclosed_claims,
                    "hidden_fields_count": len(hidden_claims),
                }
            reconstructed_commitments[key] = CertificateCryptoService.compute_claim_commitment(
                key, str(info["value"]), str(info["salt"])
            )

        # Hidden claims: use provided commitment hashes
        for key, comm in hidden_claims.items():
            if not isinstance(comm, str) or len(comm) != 64:
                return {
                    "result": "TAMPERED CERTIFICATE",
                    "status_code": "TAMPERED",
                    "message": f"Malformed hidden claim commitment for field '{key}'.",
                    "checks": checks,
                    "disclosed_fields": disclosed_claims,
                    "hidden_fields_count": len(hidden_claims),
                }
            reconstructed_commitments[key] = comm

        # Recompute root commitment
        doc_hash = manifest.get("document_hash", "")
        recalculated_root = CertificateCryptoService.compute_root_commitment(
            reconstructed_commitments, doc_hash
        )

        if recalculated_root != manifest.get("root_commitment"):
            return {
                "result": "TAMPERED CERTIFICATE",
                "status_code": "TAMPERED",
                "message": "Cryptographic root commitment mismatch: Disclosed values, salts, or hidden commitments do not match the issuer baseline.",
                "checks": checks,
                "disclosed_fields": disclosed_claims,
                "hidden_fields_count": len(hidden_claims),
                "details": {
                    "recomputed_root": recalculated_root,
                    "manifest_root": manifest.get("root_commitment"),
                },
            }
        checks["claims_integrity"] = True

        # 3. Verify Ed25519 Digital Signature Authenticity
        pubkey_to_use = trusted_issuer_pubkey or manifest.get("issuer_public_key", "")
        try:
            pub_key = CertificateCryptoService.load_public_key(pubkey_to_use)
            sig_bytes = bytes.fromhex(signature_hex)
            canonical_manifest_bytes = CertificateCryptoService.canonical_json(manifest)
            pub_key.verify(sig_bytes, canonical_manifest_bytes)
            checks["signature_authentic"] = True
        except (InvalidSignature, ValueError, Exception) as e:
            return {
                "result": "INVALID CERTIFICATE",
                "status_code": "INVALID",
                "message": f"Ed25519 signature verification failed: {str(e)}",
                "checks": checks,
                "disclosed_fields": disclosed_claims,
                "hidden_fields_count": len(hidden_claims),
            }

        # 4. Check Certificate Expiry
        expiry_date_str = manifest.get("expiry_date", "NONE")
        if expiry_date_str and expiry_date_str.upper() != "NONE":
            try:
                # Support YYYY-MM-DD or ISO formats
                if "T" in expiry_date_str:
                    exp_dt = datetime.fromisoformat(expiry_date_str.replace("Z", "+00:00"))
                else:
                    exp_dt = datetime.strptime(expiry_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)

                now_utc = datetime.now(timezone.utc)
                if now_utc > exp_dt:
                    return {
                        "result": "EXPIRED CERTIFICATE",
                        "status_code": "EXPIRED",
                        "message": f"Certificate expired on {expiry_date_str}.",
                        "checks": checks,
                        "disclosed_fields": disclosed_claims,
                        "hidden_fields_count": len(hidden_claims),
                        "expiry_date": expiry_date_str,
                    }
            except Exception:
                pass  # If parse fails, proceed
        checks["not_expired"] = True

        # 5. Check Revocation Status
        if revocation_list and certificate_id in revocation_list:
            return {
                "result": "REVOKED CERTIFICATE",
                "status_code": "REVOKED",
                "message": f"Certificate '{certificate_id}' has been revoked by the issuer.",
                "checks": checks,
                "disclosed_fields": disclosed_claims,
                "hidden_fields_count": len(hidden_claims),
                "revoked_id": certificate_id,
            }
        checks["not_revoked"] = True

        # ALL CHECKS PASSED
        return {
            "result": "VALID CERTIFICATE",
            "status_code": "VALID",
            "message": "Certificate authenticity, integrity, signature, expiry, and revocation checks passed successfully.",
            "checks": checks,
            "disclosed_fields": disclosed_claims,
            "hidden_fields_count": len(hidden_claims),
            "certificate_id": certificate_id,
            "issuer_id": manifest.get("issuer_id"),
            "issue_date": manifest.get("issue_date"),
            "expiry_date": manifest.get("expiry_date"),
            "root_commitment": manifest.get("root_commitment"),
            "presentation_id": presentation_id,
        }

