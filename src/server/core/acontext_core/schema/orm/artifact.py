from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, Column, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from typing import TYPE_CHECKING, Optional
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .disk import Disk


@ORM_BASE.mapped
@dataclass
class Artifact(CommonMixin):
    __tablename__ = "artifacts"

    __table_args__ = (
        UniqueConstraint(
            "disk_id", "path", "filename", name="idx_disk_path_filename"
        ),
    )

    disk_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("disks.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            )
        }
    )

    path: str = field(
        metadata={
            "db": Column(String, nullable=False)
        }
    )

    filename: str = field(
        metadata={
            "db": Column(String, nullable=False)
        }
    )

    asset_meta: dict = field(
        metadata={"db": Column(JSONB, nullable=False)},
    )

    meta: Optional[dict] = field(
        default=None,
        metadata={"db": Column(JSONB, nullable=True)},
    )

    # Relationships — passive_deletes because tables are owned by API
    disk: "Disk" = field(
        init=False,
        metadata={
            "db": relationship(
                "Disk", back_populates="artifacts", passive_deletes=True
            )
        },
    )
