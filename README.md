# TRUST, PRIVACY & DIGITAL PROVENANCE
**Privacy-Preserving Digital File Verification Platform with Cryptographic Provenance & Tamper-Evident Audit Trails**

---

## 1. Project Overview & Objective

In modern information security, establishing the authenticity and integrity of digital artifacts (such as legal contracts, research whitepapers, architectural blueprints, and audit records) is paramount. Traditional checksums do not identify authorship, while conventional public ledgers often expose confidential data.

**Trust, Privacy & Digital Provenance** is a full-stack cybersecurity platform designed to:
1. **Register digital files** and compute streaming SHA-256 digests.
2. **Issue digitally signed provenance records** using RSA-PSS (2048-bit) signatures to guarantee non-repudiation.
3. **Protect user privacy** through granular disclosure tiers (`PRIVATE`, `VERIFY_ONLY`, `PUBLIC`), allowing zero-knowledge verification where third parties can verify bitstream integrity without exposing the owner's identity or original document name.
4. **Maintain a tamper-evident audit ledger** sequentially linked with cryptographic hash pointers ($H_i = \text{SHA256}(H_{i-1} \parallel \text{data})$), backed by periodic signed checkpoints.
5. **Enforce sound cryptographic tri-state logic**:
   - `MATCH`: Candidate file bitstream matches the registered baseline AND the RSA-PSS signature verifies.
   - `MODIFIED`: Registration ID exists, but candidate file hash differs from the registered digest.
   - `UNKNOWN`: The registration ID does not exist, or the candidate digest is untracked.

> **Academic & Cybersecurity Disclaimer**:  
> A cryptographic hash match mathematically proves bit-level consistency with a previously recorded reference state. It does **not** prove that the real-world content of a document is factually true, legally binding, or free from human deception.

---

## 2. Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide-React
- **Backend**: Python 3.12, Flask, Flask-CORS, Werkzeug (password hashing & sessions)
- **Cryptography**: PyCA `cryptography` library (RSA-PSS with SHA-256 and MGF1, SHA-256 streaming)
- **Database**: SQLite with parameterized queries
- **Testing**: Pytest (23 comprehensive automated tests covering all modules)

---

## 3. System Architecture & Directory Structure

