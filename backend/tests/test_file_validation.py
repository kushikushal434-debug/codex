import io
import pytest
from app.file_validator import validate_file_content

def test_valid_pdf_magic_bytes():
    pdf_stream = io.BytesIO(b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF")
    valid, err, mime = validate_file_content(pdf_stream, "sample.pdf")
    assert valid is True
    assert err is None
    assert mime == "application/pdf"

def test_valid_png_magic_bytes():
    png_stream = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR...")
    valid, err, mime = validate_file_content(png_stream, "chart.png")
    assert valid is True
    assert err is None
    assert mime == "image/png"

def test_valid_jpeg_magic_bytes():
    jpg_stream = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF...")
    valid, err, mime = validate_file_content(jpg_stream, "photo.jpg")
    assert valid is True
    assert err is None
    assert mime == "image/jpeg"

def test_valid_txt_content():
    txt_stream = io.BytesIO(b"Hello digital provenance world! UTF-8 verified.")
    valid, err, mime = validate_file_content(txt_stream, "notes.txt")
    assert valid is True
    assert err is None
    assert mime == "text/plain"

def test_reject_spoofed_file():
    # Plain text masquerading as PDF
    spoofed = io.BytesIO(b"This is a fake PDF without magic header.")
    valid, err, mime = validate_file_content(spoofed, "document.pdf")
    assert valid is False
    assert "signature" in err.lower()

def test_reject_unsupported_extensions():
    exe_stream = io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00")
    valid, err, mime = validate_file_content(exe_stream, "malware.exe")
    assert valid is False
    assert "Unsupported file type" in err

def test_reject_empty_file():
    empty_stream = io.BytesIO(b"")
    valid, err, mime = validate_file_content(empty_stream, "empty.pdf")
    assert valid is False
    assert "empty" in err.lower()
