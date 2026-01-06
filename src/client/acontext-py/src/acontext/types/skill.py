"""Type definitions for skill resources."""

from typing import Any

from pydantic import BaseModel, Field


class Skill(BaseModel):
    """Skill model representing an agent skill resource."""

    id: str = Field(..., description="Skill UUID")
    project_id: str = Field(..., description="Project UUID")
    name: str = Field(..., description="Skill name (unique within project)")
    description: str = Field(..., description="Skill description")
    file_index: list[str] = Field(
        ..., description="List of relative file paths in the skill"
    )
    meta: dict[str, Any] = Field(
        ..., description="Custom metadata dictionary"
    )
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class ListSkillsOutput(BaseModel):
    """Response model for listing skills."""

    items: list[Skill] = Field(..., description="List of skills")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")


class FileContent(BaseModel):
    """Parsed file content model."""

    type: str = Field(..., description="File content type: 'text', 'json', 'csv', or 'code'")
    raw: str = Field(..., description="Raw text content of the file")


class GetSkillFileResp(BaseModel):
    """Response model for getting a skill file."""

    url: str | None = Field(None, description="Presigned URL for downloading the file")
    content: FileContent | None = Field(None, description="Parsed file content if available")

