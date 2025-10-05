import uuid
from dataclasses import dataclass, field
from sqlalchemy import String, ForeignKey, Index, CheckConstraint, Column, Boolean, BigInteger
from sqlalchemy.orm import relationship, foreign, remote
from sqlalchemy.dialects.postgresql import JSONB, UUID
from typing import TYPE_CHECKING, Optional, List, Dict, Any
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .space import Space


# Block type configuration matching Go version
BLOCK_TYPES = {
    "page": {
        "name": "page",
        "allow_children": True,
        "require_parent": False,
    },
    "text": {
        "name": "text", 
        "allow_children": True,
        "require_parent": True,
    },
    "snippet": {
        "name": "snippet",
        "allow_children": True,
        "require_parent": True,
    },
}

# Block type constants matching Go version
BLOCK_TYPE_PAGE = "page"
BLOCK_TYPE_TEXT = "text"
BLOCK_TYPE_SNIPPET = "snippet"


def is_valid_block_type(block_type: str) -> bool:
    """Check if the given type is valid"""
    return block_type in BLOCK_TYPES


def get_block_type_config(block_type: str) -> Dict[str, Any]:
    """Get the configuration of a block type"""
    if not is_valid_block_type(block_type):
        raise ValueError(f"invalid block type: {block_type}")
    return BLOCK_TYPES[block_type]


def get_all_block_types() -> Dict[str, Dict[str, Any]]:
    """Get all supported block types"""
    return BLOCK_TYPES


@ORM_BASE.mapped
@dataclass
class Block(CommonMixin):
    __tablename__ = "blocks"

    __table_args__ = (
        # Indexes matching Go version
        Index("idx_blocks_space", "space_id"),
        Index("idx_blocks_space_type", "space_id", "type"),
        Index("idx_blocks_space_type_archived", "space_id", "type", "is_archived"),
        # Unique constraint for space, parent, sort combination
        Index("ux_blocks_space_parent_sort", "space_id", "parent_id", "sort", unique=True),
        # Check constraints matching Go version
        CheckConstraint(
            "type IN ('page', 'text', 'snippet')",
            name="ck_block_type",
        ),
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

    type: str = field(
        metadata={
            "db": Column(
                String,
                nullable=False,
            )
        }
    )

    parent_id: Optional[asUUID] = field(
        default=None,
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("blocks.id", ondelete="CASCADE", onupdate="CASCADE"),
                nullable=True,
            )
        },
    )

    title: str = field(
        default="",
        metadata={
            "db": Column(
                String,
                nullable=False,
                default="",
            )
        },
    )

    props: Dict[str, Any] = field(
        default_factory=dict,
        metadata={
            "db": Column(
                JSONB,
                nullable=False,
                default={},
            )
        },
    )

    sort: int = field(
        default=0,
        metadata={
            "db": Column(
                BigInteger,
                nullable=False,
                default=0,
            )
        },
    )

    is_archived: bool = field(
        default=False,
        metadata={
            "db": Column(
                Boolean,
                nullable=False,
                default=False,
            )
        },
    )

    # Relationships
    space: "Space" = field(
        init=False,
        metadata={
            "db": relationship(
                "Space", 
                back_populates="blocks",
            )
        },
    )

    parent: Optional["Block"] = field(
        init=False,
        metadata={
            "db": relationship(
                "Block",
                remote_side=lambda: Block.id,
                foreign_keys=lambda: Block.parent_id,
                back_populates="children",
                lazy="select",
            )
        },
    )

    children: List["Block"] = field(
        default_factory=list,
        init=False,
        metadata={
            "db": relationship(
                "Block",
                back_populates="parent",
                cascade="all, delete-orphan",
                lazy="selectin",
            )
        },
    )

    def validate(self) -> None:
        """Validate the fields of a Block"""
        # Check if the type is valid
        if not is_valid_block_type(self.type):
            raise ValueError(f"invalid block type: {self.type}")

        config = get_block_type_config(self.type)

        # Check the parent-child relationship constraints
        if config["require_parent"] and self.parent_id is None:
            raise ValueError(f"block type '{self.type}' requires a parent")

        if not config["require_parent"] and self.type != BLOCK_TYPE_PAGE and self.parent_id is None:
            raise ValueError("only page type blocks can exist without a parent")

    def validate_for_creation(self) -> None:
        """Validate the constraints for creation"""
        self.validate()
        # Can add specific validation logic for creation here

    def can_have_children(self) -> bool:
        """Check if the block type can have children"""
        try:
            config = get_block_type_config(self.type)
            return config["allow_children"]
        except ValueError:
            return False
