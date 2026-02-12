from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, Column, String
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from typing import TYPE_CHECKING, Optional
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .project import Project
    from .disk import Disk


@ORM_BASE.mapped
@dataclass
class AgentSkill(CommonMixin):
    __tablename__ = "agent_skills"

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

    name: str = field(
        metadata={
            "db": Column(String, nullable=False)
        }
    )

    disk_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("disks.id", ondelete="CASCADE"),
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
                index=True,
            )
        },
    )

    description: Optional[str] = field(
        default=None,
        metadata={
            "db": Column(String, nullable=True)
        },
    )

    meta: Optional[dict] = field(
        default=None,
        metadata={"db": Column(JSONB, nullable=True)},
    )

    # Relationships — passive_deletes because tables are owned by API
    project: "Project" = field(
        init=False,
        metadata={
            "db": relationship(
                "Project", back_populates="agent_skills", passive_deletes=True
            )
        },
    )

    disk: "Disk" = field(
        init=False,
        metadata={
            "db": relationship(
                "Disk", back_populates="agent_skills", passive_deletes=True
            )
        },
    )
