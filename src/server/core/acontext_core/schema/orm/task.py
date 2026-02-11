from dataclasses import dataclass, field
from sqlalchemy import (
    ForeignKey,
    Index,
    Column,
    Integer,
    String,
    CheckConstraint,
    UniqueConstraint,
    Boolean,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from typing import TYPE_CHECKING, List, Optional

from .base import ORM_BASE, CommonMixin
from ..utils import asUUID
from pgvector.sqlalchemy import Vector
from ...env import DEFAULT_CORE_CONFIG

if TYPE_CHECKING:
    from .project import Project
    from .session import Session
    from .message import Message

# TaskStatusEnum = Enum(TaskStatus, name="task_status_enum", create_type=True)


@ORM_BASE.mapped
@dataclass
class Task(CommonMixin):
    __tablename__ = "tasks"

    __table_args__ = (
        CheckConstraint(
            "status IN ('success', 'failed', 'running', 'pending')",
            name="ck_status",
        ),
        UniqueConstraint(
            "session_id",
            "order",
            name="uq_session_id_order",
        ),
        Index("ix_task_session_id", "session_id"),
        Index("ix_task_session_id_task_id", "session_id", "id"),
        Index("ix_task_session_id_status", "session_id", "status"),
        Index("ix_task_project_id", "project_id"),
    )

    session_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("sessions.id", ondelete="CASCADE", onupdate="CASCADE"),
                nullable=False,
            )
        },
    )

    project_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("projects.id", ondelete="CASCADE", onupdate="CASCADE"),
                nullable=False,
            )
        },
    )

    order: int = field(metadata={"db": Column(Integer, nullable=False)})

    data: dict = field(
        default_factory=dict, metadata={"db": Column(JSONB, nullable=False)}
    )

    status: str = field(
        default="pending",
        metadata={"db": Column(String, nullable=False, server_default="pending")},
    )

    is_planning: bool = field(
        default=False,
        metadata={"db": Column(Boolean, nullable=False, server_default="false")},
    )
    
    # Embedding vector for semantic search
    embedding: Optional[List[float]] = field(
        default=None,
        metadata={"db": Column(Vector(DEFAULT_CORE_CONFIG.task_embedding_dim), nullable=True)},
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

    project: "Project" = field(
        init=False,
        metadata={"db": relationship("Project", back_populates="tasks")},
    )
