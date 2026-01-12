"""Type definitions for space resources."""

from typing import Any

from pydantic import BaseModel, Field


class Space(BaseModel):
    """Space model representing a space resource."""

    id: str = Field(..., description="Space UUID")
    project_id: str = Field(..., description="Project UUID")
    user_id: str | None = Field(None, description="User UUID")
    configs: dict[str, Any] | None = Field(
        None, description="Space configuration dictionary"
    )
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class ListSpacesOutput(BaseModel):
    """Response model for listing spaces."""

    items: list[Space] = Field(..., description="List of spaces")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")


class SearchResultBlockItem(BaseModel):
    """Search result block item model."""

    block_id: str = Field(..., description="Block UUID")
    title: str = Field(..., description="Block title")
    type: str = Field(..., description="Block type")
    props: dict[str, Any] = Field(..., description="Block properties")
    distance: float | None = Field(
        None, description="Cosine distance (0=identical, 2=opposite)"
    )


class SpaceSearchResult(BaseModel):
    """Experience search result model."""

    cited_blocks: list[SearchResultBlockItem] = Field(
        ..., description="List of cited blocks"
    )
    final_answer: str | None = Field(None, description="AI-generated final answer")


class ExperienceConfirmation(BaseModel):
    """Experience confirmation model."""

    id: str = Field(..., description="Experience confirmation UUID")
    space_id: str = Field(..., description="Space UUID")
    task_id: str | None = Field(None, description="Task UUID (optional)")
    experience_data: dict[str, Any] = Field(
        ..., description="Experience data dictionary"
    )
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class ListExperienceConfirmationsOutput(BaseModel):
    """Response model for listing experience confirmations."""

    items: list[ExperienceConfirmation] = Field(
        ..., description="List of experience confirmations"
    )
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")
