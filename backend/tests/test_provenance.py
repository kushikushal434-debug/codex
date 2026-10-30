import io
import pytest

def test_file_registration_and_provenance(auth_client):
    client, csrf, user = auth_client

    sample_content = b"%PDF-1.4\nSample verifiable test document\n%%EOF"
    data = {
        "file": (io.BytesIO(sample_content), "contract.pdf"),
        "privacy_level": "PUBLIC",
        "tags": "contract, test",
        "description": "Standard public test contract."
    }

    res = client.post("/api/files/register", data=data, headers={"X-CSRF-Token": csrf})
    assert res.status_code == 201
    payload = res.get_json()

    assert "file" in payload
    assert "provenance" in payload

    reg_id = payload["file"]["registration_id"]
    file_hash = payload["file"]["file_hash"]
    signature = payload["provenance"]["rsa_signature"]

    assert reg_id.startswith("REG-")
    assert len(file_hash) == 64
    assert len(signature) > 100

def test_verification_tri_state_logic(auth_client):
    client, csrf, user = auth_client

    # 1. Register base file
    original_bytes = b"%PDF-1.4\nOriginal unaltered bitstream.\n%%EOF"
    res = client.post(
        "/api/files/register",
        data={
            "file": (io.BytesIO(original_bytes), "original.pdf"),
            "privacy_level": "PUBLIC"
        },
        headers={"X-CSRF-Token": csrf}
    )
    reg_id = res.get_json()["file"]["registration_id"]
    reg_hash = res.get_json()["file"]["file_hash"]

    # CASE A: EXACT MATCH (identical candidate bytes)
    match_res = client.post(
        "/api/verify",
        data={
            "registration_id": reg_id,
            "file": (io.BytesIO(original_bytes), "original_candidate.pdf")
        }
    )
    assert match_res.status_code == 200
    match_data = match_res.get_json()
    assert match_data["result"] == "MATCH"
    assert match_data["signature_valid"] is True
    assert "academic_disclaimer" in match_data

    # CASE B: MODIFIED (Registration ID exists, but candidate bytes altered)
    modified_bytes = b"%PDF-1.4\nTampered and altered bitstream!\n%%EOF"
    mod_res = client.post(
        "/api/verify",
        data={
            "registration_id": reg_id,
            "file": (io.BytesIO(modified_bytes), "altered_candidate.pdf")
        }
    )
    assert mod_res.status_code == 200
    mod_data = mod_res.get_json()
    assert mod_data["result"] == "MODIFIED"
    assert "mismatch" in mod_data["explanation"].lower()

    # CASE C: UNKNOWN (Unknown registration ID)
    unknown_res = client.post(
        "/api/verify",
        data={
            "registration_id": "REG-99999999-NOTFOUND",
            "file": (io.BytesIO(original_bytes), "candidate.pdf")
        }
    )
    assert unknown_res.status_code == 200
    unknown_data = unknown_res.get_json()
    assert unknown_data["result"] == "UNKNOWN"

    # CASE D: UNKNOWN (Standalone unknown hash without registration ID)
    unknown_hash_res = client.post(
        "/api/verify",
        json={"candidate_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
    )
    assert unknown_hash_res.status_code == 200
    assert unknown_hash_res.get_json()["result"] == "UNKNOWN"

def test_privacy_enforcement_levels(client):
    # Register Owner
    owner_res = client.post("/api/auth/register", json={
        "username": "alice_owner",
        "email": "alice_owner@test.com",
        "password": "Password123!"
    })
    owner_csrf = owner_res.get_json()["csrf_token"]

    # Register 1 PRIVATE file and 1 VERIFY_ONLY file
    pdf_bytes = b"%PDF-1.4\nConfidential Data\n%%EOF"
    priv_file = client.post(
        "/api/files/register",
        data={
            "file": (io.BytesIO(pdf_bytes), "private.pdf"),
            "privacy_level": "PRIVATE"
        },
        headers={"X-CSRF-Token": owner_csrf}
    ).get_json()["file"]

    verify_only_file = client.post(
        "/api/files/register",
        data={
            "file": (io.BytesIO(pdf_bytes), "redacted.pdf"),
            "privacy_level": "VERIFY_ONLY"
        },
        headers={"X-CSRF-Token": owner_csrf}
    ).get_json()["file"]

    # Logout owner
    client.post("/api/auth/logout", headers={"X-CSRF-Token": owner_csrf})

    # 1. PRIVATE file verification by unauthenticated user -> 403 Restricted
    priv_verify = client.post(
        "/api/verify",
        data={
            "registration_id": priv_file["registration_id"],
            "file": (io.BytesIO(pdf_bytes), "attempt.pdf")
        }
    )
    assert priv_verify.status_code == 403

    # 2. VERIFY_ONLY file verification by unauthenticated user -> Allowed, but metadata REDACTED
    vo_verify = client.post(
        "/api/verify",
        data={
            "registration_id": verify_only_file["registration_id"],
            "file": (io.BytesIO(pdf_bytes), "attempt.pdf")
        }
    )
    assert vo_verify.status_code == 200
    vo_data = vo_verify.get_json()
    assert vo_data["result"] == "MATCH"
    assert vo_data["provenance"]["redacted"] is True
    assert "REDACTED" in vo_data["provenance"]["owner"]

def test_secure_download_ownership(client):
    # Owner
    owner_res = client.post("/api/auth/register", json={
        "username": "download_owner",
        "email": "down@test.com",
        "password": "Password123!"
    })
    owner_csrf = owner_res.get_json()["csrf_token"]

    content = b"%PDF-1.4\nSecure Contract Bits\n%%EOF"
    f_res = client.post(
        "/api/files/register",
        data={"file": (io.BytesIO(content), "my_contract.pdf")},
        headers={"X-CSRF-Token": owner_csrf}
    ).get_json()
    reg_id = f_res["file"]["registration_id"]

    # Owner can download
    down_ok = client.get(f"/api/files/{reg_id}/download")
    assert down_ok.status_code == 200
    assert down_ok.data == content

    # Logout and login as other user
    client.post("/api/auth/logout", headers={"X-CSRF-Token": owner_csrf})
    other_res = client.post("/api/auth/register", json={
        "username": "other_person",
        "email": "other@test.com",
        "password": "Password123!"
    })
    other_csrf = other_res.get_json()["csrf_token"]

    # Other user cannot download -> 403 Unauthorized
    down_unauth = client.get(f"/api/files/{reg_id}/download")
    assert down_unauth.status_code == 403
