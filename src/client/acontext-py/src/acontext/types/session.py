"""Type definitions for session, message, and task resources."""

from typing import Any

from pydantic import BaseModel, Field


class Asset(BaseModel):
    """Asset model representing a file asset."""

    bucket: str = Field(..., description="S3 bucket name")
    s3_key: str = Field(..., description="S3 key")
    etag: str = Field(..., description="ETag")
    sha256: str = Field(..., description="SHA256 hash")
    mime: str = Field(..., description="MIME type")
    size_b: int = Field(..., description="File size in bytes")


class Part(BaseModel):
    """Message part model representing a part of a message."""

    type: str = Field(
        ...,
        description="Part type: 'text', 'image', 'audio', 'video', 'file', 'tool-call', 'tool-result', 'data'",
    )
    text: str | None = Field(None, description="Text content for text parts")
    asset: Asset | None = Field(None, description="Asset information for media parts")
    filename: str | None = Field(None, description="Filename for file parts")
    meta: dict[str, Any] | None = Field(None, description="Optional metadata")


class Message(BaseModel):
    """Message model representing a message in a session."""

    id: str = Field(..., description="Message UUID")
    session_id: str = Field(..., description="Session UUID")
    parent_id: str | None = Field(None, description="Parent message UUID")
    role: str = Field(..., description="Message role: 'user', 'assistant', or 'system'")
    meta: dict[str, Any] = Field(..., description="Message metadata")
    parts: list[Part] = Field(..., description="List of message parts")
    task_id: str | None = Field(None, description="Task UUID if associated with a task")
    session_task_process_status: str = Field(
        ...,
        description="Task process status: 'success', 'failed', 'running', or 'pending'",
    )
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class Session(BaseModel):
    """Session model representing a session."""

    id: str = Field(..., description="Session UUID")
    project_id: str = Field(..., description="Project UUID")
    space_id: str | None = Field(None, description="Space UUID, optional")
    configs: dict[str, Any] = Field(..., description="Session configuration dictionary")
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class Task(BaseModel):
    """Task model representing a task in a session."""

    id: str = Field(..., description="Task UUID")
    session_id: str = Field(..., description="Session UUID")
    project_id: str = Field(..., description="Project UUID")
    order: int = Field(..., description="Task order")
    data: dict[str, Any] = Field(..., description="Task data dictionary")
    status: str = Field(
        ...,
        description="Task status: 'success', 'failed', 'running', or 'pending'",
    )
    is_planning: bool = Field(..., description="Whether the task is in planning phase")
    space_digested: bool = Field(..., description="Whether the space has been digested")
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class ListSessionsOutput(BaseModel):
    """Response model for listing sessions."""

    items: list[Session] = Field(..., description="List of sessions")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")


class PublicURL(BaseModel):
    """Public URL model for asset presigned URLs."""

    url: str = Field(..., description="Presigned URL")
    expire_at: str = Field(..., description="Expiration time in ISO 8601 format")


class GetMessagesOutput(BaseModel):
    """Response model for getting messages.

    Note: The items field type depends on the format parameter:
    - format="acontext": items is list[Message] (Acontext format)
    - format="openai": items is OpenAI format messages
    - format="anthropic": items is Anthropic format messages

    Since format is a runtime parameter, items uses list[Any] for flexibility.
    """

    items: list[Any] = Field(
        ...,
        description="List of messages in the requested format (Message, OpenAI format, or Anthropic format)",
    )
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")
    public_urls: dict[str, PublicURL] | None = Field(
        None,
        description="Map of SHA256 hash to PublicURL (only included when format='acontext')",
    )


class GetTasksOutput(BaseModel):
    """Response model for getting tasks."""

    items: list[Task] = Field(..., description="List of tasks")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")

