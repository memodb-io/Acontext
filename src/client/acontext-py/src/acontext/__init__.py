"""
Python SDK for the Acontext API.
"""

from importlib import metadata as _metadata

from .client import AcontextClient, FileUpload, MessagePart
from .messages import AcontextMessage
from .resources import BlocksAPI, DiskArtifactsAPI, DisksAPI, SessionsAPI, SpacesAPI

__all__ = [
    "AcontextClient",
    "FileUpload",
    "MessagePart",
    "AcontextMessage",
    "DisksAPI",
    "DiskArtifactsAPI",
    "BlocksAPI",
    "SessionsAPI",
    "SpacesAPI",
    "__version__",
]

try:
    __version__ = _metadata.version("acontext")
except _metadata.PackageNotFoundError:  # pragma: no cover - local/checkout usage
    __version__ = "0.0.0"
