from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, Index, Column, String
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from typing import TYPE_CHECKING

from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .session import Session
    from .project import Project


@ORM_BASE.mapped
@dataclass
class SessionEvent(CommonMixin):
    __tablename__ = "session_events"

    __table_args__ = (
        Index("idx_session_event_created", "session_id", "created_at"),
        Index("ix_session_event_project_id", "project_id"),
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

    project_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("projects.id", ondelete="CASCADE"),
                nullable=False,
            )
        }
    )

    type: str = field(
        metadata={
            "db": Column(String, nullable=False)
        }
    )

    data: dict = field(
        metadata={
            "db": Column(JSONB, nullable=False)
        }
    )

    # Relationships
    session: "Session" = field(
        init=False, metadata={"db": relationship("Session", back_populates="events")}
    )

    project: "Project" = field(
        init=False, metadata={"db": relationship("Project")}
    )
