import uuid
from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, Index, Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from typing import TYPE_CHECKING, List, Optional
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .project import Project
    from .session import Session


@ORM_BASE.mapped
@dataclass
class Space(CommonMixin):
    __tablename__ = "spaces"

    __table_args__ = (Index("ix_space_space_project_id", "id", "project_id"),)

    project_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("projects.id", ondelete="CASCADE"),
                nullable=False,
            )
        }
    )

    configs: Optional[dict] = field(
        default=None, metadata={"db": Column(JSONB, nullable=True)}
    )

    # Relationships
    project: "Project" = field(
        init=False, metadata={"db": relationship("Project", back_populates="spaces")}
    )

    sessions: List["Session"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Session", back_populates="space", cascade="all, delete-orphan"
            )
        },
    )
