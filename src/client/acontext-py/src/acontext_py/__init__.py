"""
Python SDK for the Acontext API.
"""

from importlib import metadata as _metadata

from .client import AcontextClient, FileUpload, MessagePart
from .resources import (
    ArtifactFilesAPI,
    ArtifactsAPI,
    BlocksAPI,
    PagesAPI,
    SessionsAPI,
    SpacesAPI,
)

__all__ = [
    "AcontextClient",
    "FileUpload",
    "MessagePart",
    "ArtifactsAPI",
    "ArtifactFilesAPI",
    "BlocksAPI",
    "PagesAPI",
    "SessionsAPI",
    "SpacesAPI",
    "__version__",
]

try:
    __version__ = _metadata.version("acontext-py")
except _metadata.PackageNotFoundError:  # pragma: no cover - local/checkout usage
    __version__ = "0.0.0"
