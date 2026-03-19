"""
Envelope encryption module compatible with the Go API implementation.

Uses HKDF-SHA256 for key derivation and AES-256-GCM for encryption.
All wrapped DEK and ciphertext formats are: nonce (12 bytes) + ciphertext.
"""

import os
import base64
import hashlib
import hmac
from typing import Optional, Dict, Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from ..env import LOG as logger
from ..env import DEFAULT_CORE_CONFIG

KEY_SIZE = 32  # AES-256
NONCE_SIZE = 12  # AES-GCM nonce

_ADMIN_KEK_SALT = b"acontext-admin-kek"
_ADMIN_KEK_INFO = b"acontext envelope encryption admin KEK"


def derive_kek(secret: bytes, salt: bytes, info: bytes) -> bytes:
    """Derive a KEK using HKDF-SHA256 (compatible with Go's golang.org/x/crypto/hkdf)."""
    if not secret:
        raise ValueError("secret is empty")
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=KEY_SIZE,
        salt=salt,
        info=info,
    )
    return hkdf.derive(secret)


def generate_dek() -> bytes:
    """Generate a random 256-bit DEK."""
    return os.urandom(KEY_SIZE)


def wrap_dek(kek: bytes, dek: bytes) -> bytes:
    """Wrap (encrypt) a DEK with a KEK using AES-256-GCM. Returns nonce + ciphertext."""
    nonce = os.urandom(NONCE_SIZE)
    aesgcm = AESGCM(kek)
    ct = aesgcm.encrypt(nonce, dek, None)
    return nonce + ct


def unwrap_dek(kek: bytes, wrapped_dek: bytes) -> bytes:
    """Unwrap (decrypt) a DEK. Expects nonce + ciphertext."""
    if len(wrapped_dek) < NONCE_SIZE:
        raise ValueError("wrapped DEK too short")
    nonce = wrapped_dek[:NONCE_SIZE]
    ct = wrapped_dek[NONCE_SIZE:]
    aesgcm = AESGCM(kek)
    return aesgcm.decrypt(nonce, ct, None)


def encrypt(dek: bytes, plaintext: bytes) -> bytes:
    """Encrypt plaintext with AES-256-GCM. Returns nonce + ciphertext."""
    nonce = os.urandom(NONCE_SIZE)
    aesgcm = AESGCM(dek)
    ct = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ct


def decrypt(dek: bytes, ciphertext_with_nonce: bytes) -> bytes:
    """Decrypt ciphertext. Expects nonce + ciphertext."""
    if len(ciphertext_with_nonce) < NONCE_SIZE:
        raise ValueError("ciphertext too short")
    nonce = ciphertext_with_nonce[:NONCE_SIZE]
    ct = ciphertext_with_nonce[NONCE_SIZE:]
    aesgcm = AESGCM(dek)
    return aesgcm.decrypt(nonce, ct, None)


class EncryptionService:
    """Manages envelope encryption/decryption using the admin master KEK."""

    def __init__(self, master_key: str = "", enabled: bool = False):
        self._enabled = enabled and bool(master_key)
        self._admin_kek: Optional[bytes] = None

        if self._enabled:
            self._admin_kek = derive_kek(
                master_key.encode(), _ADMIN_KEK_SALT, _ADMIN_KEK_INFO
            )
            logger.info("Encryption service initialized (enabled)")
        else:
            logger.info("Encryption service initialized (disabled — passthrough mode)")

    @property
    def enabled(self) -> bool:
        return self._enabled

    def decrypt_with_admin_kek(
        self, ciphertext: bytes, enc_meta: Dict[str, str]
    ) -> bytes:
        """Decrypt data using the admin master KEK."""
        if not self._enabled:
            raise RuntimeError("encryption not enabled")
        wrapped = base64.b64decode(enc_meta["enc-dek-admin"])
        dek = unwrap_dek(self._admin_kek, wrapped)
        return decrypt(dek, ciphertext)

    def encrypt_with_admin_kek(
        self, plaintext: bytes
    ) -> Tuple[bytes, Dict[str, str]]:
        """Encrypt data using admin KEK only (for Core-side uploads).
        Returns (ciphertext, metadata_dict)."""
        if not self._enabled:
            raise RuntimeError("encryption not enabled")
        dek = generate_dek()
        ciphertext = encrypt(dek, plaintext)
        admin_wrapped = wrap_dek(self._admin_kek, dek)
        meta = {
            "enc-algo": "AES-256-GCM",
            "enc-dek-admin": base64.b64encode(admin_wrapped).decode(),
        }
        return ciphertext, meta


def metadata_from_map(metadata: Dict[str, str]) -> Optional[Dict[str, str]]:
    """Extract encryption metadata from S3 object metadata.
    Returns None if the object is not encrypted."""
    algo = metadata.get("enc-algo", "")
    if not algo:
        return None
    return {
        "enc-algo": algo,
        "enc-dek-admin": metadata.get("enc-dek-admin", ""),
        "enc-dek-user": metadata.get("enc-dek-user", ""),
    }


# Global encryption service instance
_ENCRYPTION_SERVICE: Optional[EncryptionService] = None


def get_encryption_service() -> EncryptionService:
    """Get the global encryption service instance."""
    global _ENCRYPTION_SERVICE
    if _ENCRYPTION_SERVICE is None:
        _ENCRYPTION_SERVICE = EncryptionService(
            master_key=getattr(DEFAULT_CORE_CONFIG, "encryption_master_key", ""),
            enabled=getattr(DEFAULT_CORE_CONFIG, "encryption_enabled", False),
        )
    return _ENCRYPTION_SERVICE


def init_encryption_service() -> EncryptionService:
    """Initialize the global encryption service."""
    global _ENCRYPTION_SERVICE
    _ENCRYPTION_SERVICE = EncryptionService(
        master_key=getattr(DEFAULT_CORE_CONFIG, "encryption_master_key", ""),
        enabled=getattr(DEFAULT_CORE_CONFIG, "encryption_enabled", False),
    )
    return _ENCRYPTION_SERVICE
