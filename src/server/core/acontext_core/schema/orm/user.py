from dataclasses import dataclass, field
from typing import TYPE_CHECKING, List

from sqlalchemy import Column, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import CommonMixin, ORM_BASE
from ..utils import asUUID

if TYPE_CHECKING:
    from .project import Project
    from .session import Session
    from .tool import Tool


@ORM_BASE.mapped
@dataclass
class User(CommonMixin):
    __tablename__ = "users"

    __table_args__ = (
        Index("ix_user_project_id", "project_id"),
        Index("idx_project_identifier", "project_id", "identifier", unique=True),
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
    identifier: str = field(metadata={"db": Column(String, nullable=False)})

    # Relationships
    project: "Project" = field(
        init=False, metadata={"db": relationship("Project", back_populates="users")}
    )
    sessions: List["Session"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Session", back_populates="user", cascade="all, delete-orphan"
            )
        },
    )
    tools: List["Tool"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Tool", back_populates="user", cascade="all, delete-orphan"
            )
        },
    )
