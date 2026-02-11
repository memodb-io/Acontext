from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from ...env import DEFAULT_CORE_CONFIG
from .base import CommonMixin, ORM_BASE
from ..utils import asUUID

if TYPE_CHECKING:
    from .project import Project
    from .user import User


@ORM_BASE.mapped
@dataclass
class Tool(CommonMixin):
    __tablename__ = "tools"

    __table_args__ = (
        Index("ix_tools_project_id", "project_id"),
        Index("ix_tools_user_id", "user_id"),
        # Ensure uniqueness for project-scoped tools (user_id IS NULL) and user-scoped tools (user_id IS NOT NULL).
        Index(
            "idx_tools_project_name_null_user",
            "project_id",
            "name",
            unique=True,
            postgresql_where=text("user_id IS NULL"),
        ),
        Index(
            "idx_tools_project_user_name",
            "project_id",
            "user_id",
            "name",
            unique=True,
            postgresql_where=text("user_id IS NOT NULL"),
        ),
        # Filtering by config uses JSONB containment; a GIN index keeps it fast.
        Index("idx_tools_config", "config", postgresql_using="gin"),
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

    name: str = field(metadata={"db": Column(String, nullable=False)})
    parameters: dict = field(metadata={"db": Column(JSONB, nullable=False)})

    # Optional fields (defaults must come after non-default dataclass fields).
    user_id: Optional[asUUID] = field(
        default=None,
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("users.id", ondelete="CASCADE"),
                nullable=True,
            )
        },
    )
    description: str = field(
        default="", metadata={"db": Column(Text, nullable=False, default="")}
    )
    config: Optional[dict] = field(default=None, metadata={"db": Column(JSONB, nullable=True)})

    embedding: Optional[list[float]] = field(
        default=None,
        metadata={
            "db": Column(Vector(DEFAULT_CORE_CONFIG.block_embedding_dim), nullable=True)
        },
    )

    # Relationships
    project: "Project" = field(
        init=False, metadata={"db": relationship("Project", back_populates="tools")}
    )
    user: Optional["User"] = field(
        init=False,
        default=None,
        metadata={"db": relationship("User", back_populates="tools")},
    )
