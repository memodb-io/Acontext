from datetime import datetime
from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, Index, Column, String
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.types import DateTime
from typing import TYPE_CHECKING
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .project import Project


@ORM_BASE.mapped
@dataclass
class SandboxLog(CommonMixin):
    __tablename__ = "sandbox_logs"

    __table_args__ = (Index("ix_sandbox_log_project_id", "project_id"),)

    project_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("projects.id", ondelete="CASCADE"),
                nullable=False,
            )
        }
    )

    backend_type: str = field(metadata={"db": Column(String, nullable=False)})
    history_commands: dict = field(metadata={"db": Column(JSONB, nullable=False)})

    history_files: dict = field(metadata={"db": Column(JSONB, nullable=False)})

    expires_at: datetime = field(
        metadata={"db": Column(DateTime(timezone=True), nullable=False)},
    )

    # Relationships
    project: "Project" = field(
        init=False,
        metadata={"db": relationship("Project", back_populates="sandbox_logs")},
    )