```
codex/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Flask application factory, CORS, CSRF hook, error handlers
│   │   ├── config.py            # Environment configuration & directory paths
│   │   ├── db.py                # Database connection & schema setup
│   │   ├── crypto_service.py    # SHA-256, RSA-PSS sign/verify, canonical JSON serializer
│   │   ├── audit_service.py     # Sequential hash-chain ledger, validation, signed checkpoints
│   │   ├── file_validator.py    # Magic bytes verification (PDF, JPG, PNG, TXT, DOCX) & size checks
│   │   ├── routes/
│   │   │   ├── auth.py          # Registration, login, logout, session info, CSRF token
│   │   │   ├── files.py         # File registration, list, download with ownership, privacy update
│   │   │   ├── verify.py        # Tri-state verification engine & history timeline
│   │   │   ├── audit.py         # Audit log retrieval, chain validation, tamper simulator
│   │   │   └── admin.py         # Admin metrics, user role management, system-wide files
│   │   └── seed_data.py         # Demo accounts, sample files, initial provenance & checkpoints
│   ├── storage/
│   │   ├── keys/                # RSA private & public keys
│   │   ├── uploads/             # Secure UUID-named binary files (isolated from web root)
│   │   └── sample_files/        # Pre-generated sample documents
│   ├── tests/
│   │   ├── conftest.py          # Isolated test database and client fixtures
│   │   ├── test_crypto.py       # SHA-256, canonical JSON, RSA-PSS signature verification
│   │   ├── test_file_validation.py # Magic bytes, spoofing detection, size limits
│   │   ├── test_auth.py         # Password hashing, sessions, CSRF protection, RBAC
│   │   ├── test_provenance.py   # Registration, MATCH/MODIFIED/UNKNOWN, privacy tiers
│   │   └── test_audit_chain.py  # Hash chain integrity, tamper detection, signed checkpoints
│   ├── requirements.txt
│   ├── .env.example
│   ├── .env
│   └── run.py                   # Backend entrypoint (port 5000)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx       # Header navigation and session controls
│   │   │   ├── Footer.jsx       # Academic footnote and architecture summary
│   │   │   ├── StatusBadges.jsx # MATCH, MODIFIED, UNKNOWN & privacy badges
│   │   │   └── HashDisplay.jsx  # Monospace digest display with one-click copy
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Session state, login, register, logout
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    # Real-time metrics, quick verify, chain status
│   │   │   ├── RegisterFile.jsx # Drag-and-drop secure file registration
│   │   │   ├── VerifyFile.jsx   # Tri-state verification & history timeline
│   │   │   ├── MyFiles.jsx      # Asset portfolio, download, privacy editor
│   │   │   ├── AuditTrail.jsx   # Hash chain visualizer, checkpoints, tamper demo
│   │   │   ├── AdminDashboard.jsx # System metrics, user roles, global registry
│   │   │   ├── Login.jsx        # Sign-in with quick-fill demo accounts
│   │   │   └── Register.jsx     # User registration form
│   │   ├── services/
│   │   │   └── api.js           # API client with CSRF token injection
│   │   ├── App.jsx              # Application router & main layout
│   │   ├── main.jsx
│   │   └── index.css            # Tailwind CSS & cybersecurity theme
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## 4. Key Security & Academic Features

### A. Cryptographic Integrity & Non-Repudiation
- **Streaming SHA-256**: Computed in 64 KB chunks server-side to prevent memory exhaustion.
- **Canonical JSON Serialization**: Whitespace and key order are deterministically standardized (`json.dumps(..., sort_keys=True, separators=(',', ':'))`) so representations are identical across environments.
- **RSA-PSS 2048**: Employs Probabilistic Signature Scheme (PSS) padding with MGF1 and SHA-256 for provable resistance against forgery.
- **Authority Public Key Transparency**: Endpoint `/api/provenance/public-key` allows any third party to independently verify RSA-PSS signatures offline.

### B. Defensive File Validation & Storage Isolation
- **Magic Bytes Inspection**: Inspects binary headers to reject file extension spoofing (e.g. an executable renamed to `.pdf`).
  - PDF: `%PDF-`
  - JPEG: `\xFF\xD8\xFF`
  - PNG: `\x89PNG\r\n\x1a\n`
  - DOCX: `PK\x03\x04`
  - TXT: UTF-8 / ASCII validation with zero null byte control characters.
- **Safe File Storage**: Physical files are stored in `backend/storage/uploads/` named strictly with random UUIDs (`<uuid4>.bin`). Original filenames are stored only in the parameterized database.
- **Path Traversal Protection**: User input is sanitized through `secure_filename()` and downloads are served through parameterized database lookups.

### C. Privacy Preserving Tiers (Zero-Knowledge Verification)
- **`PRIVATE` (Default)**: Only the owner and system administrator can verify or view file details. External verification returns 403 Forbidden.
- **`VERIFY_ONLY`**: Any party with the Registration ID can verify that their copy matches the reference digest. The owner's username and the original document name are masked as **REDACTED**.
- **`PUBLIC`**: Full metadata is publicly verifiable.

### D. Tamper-Evident Hash-Chained Audit Ledger
- Sequential linking: Each block $B_i$ contains $H_i = \text{SHA256}(H_{i-1} \parallel \text{index} \parallel \text{action} \parallel \text{actor} \parallel \text{resource} \parallel \text{timestamp} \parallel \text{details})$.
- Genesis block starts with $H_0 = 0^{64}$.
- **Chain Verification Engine**: Validates the entire chain from genesis to head. If an attacker directly alters a row in the SQLite database, `AuditService.verify_chain_integrity()` immediately flags the exact corrupted block index.
- **Signed Checkpoints**: Binds the head hash of an audit segment with an RSA-PSS signature.

---

## 5. Demo Accounts

The database comes pre-seeded with three demo accounts:

| Role | Username | Email | Password |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin` | `admin@provenance.local` | `AdminPass123!` |
| **User (Whitepapers)** | `alice` | `alice@example.com` | `AlicePass123!` |
| **User (Policies)** | `bob` | `bob@example.com` | `BobPass123!` |

*(The Login screen includes one-click quick-fill buttons for these accounts.)*

---

## 6. How to Launch and Test the Project

### Step 1: Run the Backend Automated Test Suite
From the project root `codex/`:
```powershell
& "backend\venv\Scripts\pytest.exe" -v backend\tests
```
*(All 23 unit and integration tests will run and pass).*

### Step 2: Start the Python Flask Backend
In terminal 1:
```powershell
& "backend\venv\Scripts\python.exe" backend\run.py
```
- The backend will start on **http://127.0.0.1:5000**.
- It automatically creates keys in `backend/storage/keys/` and seeds demo accounts and files if needed.

### Step 3: Start the React + Vite Frontend
In terminal 2:
```powershell
cd frontend
npm run dev
```
- The frontend will launch on **http://localhost:5173**.
- Vite proxies `/api` requests directly to `http://127.0.0.1:5000`.

---

## 7. Production Security Limitations & Future Work

While this platform demonstrates production-grade cryptographic principles, a production deployment should incorporate the following:

1. **Hardware Security Modules (HSM)**: In enterprise deployments, the RSA signing private key should reside inside an HSM or cloud KMS (e.g. AWS CloudHSM, Google Cloud KMS) rather than on disk.
2. **Database Concurrency**: SQLite is utilized for self-contained college evaluation. Production deployments should transition to PostgreSQL with row-level locking or distributed databases.
3. **HTTPS & Cookie Attributes**: In production, `SESSION_COOKIE_SECURE=True` must be enabled over TLS with `Strict-Transport-Security` headers.
4. **Decentralized Anchoring**: Signed checkpoints could periodically be anchored to public cryptographic timestamping services (e.g., OpenTimestamps or RFC 3161 Time Stamp Authorities).
