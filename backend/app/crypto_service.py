import hashlib
import json
import base64
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.exceptions import InvalidSignature
from .config import Config

class CryptoService:
    def __init__(self, keys_dir: Path = None):
        self.keys_dir = keys_dir or Config.KEYS_DIR
        self.private_key_path = self.keys_dir / "private_key.pem"
        self.public_key_path = self.keys_dir / "public_key.pem"
        self._private_key = None
        self._public_key = None
        self._ensure_keys()

    def _ensure_keys(self):
        """Ensure RSA keypair exists; generate if missing."""
        self.keys_dir.mkdir(parents=True, exist_ok=True)
        if not self.private_key_path.exists() or not self.public_key_path.exists():
            self._generate_keypair()
        else:
            self._load_keys()

    def _generate_keypair(self):
        """Generate a fresh 2048-bit RSA keypair."""
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )
        public_key = private_key.public_key()

        # Serialize private key
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        self.private_key_path.write_bytes(private_pem)

        # Serialize public key
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        self.public_key_path.write_bytes(public_pem)

        self._private_key = private_key
        self._public_key = public_key

    def _load_keys(self):
        """Load RSA keypair from disk."""
        private_pem = self.private_key_path.read_bytes()
        self._private_key = serialization.load_pem_private_key(
            private_pem,
            password=None
        )
        public_pem = self.public_key_path.read_bytes()
        self._public_key = serialization.load_pem_public_key(public_pem)

    @property
    def public_key_pem(self) -> str:
        """Return the public key in PEM format as a UTF-8 string."""
        return self._public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode("utf-8")

    @property
    def public_key_fingerprint(self) -> str:
        """Return SHA-256 hex digest of the public key DER encoding."""
        der_bytes = self._public_key.public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        return hashlib.sha256(der_bytes).hexdigest()

    @staticmethod
    def canonical_json(data: dict) -> str:
        """
        Serialize dictionary into deterministic canonical JSON.
        Ensures identical representation across systems (sorted keys, compact).
        """
        return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=True)

    @staticmethod
    def compute_sha256_stream(file_stream, chunk_size: int = 65536) -> str:
        """Compute SHA-256 hex digest from an open file or stream chunk-by-chunk."""
        hasher = hashlib.sha256()
        file_stream.seek(0)
        while chunk := file_stream.read(chunk_size):
            hasher.update(chunk)
        file_stream.seek(0)
        return hasher.hexdigest()

    @staticmethod
    def compute_sha256_bytes(data: bytes) -> str:
        """Compute SHA-256 hex digest of raw bytes."""
        return hashlib.sha256(data).hexdigest()

    def sign_payload(self, canonical_payload: str) -> str:
        """
        Digitally sign canonical payload string using RSA-PSS with SHA-256.
        Returns URL-safe Base64 encoded signature.
        """
        payload_bytes = canonical_payload.encode("utf-8")
        signature = self._private_key.sign(
            payload_bytes,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return base64.b64encode(signature).decode("ascii")

    def verify_signature(self, canonical_payload: str, signature_b64: str, public_key_pem: str = None) -> bool:
        """
        Verify RSA-PSS signature over canonical payload string.
        """
        try:
            signature_bytes = base64.b64decode(signature_b64.encode("ascii"))
            pub_key = self._public_key
            if public_key_pem:
                pub_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))

            pub_key.verify(
                signature_bytes,
                canonical_payload.encode("utf-8"),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except (InvalidSignature, ValueError, Exception):
            return False

# Global instance for app
crypto_service = CryptoService()
