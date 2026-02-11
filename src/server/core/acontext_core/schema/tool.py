from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


ToolFormat = Literal["openai", "anthropic", "gemini"]


class ToolUpsertRequest(BaseModel):
    user_id: Optional[UUID] = Field(None, description="Optional user ID (UUID)")
    openai_schema: dict[str, Any] = Field(
        ..., description="Tool schema in OpenAI tool schema format"
    )
    config: Optional[dict[str, Any]] = Field(
        None, description="Optional tool metadata config (JSON object)"
    )


class ToolOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    project_id: UUID
    user_id: Optional[UUID] = None

    name: str
    description: str
    config: Optional[dict[str, Any]] = None

    # Provider-specific schema based on ToolFormat.
    schema_: dict[str, Any] = Field(..., alias="schema")

    created_at: datetime
    updated_at: datetime


class ListToolsResponse(BaseModel):
    items: list[ToolOut]
    next_cursor: Optional[str] = None
    has_more: bool


class ToolSearchHit(BaseModel):
    tool: ToolOut
    distance: float


class SearchToolsResponse(BaseModel):
    items: list[ToolSearchHit]
