import uuid
from dataclasses import dataclass, field
from sqlalchemy import String, ForeignKey, Index, CheckConstraint, Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from pydantic import BaseModel
from typing import TYPE_CHECKING, Optional, List, Dict, Any
from .base import ORM_BASE, CommonMixin

if TYPE_CHECKING:
    from .session import Session
    from .asset import Asset
    from .task import Task


class Part(BaseModel):
    """Message part model matching the GORM Part struct"""

    type: str  # "text" | "image" | "audio" | "video" | "file" | "tool-call" | "tool-result" | "data"

    # text part
    text: Optional[str] = None

    # media part
    asset_id: Optional[uuid.UUID] = None
    mime: Optional[str] = None
    filename: Optional[str] = None
    size_bigint: Optional[int] = None  # Updated to match Go field name

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
        Index(
            "ix_message_session_task_status",
            "session_id",
            "session_task_process_status",
        ),
        Index("idx_session_created", "session_id", "created_at"),
    )

    session_id: uuid.UUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("sessions.id", ondelete="CASCADE"),
                nullable=False,
            )
        }
    )

    task_id: Optional[uuid.UUID] = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey(
                    "tasks.id", ondelete="SET NULL"
                ),  # Changed from CASCADE to SET NULL
                nullable=True,
                server_default=None,
            )
        },
    )

    role: str = field(metadata={"db": Column(String, nullable=False)})

    parts: List[Part] = field(metadata={"db": Column(JSONB, nullable=False)})

    session_task_process_status: str = field(
        default="pending",
        metadata={"db": Column(String, nullable=False, server_default="pending")},
    )

    parent_id: Optional[uuid.UUID] = field(
        default=None,
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("messages.id", ondelete="CASCADE"),
                nullable=True,
            )
        },
    )

    # Relationships
    session: "Session" = field(
        init=False, metadata={"db": relationship("Session", back_populates="messages")}
    )

    task: Optional["Task"] = field(
        default=None,
        init=False,
        metadata={"db": relationship("Task", back_populates="messages")},
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
        metadata={
            "db": relationship(
                "Message", back_populates="parent", cascade="all, delete-orphan"
            )
        },
    )

    assets: List["Asset"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Asset", secondary="message_assets", back_populates="messages"
            )
        },
    )
