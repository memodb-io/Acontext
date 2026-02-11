from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from typing import TYPE_CHECKING, List, Optional
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .project import Project
    from .artifact import Artifact
    from .agent_skill import AgentSkill


@ORM_BASE.mapped
@dataclass
class Disk(CommonMixin):
    __tablename__ = "disks"

    project_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("projects.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            )
        }
    )

    user_id: Optional[asUUID] = field(
        default=None,
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                nullable=True,
                index=True,
            )
        },
    )

    # Relationships — passive_deletes because tables are owned by API
    project: "Project" = field(
        init=False,
        metadata={
            "db": relationship(
                "Project", back_populates="disks", passive_deletes=True
            )
        },
    )

    artifacts: List["Artifact"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Artifact", back_populates="disk", passive_deletes=True
            )
        },
    )

    agent_skills: List["AgentSkill"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "AgentSkill", back_populates="disk", passive_deletes=True
            )
        },
    )
