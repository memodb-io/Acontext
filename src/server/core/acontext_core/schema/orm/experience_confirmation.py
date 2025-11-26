from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, Index, Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from typing import TYPE_CHECKING, Optional

from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .space import Space
    from .task import Task


@ORM_BASE.mapped
@dataclass
class ExperienceConfirmation(CommonMixin):
    __tablename__ = "experience_confirmations"

    __table_args__ = (
        Index("idx_experience_confirmations_space", "space_id"),
        Index("idx_experience_confirmations_task", "task_id"),
    )

    space_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("spaces.id", ondelete="CASCADE", onupdate="CASCADE"),
                nullable=False,
            )
        }
    )

    experience_data: dict = field(metadata={"db": Column(JSONB, nullable=False)})

    task_id: Optional[asUUID] = field(
        default=None,
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("tasks.id", ondelete="CASCADE", onupdate="CASCADE"),
                nullable=True,
            )
        },
    )

    # Relationships
    space: "Space" = field(
        init=False,
        metadata={
            "db": relationship(
                "Space",
                back_populates="experience_confirmations",
            )
        },
    )

    task: Optional["Task"] = field(
        init=False,
        metadata={
            "db": relationship(
                "Task",
            )
        },
    )
