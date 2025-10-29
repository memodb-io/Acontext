from dataclasses import dataclass, field
from optparse import Option
from sqlalchemy import ForeignKey, Index, Column, String
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
    from .tool_sop import ToolSOP


@ORM_BASE.mapped
@dataclass
class ToolReference(CommonMixin):
    __tablename__ = "tool_references"

    __table_args__ = (Index("ix_tool_reference_project_id", "project_id"),)

    name: str = field(metadata={"db": Column(String, nullable=False)})
    description: Optional[str] = field(metadata={"db": Column(String, nullable=True)})
    arguments_schema: Optional[dict] = field(
        metadata={"db": Column(JSONB, nullable=True)}
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

    # Relationships
    project: "Project" = field(
        init=False,
        metadata={"db": relationship("Project", back_populates="tool_references")},
    )

    tool_sops: List["ToolSOP"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "ToolSOP", back_populates="tool_reference", cascade="all, delete-orphan"
            )
        },
    )
