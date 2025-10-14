"""
Python SDK for the Acontext API.
"""

from __future__ import annotations

from .client import AcontextClient, DEFAULT_BASE_URL, FileUpload, MessagePart

__all__ = ["AcontextClient", "DEFAULT_BASE_URL", "FileUpload", "MessagePart", "__version__"]

# The version is kept in sync with pyproject.toml during releases.
__version__ = "0.1.0-dev"

