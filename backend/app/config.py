import os
from pathlib import Path
from dotenv import load_dotenv

# Base backend directory
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Load environment variables
load_dotenv(BACKEND_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "fallback-insecure-dev-secret-key-39df84a0c8b6")
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = os.getenv("FLASK_DEBUG", "1") == "1"
    
    # Storage directories
    STORAGE_DIR = BACKEND_DIR / os.getenv("STORAGE_DIR", "storage")
    UPLOADS_DIR = STORAGE_DIR / "uploads"
    KEYS_DIR = STORAGE_DIR / "keys"
    DATABASE_PATH = STORAGE_DIR / "provenance.db"
    
    # Request & file security
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))  # 16 MB
    ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "txt", "docx"}
    
    # Cookie & Session configuration
    SESSION_COOKIE_HTTPONLY = os.getenv("SESSION_COOKIE_HTTPONLY", "True") == "True"
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "False") == "True"
    SESSION_COOKIE_NAME = "tpdp_session"
    
    # CORS
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]
    
    @classmethod
    def ensure_directories(cls):
        """Create necessary storage directories with safe permissions."""
        cls.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        cls.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        cls.KEYS_DIR.mkdir(parents=True, exist_ok=True)
