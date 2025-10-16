from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, Index, Column, String
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from typing import TYPE_CHECKING, Optional, List
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .project import Project
    from .tool_reference import ToolReference
    from .block import Block


@ORM_BASE.mapped
@dataclass
class ToolSOP(CommonMixin):
    __tablename__ = "tool_sops"

    __table_args__ = (Index("ix_tool_sop_project_id", "project_id"),)

    annotation: str = field(metadata={"db": Column(String, nullable=False)})

    tool_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("tool_references.id", ondelete="CASCADE"),
                nullable=False,
            )
        }
    )
    sop_block_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("blocks.id", ondelete="CASCADE"),
                nullable=False,
            )
        }
    )

    # Relationships
    tool_reference: "ToolReference" = field(
        init=False,
        metadata={"db": relationship("ToolReference", back_populates="tool_sops")},
    )
    sop_block: "Block" = field(
        init=False,
        metadata={"db": relationship("Block", back_populates="tool_sops")},
    )
