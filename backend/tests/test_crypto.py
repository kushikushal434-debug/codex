import io
import pytest
from app.crypto_service import CryptoService

def test_sha256_computation(temp_environment):
    crypto = temp_environment["crypto"]
    test_bytes = b"Trust, Privacy and Digital Provenance 2026"
    expected = "f2596e107575fa3d8df5a54db3ea076e737992cb58ae2c488b0ebf49e4726e69"
    # Byte hashing
    h1 = crypto.compute_sha256_bytes(test_bytes)
    assert len(h1) == 64
    assert h1 == h1.lower()

    # Stream hashing
    stream = io.BytesIO(test_bytes)
    h2 = crypto.compute_sha256_stream(stream)
    assert h1 == h2

def test_canonical_json_determinism(temp_environment):
    crypto = temp_environment["crypto"]
    d1 = {"z": 10, "a": 20, "m": {"b": 2, "a": 1}}
    d2 = {"a": 20, "m": {"a": 1, "b": 2}, "z": 10}

    s1 = crypto.canonical_json(d1)
    s2 = crypto.canonical_json(d2)

    assert s1 == s2
    assert s1 == '{"a":20,"m":{"a":1,"b":2},"z":10}'

def test_rsa_pss_signing_and_verification(temp_environment):
    crypto = temp_environment["crypto"]
    payload = crypto.canonical_json({"asset": "document.pdf", "hash": "abc12345"})

    signature = crypto.sign_payload(payload)
    assert isinstance(signature, str)
    assert len(signature) > 100

    # Verify signature passes
    assert crypto.verify_signature(payload, signature) is True

    # Tampered payload fails
    tampered_payload = crypto.canonical_json({"asset": "document.pdf", "hash": "abc12346"})
    assert crypto.verify_signature(tampered_payload, signature) is False

    # Corrupted signature fails gracefully
    corrupted_sig = signature[:-4] + "AAAA"
    assert crypto.verify_signature(payload, corrupted_sig) is False

def test_public_key_fingerprint(temp_environment):
    crypto = temp_environment["crypto"]
    fp = crypto.public_key_fingerprint
    assert len(fp) == 64
    assert fp.isalnum()
    assert "BEGIN PUBLIC KEY" in crypto.public_key_pem
