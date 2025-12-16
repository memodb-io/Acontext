"""
Python SDK for the Acontext API.
"""

from importlib import metadata as _metadata

from .async_client import AcontextAsyncClient
from .client import AcontextClient, FileUpload, MessagePart
from .messages import AcontextMessage
from .resources import (
    AsyncBlocksAPI,
    AsyncDiskArtifactsAPI,
    AsyncDisksAPI,
    AsyncSessionsAPI,
    AsyncSpacesAPI,
    BlocksAPI,
    DiskArtifactsAPI,
    DisksAPI,
    SessionsAPI,
    SpacesAPI,
)
from .types import Task, TaskData

__all__ = [
    "AcontextClient",
    "AcontextAsyncClient",
    "FileUpload",
    "MessagePart",
    "AcontextMessage",
    "DisksAPI",
    "DiskArtifactsAPI",
    "BlocksAPI",
    "SessionsAPI",
    "SpacesAPI",
    "AsyncDisksAPI",
    "AsyncDiskArtifactsAPI",
    "AsyncBlocksAPI",
    "AsyncSessionsAPI",
    "AsyncSpacesAPI",
    "Task",
    "TaskData",
    "__version__",
]

try:
    __version__ = _metadata.version("acontext")
except _metadata.PackageNotFoundError:  # pragma: no cover - local/checkout usage
    __version__ = "0.0.0"
