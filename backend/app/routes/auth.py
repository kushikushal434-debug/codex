import secrets
from functools import wraps
from flask import Blueprint, request, jsonify, session, g
from werkzeug.security import generate_password_hash, check_password_hash
from ..db import get_db
from ..audit_service import AuditService

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required. Please log in."}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required."}), 401
        if session.get("role") != "admin":
            return jsonify({"error": "Admin privileges required."}), 403
        return f(*args, **kwargs)
    return decorated_function

def generate_csrf_token():
    if "_csrf_token" not in session:
        session["_csrf_token"] = secrets.token_hex(32)
    return session["_csrf_token"]

@auth_bp.route("/csrf-token", methods=["GET"])
def get_csrf():
    token = generate_csrf_token()
    return jsonify({"csrf_token": token})

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or len(username) < 3 or len(username) > 30:
        return jsonify({"error": "Username must be between 3 and 30 characters."}), 400

    if not email or "@" not in email or "." not in email:
        return jsonify({"error": "A valid email address is required."}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long."}), 400

    db = get_db()
    cursor = db.cursor()

    # Check existing user
    cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
    if cursor.fetchone():
        return jsonify({"error": "A user with this username or email already exists."}), 409

    # Determine role: first registered user becomes admin, others are regular users
    cursor.execute("SELECT COUNT(*) as count FROM users")
    user_count = cursor.fetchone()["count"]
    role = "admin" if user_count == 0 else "user"

    password_hash = generate_password_hash(password, method="scrypt")

    cursor.execute(
        "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
        (username, email, password_hash, role)
    )
    db.commit()
    user_id = cursor.lastrowid

    # Audit log
    AuditService.record_event(
        action="USER_REGISTERED",
        actor_id=user_id,
        resource_id=str(user_id),
        details={"username": username, "email": email, "role": role},
        db=db
    )

    # Establish session
    session["user_id"] = user_id
    session["username"] = username
    session["email"] = email
    session["role"] = role
    csrf_token = generate_csrf_token()

    return jsonify({
        "message": "User registered successfully.",
        "user": {
            "id": user_id,
            "username": username,
            "email": email,
            "role": role
        },
        "csrf_token": csrf_token
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    login_id = (data.get("username_or_email") or "").strip()
    password = data.get("password") or ""

    if not login_id or not password:
        return jsonify({"error": "Username/email and password are required."}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "SELECT id, username, email, password_hash, role FROM users WHERE username = ? OR email = ?",
        (login_id, login_id.lower())
    )
    user = cursor.fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials provided."}), 401

    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["email"] = user["email"]
    session["role"] = user["role"]
    csrf_token = generate_csrf_token()

    AuditService.record_event(
        action="USER_LOGIN",
        actor_id=user["id"],
        resource_id=str(user["id"]),
        details={"username": user["username"], "ip": request.remote_addr},
        db=db
    )

    return jsonify({
        "message": "Login successful.",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"]
        },
        "csrf_token": csrf_token
    })

@auth_bp.route("/logout", methods=["POST"])
def logout():
    user_id = session.get("user_id")
    if user_id:
        AuditService.record_event(
            action="USER_LOGOUT",
            actor_id=user_id,
            resource_id=str(user_id),
            details={"username": session.get("username")},
            db=get_db()
        )
    session.clear()
    return jsonify({"message": "Successfully logged out."})

@auth_bp.route("/me", methods=["GET"])
def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"user": None, "authenticated": False})

    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT id, username, email, role, created_at FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()

    if not user:
        session.clear()
        return jsonify({"user": None, "authenticated": False})

    csrf_token = generate_csrf_token()
    return jsonify({
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "created_at": str(user["created_at"])
        },
        "authenticated": True,
        "csrf_token": csrf_token
    })
