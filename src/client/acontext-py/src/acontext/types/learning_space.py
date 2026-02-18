"""Type definitions for learning space resources."""

from typing import Any

from pydantic import BaseModel, Field


class LearningSpace(BaseModel):
    """Learning space model representing a learning space resource."""

    id: str = Field(..., description="Learning space UUID")
    user_id: str | None = Field(None, description="User UUID")
    meta: dict[str, Any] | None = Field(None, description="Custom metadata dictionary")
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class LearningSpaceSkill(BaseModel):
    """Junction record linking a learning space to a skill."""

    id: str = Field(..., description="Junction record UUID")
    learning_space_id: str = Field(..., description="Learning space UUID")
    skill_id: str = Field(..., description="Skill UUID")
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")


class LearningSpaceSession(BaseModel):
    """Junction record linking a learning space to a session with learning status."""

    id: str = Field(..., description="Junction record UUID")
    learning_space_id: str = Field(..., description="Learning space UUID")
    session_id: str = Field(..., description="Session UUID")
    status: str = Field(..., description="Learning status: pending, running, completed, or failed")
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class ListLearningSpacesOutput(BaseModel):
    """Response model for listing learning spaces."""

    items: list[LearningSpace] = Field(..., description="List of learning spaces")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")
