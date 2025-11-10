"""Type definitions for space resources."""

from typing import Any

from pydantic import BaseModel, Field


class Space(BaseModel):
    """Space model representing a space resource."""

    id: str = Field(..., description="Space UUID")
    project_id: str = Field(..., description="Project UUID")
    configs: dict[str, Any] = Field(..., description="Space configuration dictionary")
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class ListSpacesOutput(BaseModel):
    """Response model for listing spaces."""

    items: list[Space] = Field(..., description="List of spaces")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")

