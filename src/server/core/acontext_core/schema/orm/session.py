from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, Index, Column, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from typing import TYPE_CHECKING, Optional, List
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .project import Project
    from .space import Space
    from .message import Message
    from .task import Task


@ORM_BASE.mapped
@dataclass
class Session(CommonMixin):
    __tablename__ = "sessions"

    __table_args__ = (
        Index("ix_session_project_id", "project_id"),
        Index("ix_session_space_id", "space_id"),
        Index("ix_session_session_project_id", "id", "project_id"),
    )

    project_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("projects.id", ondelete="CASCADE"),
                nullable=False,
            )
        }
    )

    disable_task_tracking: bool = field(
        default=False,
        metadata={
            "db": Column(Boolean, nullable=False, default=False, server_default="false")
        },
    )

    space_id: Optional[asUUID] = field(
        default=None,
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("spaces.id", ondelete="SET NULL"),
                nullable=True,
            )
        },
    )

    configs: Optional[dict] = field(
        default=None, metadata={"db": Column(JSONB, nullable=True)}
    )

    # Relationships
    project: "Project" = field(
        init=False, metadata={"db": relationship("Project", back_populates="sessions")}
    )

    space: Optional["Space"] = field(
        default=None,
        init=False,
        metadata={"db": relationship("Space", back_populates="sessions")},
    )

    messages: List["Message"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Message", back_populates="session", cascade="all, delete-orphan"
            )
        },
    )

    tasks: List["Task"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Task", back_populates="session", cascade="all, delete-orphan"
            )
        },
    )
