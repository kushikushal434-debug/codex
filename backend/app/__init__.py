import os
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from .config import Config
from .db import init_db, close_db
from .routes.auth import auth_bp
from .routes.files import files_bp
from .routes.verify import verify_bp
from .routes.audit import audit_bp
from .routes.admin import admin_bp
from .routes.certificates import certificates_bp

def create_app(test_config=None):
    """Application factory for Flask backend."""
    app = Flask(__name__)
    app.config.from_object(Config)

    if test_config is not None:
        app.config.update(test_config)

    # Ensure storage directories exist
    Config.ensure_directories()

    # Configure CORS with credentials support
    CORS(
        app,
        supports_credentials=True,
        origins=app.config["CORS_ORIGINS"],
        allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"],
        expose_headers=["Content-Disposition"]
    )

    # Database teardown
    app.teardown_appcontext(close_db)

    # Initialize schema on startup
    with app.app_context():
        init_db(app.config.get("DATABASE_PATH"))

    # CSRF Protection Hook for mutating requests
    @app.before_request
    def csrf_protect():
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            # Exclude unauthenticated endpoints or public verification routes
            exempt_paths = {
                "/api/auth/login",
                "/api/auth/register",
                "/api/verify",
                "/api/certificates/verifier/verify",
                "/api/certificates/verifier/nonce",
                "/api/certificates/holder/present",
                "/api/certificates/issuer/issue",
                "/api/certificates/issuer/revoke",
                "/api/certificates/issuer/generate-keys",
                "/api/certificates/inspect-file"
            }
            if request.path in exempt_paths or request.path.startswith("/api/certificates/"):
                return None

            # If user has an active session, enforce CSRF token header
            if "user_id" in session:
                header_token = request.headers.get("X-CSRF-Token")
                session_token = session.get("_csrf_token")
                if not header_token or not session_token or header_token != session_token:
                    return jsonify({
                        "error": "Invalid or missing CSRF token. Request rejected for security.",
                        "code": "CSRF_FAILED"
                    }), 403

    # Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(verify_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(certificates_bp)

    # Global Error Handlers
    @app.errorhandler(413)
    def file_too_large(e):
        max_mb = app.config.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024) // (1024 * 1024)
        return jsonify({"error": f"Request entity exceeds the maximum allowed limit of {max_mb} MB."}), 413

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Requested resource was not found on this server."}), 404

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "An internal cryptographic/server error occurred."}), 500

    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "Privacy-Preserving Certificate Verification Platform",
            "version": "1.0.0"
        })

    return app
