import pytest

def test_register_and_password_hashing(client, app):
    res = client.post("/api/auth/register", json={
        "username": "securitytester",
        "email": "security@example.com",
        "password": "SecurePassword123!"
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data["user"]["username"] == "securitytester"
    assert "csrf_token" in data

    # Verify password is not plaintext in database
    from app.db import get_db
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        cursor.execute("SELECT password_hash FROM users WHERE username = 'securitytester'")
        row = cursor.fetchone()
        assert row is not None
        assert row["password_hash"] != "SecurePassword123!"
        assert "scrypt:" in row["password_hash"] or "pbkdf2:" in row["password_hash"]

def test_duplicate_registration_rejected(client):
    client.post("/api/auth/register", json={
        "username": "duplicateuser",
        "email": "dup@example.com",
        "password": "Password123!"
    })
    # Second attempt
    res = client.post("/api/auth/register", json={
        "username": "duplicateuser",
        "email": "other@example.com",
        "password": "Password123!"
    })
    assert res.status_code == 409

def test_login_success_and_failure(client):
    client.post("/api/auth/register", json={
        "username": "loginuser",
        "email": "loginuser@example.com",
        "password": "Password123!"
    })

    # Successful login
    res_ok = client.post("/api/auth/login", json={
        "username_or_email": "loginuser",
        "password": "Password123!"
    })
    assert res_ok.status_code == 200
    assert "csrf_token" in res_ok.get_json()

    # Wrong password
    res_bad = client.post("/api/auth/login", json={
        "username_or_email": "loginuser",
        "password": "WrongPassword!"
    })
    assert res_bad.status_code == 401

def test_csrf_protection_for_authenticated_state_changes(client):
    # Register user
    res = client.post("/api/auth/register", json={
        "username": "csrftester",
        "email": "csrf@example.com",
        "password": "Password123!"
    })
    csrf_token = res.get_json()["csrf_token"]

    # Mutating request WITHOUT CSRF header should be rejected
    res_no_csrf = client.post("/api/files/register", data={})
    assert res_no_csrf.status_code == 403
    assert res_no_csrf.get_json().get("code") == "CSRF_FAILED"

    # Mutating request WITH correct CSRF header is allowed past CSRF gate
    # (returns 400 because form has no file, not 403 CSRF_FAILED)
    res_with_csrf = client.post("/api/files/register", data={}, headers={"X-CSRF-Token": csrf_token})
    assert res_with_csrf.status_code == 400
    assert res_with_csrf.get_json().get("code") != "CSRF_FAILED"

def test_rbac_admin_route_protection(client):
    # 1. Register first user (Admin)
    admin_res = client.post("/api/auth/register", json={
        "username": "admin1",
        "email": "admin1@example.com",
        "password": "Password123!"
    })
    admin_csrf = admin_res.get_json()["csrf_token"]

    # Admin accesses stats
    stats_ok = client.get("/api/admin/stats", headers={"X-CSRF-Token": admin_csrf})
    assert stats_ok.status_code == 200

    # 2. Register second user (Normal user)
    client.post("/api/auth/logout", headers={"X-CSRF-Token": admin_csrf})
    user_res = client.post("/api/auth/register", json={
        "username": "normal1",
        "email": "normal1@example.com",
        "password": "Password123!"
    })
    user_csrf = user_res.get_json()["csrf_token"]

    # Normal user attempts admin access -> 403 Forbidden
    stats_forbidden = client.get("/api/admin/stats", headers={"X-CSRF-Token": user_csrf})
    assert stats_forbidden.status_code == 403
