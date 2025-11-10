"""Type definitions for block resources."""

from typing import Any

from pydantic import BaseModel, Field


class Block(BaseModel):
    """Block model representing a block in a space."""

    id: str = Field(..., description="Block UUID")
    space_id: str = Field(..., description="Space UUID")
    type: str = Field(..., description="Block type: 'page', 'folder', 'text', 'sop', etc.")
    parent_id: str | None = Field(None, description="Parent block UUID, optional")
    title: str = Field(..., description="Block title")
    props: dict[str, Any] = Field(..., description="Block properties dictionary")
    sort: int = Field(..., description="Sort order")
    is_archived: bool = Field(..., description="Whether the block is archived")
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")
    children: list["Block"] | None = Field(None, description="List of child blocks, optional")


# Rebuild model to resolve forward references
Block.model_rebuild()

