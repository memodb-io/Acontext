"""
Python SDK for the Acontext API.
"""

from importlib import metadata as _metadata

from .async_client import AcontextAsyncClient
from .client import AcontextClient, FileUpload, MessagePart
from .messages import AcontextMessage
from .resources import (
    AsyncDiskArtifactsAPI,
    AsyncDisksAPI,
    AsyncLearningSpacesAPI,
    AsyncSessionsAPI,
    DiskArtifactsAPI,
    DisksAPI,
    LearningSpacesAPI,
    SessionsAPI,
)
from .integrations.claude_agent import ClaudeAgentStorage
from .types import Task, TaskData

__all__ = [
    "AcontextClient",
    "AcontextAsyncClient",
    "FileUpload",
    "MessagePart",
    "AcontextMessage",
    "DisksAPI",
    "DiskArtifactsAPI",
    "SessionsAPI",
    "AsyncDisksAPI",
    "AsyncDiskArtifactsAPI",
    "AsyncLearningSpacesAPI",
    "AsyncSessionsAPI",
    "LearningSpacesAPI",
    "Task",
    "TaskData",
    "ClaudeAgentStorage",
    "__version__",
]

try:
    __version__ = _metadata.version("acontext")
except _metadata.PackageNotFoundError:  # pragma: no cover - local/checkout usage
    __version__ = "0.0.0"
