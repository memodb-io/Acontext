"""Type definitions for user resources."""

from pydantic import BaseModel, Field


class User(BaseModel):
    """User model representing a user resource."""

    id: str = Field(..., description="User UUID")
    project_id: str = Field(..., description="Project UUID")
    identifier: str = Field(..., description="User identifier string")
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class ListUsersOutput(BaseModel):
    """Response model for listing users."""

    items: list[User] = Field(..., description="List of users")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")


class UserResourceCounts(BaseModel):
    """Resource counts for a user."""

    sessions_count: int = Field(..., description="Number of sessions")
    disks_count: int = Field(..., description="Number of disks")
    skills_count: int = Field(..., description="Number of skills")


class GetUserResourcesOutput(BaseModel):
    """Response model for getting user resources."""

    counts: UserResourceCounts = Field(..., description="Resource counts")
