"""
Internal constants shared across the Python SDK.
"""

from __future__ import annotations

DEFAULT_BASE_URL = "https://api.acontext.io/api/v1"
SUPPORTED_ROLES = {"user", "assistant", "system", "tool", "function"}

try:  # pragma: no cover - metadata might be unavailable during development
    from importlib import metadata as _metadata

    _VERSION = _metadata.version("acontext-py")
except Exception:  # noqa: BLE001 - fall back gracefully
    _VERSION = "0.0.0"

DEFAULT_USER_AGENT = f"acontext-py/{_VERSION}"

__all__ = ["DEFAULT_BASE_URL", "DEFAULT_USER_AGENT", "SUPPORTED_ROLES"]

