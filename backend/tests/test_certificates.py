"""
Automated Pytest Suite for Privacy-Preserving Certificate Verification System
Tests:
- Ed25519 key generation, signing, and verification
- Attribute salted hash commitments & root commitment integrity
- Selective disclosure (disclosing subset of claims, withholding private claims)
- Multi-state verification (VALID, TAMPERED, INVALID, EXPIRED, REVOKED, REPLAY)
- Anti-replay nonce challenges
"""

import json
from datetime import datetime, timezone, timedelta
import pytest
from app.certificate_service import CertificateCryptoService, CertificateManager


@pytest.fixture
def sample_claims():
    return {
        "recipient_name": "Alice Smith",
        "degree": "Master of Science in Cybersecurity",
        "institution": "Tech University",
        "major": "Computer Science",
        "grade_gpa": "3.95",
        "honors": "Summa Cum Laude",
    }


def test_ed25519_key_management():
    """Test Ed25519 keypair generation and serialization formats."""
    keys = CertificateCryptoService.generate_new_keypair()
    assert "private_key_pem" in keys
    assert "public_key_pem" in keys
    assert "public_key_hex" in keys
    assert len(keys["public_key_hex"]) == 64

    # Load public key from hex
    pub = CertificateCryptoService.load_public_key(keys["public_key_hex"])
    priv = CertificateCryptoService.load_private_key(keys["private_key_pem"])

    # Sign & verify
    data = b"Cryptographic Provenance Baseline"
    sig = priv.sign(data)
    pub.verify(sig, data)


def test_salted_commitment_properties(sample_claims):
    """Test that commitments are deterministic given same salt, but distinct with different salt."""
    salt1 = "a" * 64
    salt2 = "b" * 64

    comm1 = CertificateCryptoService.compute_claim_commitment("degree", sample_claims["degree"], salt1)
    comm2 = CertificateCryptoService.compute_claim_commitment("degree", sample_claims["degree"], salt1)
    comm3 = CertificateCryptoService.compute_claim_commitment("degree", sample_claims["degree"], salt2)

    assert comm1 == comm2
    assert comm1 != comm3
    assert len(comm1) == 64


def test_issue_and_selective_disclosure_valid(sample_claims):
    """Test issuing a certificate and verifying a selective disclosure presentation."""
    cert_id = "CERT-TEST-001"
    issuer_id = "National Accreditation Council"
    issue_date = "2026-01-01"
    expiry_date = "2030-01-01"

    # Issue
    pkg = CertificateManager.issue_certificate(
        certificate_id=cert_id,
        issuer_id=issuer_id,
        claims=sample_claims,
        issue_date=issue_date,
        expiry_date=expiry_date,
    )

    assert pkg["manifest"]["certificate_id"] == cert_id
    assert len(pkg["claims"]) == len(sample_claims)

    # Holder chooses to disclose ONLY 'degree' and 'institution', hiding 'recipient_name', 'grade_gpa', etc.
    disclosed = ["degree", "institution"]
    nonce = "test-challenge-nonce-12345"

    presentation = CertificateManager.create_selective_presentation(
        credential_package=pkg,
        disclosed_keys=disclosed,
        verifier_nonce=nonce,
    )

    assert set(presentation["disclosed_claims"].keys()) == {"degree", "institution"}
    assert "recipient_name" not in presentation["disclosed_claims"]
    assert "grade_gpa" not in presentation["disclosed_claims"]
    # Verify hidden claims exist as blind commitment hashes only
    assert "recipient_name" in presentation["hidden_claims"]
    assert "grade_gpa" in presentation["hidden_claims"]

    # Verify presentation
    result = CertificateManager.verify_presentation(
        presentation=presentation,
        revocation_list=[],
        valid_nonces_set={nonce},
    )

    assert result["status_code"] == "VALID"
    assert result["result"] == "VALID CERTIFICATE"
    assert result["checks"]["signature_authentic"] is True
    assert result["checks"]["claims_integrity"] is True
    assert result["checks"]["not_expired"] is True
    assert result["checks"]["not_revoked"] is True
    assert result["disclosed_fields"]["degree"]["value"] == "Master of Science in Cybersecurity"


