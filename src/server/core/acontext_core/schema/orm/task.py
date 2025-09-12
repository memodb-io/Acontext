from dataclasses import dataclass, field
from sqlalchemy import (
    ForeignKey,
    Index,
    Column,
    Integer,
    String,
    Enum,
    text,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from typing import TYPE_CHECKING, Optional, List
from .base import ORM_BASE, CommonMixin
from ..session.task import TaskStatus
from ..utils import asUUID

if TYPE_CHECKING:
    from .session import Session
    from .message import Message

# TaskStatusEnum = Enum(TaskStatus, name="task_status_enum", create_type=True)


@ORM_BASE.mapped
@dataclass
class Task(CommonMixin):
    __tablename__ = "tasks"

    __table_args__ = (
        Index("ix_session_session_id", "session_id"),
        CheckConstraint(
            "task_status IN ('success', 'failed', 'running', 'pending')",
            name="ck_task_status",
        ),
        Index("ix_session_session_id_task_id", "session_id", "id"),
        Index("ix_session_session_id_task_status", "session_id", "task_status"),
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

    task_order: int = field(metadata={"db": Column(Integer, nullable=False)})

    task_data: dict = field(metadata={"db": Column(JSONB, nullable=False)})

    task_status: str = field(
        metadata={
            "db": Column(
                String,
                nullable=False,
                server_default="pending",
            )
        },
    )

    # Relationships
    messages: List["Message"] = field(
        default_factory=list,
        metadata={"db": relationship("Message", back_populates="task")},
    )

    session: "Session" = field(
        init=False,
        metadata={"db": relationship("Session", back_populates="tasks")},
    )
