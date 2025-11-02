"""
Internal constants shared across the Python SDK.
"""

from importlib import metadata as _metadata

DEFAULT_BASE_URL = "https://api.acontext.io/api/v1"

try:
    _VERSION = _metadata.version("acontext-py")
except _metadata.PackageNotFoundError:  # pragma: no cover - local/checkout usage
    _VERSION = "0.0.0"

DEFAULT_USER_AGENT = f"acontext-py/{_VERSION}"
