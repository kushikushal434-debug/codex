from flask import g, current_app
from .config import Config

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id TEXT UNIQUE NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    privacy_level TEXT NOT NULL DEFAULT 'PRIVATE',  -- 'PRIVATE', 'VERIFY_ONLY', 'PUBLIC'
    tags TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS provenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id TEXT UNIQUE NOT NULL,
    file_hash TEXT NOT NULL,
    canonical_payload TEXT NOT NULL,
    rsa_signature TEXT NOT NULL,
    public_key_fingerprint TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (registration_id) REFERENCES files (registration_id)
);

CREATE TABLE IF NOT EXISTS verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id TEXT,
    candidate_hash TEXT NOT NULL,
    result TEXT NOT NULL,  -- 'MATCH', 'MODIFIED', 'UNKNOWN'
    verifier_id INTEGER,
    verifier_ip_hash TEXT,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details TEXT,
    FOREIGN KEY (verifier_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_index INTEGER UNIQUE NOT NULL,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id INTEGER,
    resource_id TEXT,
    details TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkpoint_id TEXT UNIQUE NOT NULL,
    block_start INTEGER NOT NULL,
    block_end INTEGER NOT NULL,
    root_hash TEXT NOT NULL,
    rsa_signature TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS issued_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certificate_id TEXT UNIQUE NOT NULL,
    issuer_id TEXT NOT NULL,
    document_filename TEXT,
    document_hash TEXT NOT NULL,
    root_commitment TEXT NOT NULL,
    ed25519_signature TEXT NOT NULL,
    issuer_public_key TEXT NOT NULL,
    claims_json TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    expiry_date TEXT,
    is_revoked INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS certificate_revocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certificate_id TEXT UNIQUE NOT NULL,
    revocation_reason TEXT NOT NULL,
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    issuer_signature TEXT
);

CREATE TABLE IF NOT EXISTS verification_nonces (
    nonce TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_used INTEGER DEFAULT 0,
    verifier_label TEXT
);

CREATE TABLE IF NOT EXISTS certificate_verification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    presentation_id TEXT NOT NULL,
    certificate_id TEXT NOT NULL,
    verification_result TEXT NOT NULL,
    disclosed_fields TEXT,
    hidden_fields_count INTEGER,
    details TEXT,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_files_hash ON files(file_hash);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_reg_id ON files(registration_id);
CREATE INDEX IF NOT EXISTS idx_audit_block ON audit_logs(block_index);
CREATE INDEX IF NOT EXISTS idx_verif_reg ON verifications(registration_id);
CREATE INDEX IF NOT EXISTS idx_cert_id ON issued_certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_cert_rev ON certificate_revocations(certificate_id);
"""

import sqlite3

def get_db(db_path=None):
    """Retrieve or create a database connection for current request context."""
    if db_path is None:
        try:
            path = current_app.config.get("DATABASE_PATH", Config.DATABASE_PATH)
        except RuntimeError:
            path = Config.DATABASE_PATH
    else:
        path = db_path

    if 'db' not in g:
        Config.ensure_directories()
        g.db = sqlite3.connect(path)
        g.db.row_factory = sqlite3.Row
        # Enable foreign keys
        g.db.execute("PRAGMA foreign_keys = ON;")
    return g.db

def close_db(e=None):
    """Close the database connection if open."""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db(db_path=None):
    """Initialize database tables with schema."""
    path = db_path or Config.DATABASE_PATH
    Config.ensure_directories()
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    with conn:
        conn.executescript(SCHEMA_SQL)
    conn.close()
