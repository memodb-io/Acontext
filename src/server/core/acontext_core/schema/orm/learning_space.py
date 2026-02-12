from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, Index, Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from typing import TYPE_CHECKING, Optional
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .project import Project


@ORM_BASE.mapped
@dataclass
class LearningSpace(CommonMixin):
    __tablename__ = "learning_spaces"

    __table_args__ = (
        Index("ix_learning_space_project_id", "project_id"),
        Index("ix_learning_space_user_id", "user_id"),
        Index("idx_ls_meta", "meta", postgresql_using="gin"),
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

    meta: Optional[dict] = field(
        default=None, metadata={"db": Column(JSONB, nullable=True)}
    )

    # Relationships
    project: "Project" = field(
        init=False,
        metadata={
            "db": relationship("Project", back_populates="learning_spaces")
        },
    )
