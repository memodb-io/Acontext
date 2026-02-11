"""Type definitions for tool resources."""

from typing import Any, Literal

from pydantic import BaseModel, Field


ToolFormat = Literal["openai", "anthropic", "gemini"]


class Tool(BaseModel):
    """Tool model representing a tool schema stored in Acontext."""

    id: str = Field(..., description="Tool UUID")
    project_id: str = Field(..., description="Project UUID")
    user_id: str | None = Field(None, description="User UUID (null for project-scoped)")

    name: str = Field(..., description="Tool name")
    description: str = Field(..., description="Tool description")
    config: dict[str, Any] | None = Field(None, description="Optional tool config object")
    schema_: dict[str, Any] = Field(
        ...,
        alias="schema",
        description="Tool schema in requested format",
    )

    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class ListToolsOutput(BaseModel):
    """Response model for listing tools."""

    items: list[Tool] = Field(..., description="List of tools")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")


class ToolSearchHit(BaseModel):
    """A single search result hit for tools."""

    tool: Tool = Field(..., description="Matched tool")
    distance: float = Field(..., description="Cosine distance (lower is closer)")


class SearchToolsOutput(BaseModel):
    """Response model for searching tools."""

    items: list[ToolSearchHit] = Field(..., description="Search results")
