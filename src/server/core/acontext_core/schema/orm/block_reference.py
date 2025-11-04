from dataclasses import dataclass, field
from sqlalchemy import ForeignKey, Index, Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from typing import TYPE_CHECKING

from .base import ORM_BASE, TimestampMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .block import Block


@ORM_BASE.mapped
@dataclass
class BlockReference(TimestampMixin):
    """
    BlockReference table records a one-to-one relationship with blocks.
    Each reference block can only have one BlockReference row.
    It records which block references another block.
    """

    __tablename__ = "block_references"

    __table_args__ = (
        # Indexes for efficient queries
        Index("idx_block_references_block", "block_id"),
        Index("idx_block_references_reference_block", "reference_block_id"),
    )

    # The block that contains the reference (one-to-one with blocks table)
    # Serves as both foreign key and primary key
    block_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("blocks.id", ondelete="CASCADE", onupdate="CASCADE"),
                primary_key=True,  # Primary key enforces uniqueness and one-to-one relationship
                nullable=False,
            )
        }
    )

    # The block being referenced
    reference_block_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("blocks.id", ondelete="CASCADE", onupdate="CASCADE"),
                nullable=False,
            )
        }
    )

    # Relationships
    block: "Block" = field(
        init=False,
        metadata={
            "db": relationship(
                "Block",
                foreign_keys=lambda: [BlockReference.block_id],
                back_populates="block_reference",
                lazy="select",
            )
        },
    )

    reference_block: "Block" = field(
        init=False,
        metadata={
            "db": relationship(
                "Block",
                foreign_keys=lambda: [BlockReference.reference_block_id],
                back_populates="referenced_by",
                lazy="select",
            )
        },
    )
