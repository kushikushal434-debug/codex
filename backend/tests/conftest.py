import sys
import tempfile
import shutil
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from app import create_app
from app.db import init_db
from app.crypto_service import CryptoService

@pytest.fixture
def temp_environment():
    temp_dir = Path(tempfile.mkdtemp())
    storage_dir = temp_dir / "storage"
    uploads_dir = storage_dir / "uploads"
    keys_dir = storage_dir / "keys"
    db_path = storage_dir / "test_provenance.db"

    uploads_dir.mkdir(parents=True, exist_ok=True)
    keys_dir.mkdir(parents=True, exist_ok=True)

    test_crypto = CryptoService(keys_dir=keys_dir)

    yield {
        "temp_dir": temp_dir,
        "storage_dir": storage_dir,
        "uploads_dir": uploads_dir,
        "keys_dir": keys_dir,
        "db_path": db_path,
        "crypto": test_crypto
    }

    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture
def app(temp_environment):
    test_config = {
        "TESTING": True,
        "SECRET_KEY": "test-secret-key-high-entropy",
        "DATABASE_PATH": temp_environment["db_path"],
        "STORAGE_DIR": temp_environment["storage_dir"],
        "UPLOADS_DIR": temp_environment["uploads_dir"],
        "KEYS_DIR": temp_environment["keys_dir"],
        "MAX_CONTENT_LENGTH": 16 * 1024 * 1024,
        "WTF_CSRF_ENABLED": False
    }

    application = create_app(test_config=test_config)
    with application.app_context():
        init_db(temp_environment["db_path"])

    yield application

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def auth_client(client):
    """Client with an authenticated normal user session and CSRF token."""
    res = client.post("/api/auth/register", json={
        "username": "testuser",
        "email": "testuser@example.com",
        "password": "Password123!"
    })
    data = res.get_json()
    csrf_token = data.get("csrf_token")
    return client, csrf_token, data["user"]

@pytest.fixture
def admin_client(client):
    """Client with an authenticated admin session and CSRF token."""
    # First user registered is admin
    res = client.post("/api/auth/register", json={
        "username": "adminmaster",
        "email": "adminmaster@provenance.local",
        "password": "AdminPassword123!"
    })
    data = res.get_json()
    csrf_token = data.get("csrf_token")
    return client, csrf_token, data["user"]