def test_tamper_detection(sample_claims):
    """Test that tampering with disclosed claim value or salt fails verification."""
    pkg = CertificateManager.issue_certificate(
        certificate_id="CERT-TEST-TAMPER",
        issuer_id="Tech University",
        claims=sample_claims,
        issue_date="2026-01-01",
    )

    presentation = CertificateManager.create_selective_presentation(
        credential_package=pkg,
        disclosed_keys=["degree"],
        verifier_nonce="test-nonce-tamper",
    )

    # Tamper with disclosed claim value
    presentation["disclosed_claims"]["degree"]["value"] = "Ph.D. in Quantum Cryptography"

    result = CertificateManager.verify_presentation(
        presentation=presentation,
        revocation_list=[],
        valid_nonces_set={"test-nonce-tamper"},
    )

    assert result["status_code"] == "TAMPERED"
    assert result["result"] == "TAMPERED CERTIFICATE"


def test_tamper_hidden_claim_commitment(sample_claims):
    """Test that tampering with a hidden claim's commitment hash fails verification."""
    pkg = CertificateManager.issue_certificate(
        certificate_id="CERT-TEST-TAMPER-HIDDEN",
        issuer_id="Tech University",
        claims=sample_claims,
        issue_date="2026-01-01",
    )

    presentation = CertificateManager.create_selective_presentation(
        credential_package=pkg,
        disclosed_keys=["degree"],
        verifier_nonce="test-nonce-hidden",
    )

    # Tamper with hidden claim hash
    presentation["hidden_claims"]["recipient_name"] = "0" * 64

    result = CertificateManager.verify_presentation(
        presentation=presentation,
        revocation_list=[],
        valid_nonces_set={"test-nonce-hidden"},
    )

    assert result["status_code"] == "TAMPERED"
    assert result["result"] == "TAMPERED CERTIFICATE"


def test_expired_certificate(sample_claims):
    """Test that an expired certificate is correctly identified."""
    past_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")

    pkg = CertificateManager.issue_certificate(
        certificate_id="CERT-TEST-EXPIRED",
        issuer_id="Tech University",
        claims=sample_claims,
        issue_date="2020-01-01",
        expiry_date=past_date,
    )

    presentation = CertificateManager.create_selective_presentation(
        credential_package=pkg,
        disclosed_keys=["degree"],
        verifier_nonce="test-nonce-exp",
    )

    result = CertificateManager.verify_presentation(
        presentation=presentation,
        revocation_list=[],
        valid_nonces_set={"test-nonce-exp"},
    )

    assert result["status_code"] == "EXPIRED"
    assert result["result"] == "EXPIRED CERTIFICATE"


def test_revoked_certificate(sample_claims):
    """Test that a revoked certificate in revocation list fails verification."""
    cert_id = "CERT-TEST-REVOKED"
    pkg = CertificateManager.issue_certificate(
        certificate_id=cert_id,
        issuer_id="Tech University",
        claims=sample_claims,
        issue_date="2026-01-01",
    )

    presentation = CertificateManager.create_selective_presentation(
        credential_package=pkg,
        disclosed_keys=["degree"],
        verifier_nonce="test-nonce-rev",
    )

    result = CertificateManager.verify_presentation(
        presentation=presentation,
        revocation_list=[cert_id],
        valid_nonces_set={"test-nonce-rev"},
    )

    assert result["status_code"] == "REVOKED"
    assert result["result"] == "REVOKED CERTIFICATE"


def test_anti_replay_nonce():
    """Test that missing or unlisted nonce is rejected."""
    pkg = CertificateManager.issue_certificate(
        certificate_id="CERT-TEST-NONCE",
        issuer_id="Tech University",
        claims={"field": "value"},
        issue_date="2026-01-01",
    )

    presentation = CertificateManager.create_selective_presentation(
        credential_package=pkg,
        disclosed_keys=["field"],
        verifier_nonce="valid-nonce",
    )

    # Verifier only knows 'different-nonce'
    result = CertificateManager.verify_presentation(
        presentation=presentation,
        revocation_list=[],
        valid_nonces_set={"different-nonce"},
    )

    assert result["status_code"] == "REPLAY_OR_INVALID_NONCE"

