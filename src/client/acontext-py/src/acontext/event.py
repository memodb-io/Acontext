"""Session event types for the Acontext SDK."""

from typing import Any, Optional

from pydantic import BaseModel, Field


class SessionEventBase(BaseModel):
    """Base class for session events."""

    def to_payload(self) -> dict[str, Any]:
        """Convert to API request payload with type and data fields."""
        raise NotImplementedError


class DiskEvent(SessionEventBase):
    """A disk-related event.

    Attributes:
        disk_id: The UUID of the disk.
        path: The file path.
        note: Optional note about the event.
    """

    disk_id: str = Field(..., description="The UUID of the disk")
    path: str = Field(..., description="The file path")
    note: Optional[str] = Field(None, description="Optional note about the event")

    def to_payload(self) -> dict[str, Any]:
        data: dict[str, Any] = {"disk_id": self.disk_id, "path": self.path}
        if self.note is not None:
            data["note"] = self.note
        return {"type": "disk_event", "data": data}


class TextEvent(SessionEventBase):
    """A free-text event.

    Attributes:
        text: The event text content.
    """

    text: str = Field(..., description="The event text content")

    def to_payload(self) -> dict[str, Any]:
        return {"type": "text_event", "data": {"text": self.text}}
