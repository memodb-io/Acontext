from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, String, Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from typing import TYPE_CHECKING
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .project import Project


@ORM_BASE.mapped
@dataclass
class User(CommonMixin):
    __tablename__ = "users"

    __table_args__ = (
        UniqueConstraint(
            "project_id", "identifier", name="idx_project_identifier"
        ),
    )

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

    identifier: str = field(
        metadata={
            "db": Column(String, nullable=False)
        }
    )
