from dataclasses import dataclass, field
from sqlalchemy import Column, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from typing import TYPE_CHECKING
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .project import Project


@ORM_BASE.mapped
@dataclass
class Metric(CommonMixin):
    __tablename__ = "metrics"

    __table_args__ = (
        Index(
            "idx_metric_project_id_tag_created_at", "project_id", "tag", "created_at"
        ),
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

    tag: str = field(metadata={"db": Column(String, nullable=False)})

    increment: int = field(
        default=0,
        metadata={"db": Column(Integer, nullable=False, default=0)},
    )

    # Relationships
    project: "Project" = field(
        init=False, metadata={"db": relationship("Project", back_populates="metrics")}
    )
