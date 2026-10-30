import os
import re
from werkzeug.utils import secure_filename
from .config import Config

# Magic Byte Signatures
MAGIC_SIGNATURES = {
    "pdf": [b"%PDF-"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "docx": [b"PK\x03\x04"],  # ZIP container header for DOCX
}

MIME_MAP = {
    "pdf": "application/pdf",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
}

def sanitize_original_filename(filename: str) -> str:
    """Safely sanitize human-readable filename, preventing path traversal."""
    cleaned = secure_filename(filename)
    if not cleaned:
        cleaned = "unnamed_file.bin"
    return cleaned

def validate_file_content(file_stream, filename: str) -> tuple[bool, str | None, str | None]:
    """
    Validate file by extension, size, and magic byte content.
    Returns: (is_valid, error_message, detected_mime)
    """
    if not filename or '.' not in filename:
        return False, "File name must include a valid file extension.", None

    ext = filename.rsplit('.', 1)[1].lower()
    if ext not in Config.ALLOWED_EXTENSIONS:
        return False, f"Unsupported file type '.{ext}'. Allowed types: {', '.join(sorted(Config.ALLOWED_EXTENSIONS))}", None

    # Check size by seeking to end
    file_stream.seek(0, os.SEEK_END)
    size = file_stream.tell()
    file_stream.seek(0)

    if size <= 0:
        return False, "The uploaded file is empty (0 bytes).", None

    if size > Config.MAX_CONTENT_LENGTH:
        max_mb = Config.MAX_CONTENT_LENGTH // (1024 * 1024)
        return False, f"File size exceeds maximum allowed limit of {max_mb} MB.", None

    # Inspect magic bytes
    sample = file_stream.read(16)
    file_stream.seek(0)

    if ext == "txt":
        # Validate text readability (no null bytes or shellcode)
        try:
            head = file_stream.read(4096)
            file_stream.seek(0)
            if b"\x00" in head:
                return False, "Text file contains invalid binary/null control characters.", None
            head.decode("utf-8")
        except UnicodeDecodeError:
            return False, "Text file must be valid UTF-8 or ASCII encoded.", None
        return True, None, MIME_MAP["txt"]

    # Binary types inspection
    expected_signatures = MAGIC_SIGNATURES.get(ext)
    if expected_signatures:
        matched = any(sample.startswith(sig) for sig in expected_signatures)
        if not matched:
            return False, f"File contents do not match expected signature for .{ext} file.", None

    return True, None, MIME_MAP.get(ext, "application/octet-stream")
