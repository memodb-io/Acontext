from dataclasses import dataclass, field
from sqlalchemy import String, ForeignKey, Index, CheckConstraint, Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from pydantic import BaseModel
from typing import TYPE_CHECKING, Optional, List, Dict, Any, Literal
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .session import Session
    from .task import Task


class Asset(BaseModel):
    """Asset model matching the GORM Asset struct - used for JSONB serialization only"""

    bucket: str
    s3_key: str
    etag: str
    sha256: str
    mime: str
    size_b: int


class ToolCallMeta(BaseModel):
    name: str
    arguments: dict | str
    id: Optional[str] = None


class ToolResultMeta(BaseModel):
    tool_call_id: str


class Part(BaseModel):
    """Message part model matching the GORM Part struct"""

    type: Literal[
        "text", "image", "audio", "video", "file", "tool-call", "tool-result", "data"
    ]  # "text" | "image" | "audio" | "video" | "file" | "tool-call" | "tool-result" | "data"

    # text part
    text: Optional[str] = None

    # media part - embedded Asset like Go version
    asset: Optional[Asset] = None
    filename: Optional[str] = None

    # metadata for embedding, ocr, asr, caption, etc.
    meta: Optional[Dict[str, Any]] = None


@ORM_BASE.mapped
@dataclass
class Message(CommonMixin):
    __tablename__ = "messages"

    __table_args__ = (
        CheckConstraint(
            "role IN ('user', 'assistant', 'system', 'tool', 'function')",
            name="ck_message_role",
        ),
        CheckConstraint(
            "session_task_process_status IN ('success', 'failed', 'running', 'pending')",
            name="ck_session_task_process_status",
        ),
        Index("ix_message_session_id", "session_id"),
        Index("ix_message_parent_id", "parent_id"),
        Index("idx_session_created", "session_id", "created_at"),
    )

    session_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("sessions.id", ondelete="CASCADE"),
                nullable=False,
            )
        }
    )

    role: str = field(metadata={"db": Column(String, nullable=False)})

    # Store Asset data as JSONB (matches Go's PartsAssetMeta field)
    parts_asset_meta: dict = field(metadata={"db": Column(JSONB, nullable=False)})

    parts: Optional[List[Part]] = field(default=None)

    parent_id: Optional[asUUID] = field(
        default=None,
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("messages.id", ondelete="CASCADE"),
                nullable=True,
            )
        },
    )

    # Computed field for API responses (matches Go's Parts field with gorm:"-")
    # parts: List[Part] = field(default_factory=list, init=False)

    task_id: Optional[asUUID] = field(
        default=None,
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("tasks.id", ondelete="SET NULL"),
                nullable=True,
            )
        },
    )

    session_task_process_status: str = field(
        default="pending",
        metadata={"db": Column(String, nullable=False, server_default="pending")},
    )

    # Relationships
    session: "Session" = field(
        init=False, metadata={"db": relationship("Session", back_populates="messages")}
    )

    parent: Optional["Message"] = field(
        default=None,
        init=False,
        metadata={
            "db": relationship(
                "Message", remote_side="Message.id", back_populates="children"
            )
        },
    )

    children: List["Message"] = field(
        default_factory=list,
        init=False,
        metadata={
            "db": relationship(
                "Message", back_populates="parent", cascade="all, delete-orphan"
            )
        },
    )

    task: Optional["Task"] = field(
        default=None,
        init=False,
        metadata={"db": relationship("Task", back_populates="messages")},
    )
