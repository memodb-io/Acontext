"""Type definitions for skill resources."""

from typing import Any

from pydantic import BaseModel, Field

from .common import FileContent


class FileInfo(BaseModel):
    """File information in a skill."""

    path: str = Field(..., description="Relative file path from skill root")
    mime: str = Field(..., description="MIME type of the file")


class Skill(BaseModel):
    """Skill model representing an agent skill resource."""

    id: str = Field(..., description="Skill UUID")
    name: str = Field(..., description="Skill name (unique within project)")
    description: str = Field(..., description="Skill description")
    file_index: list[FileInfo] = Field(
        ..., description="List of file information (path and MIME type) in the skill"
    )
    meta: dict[str, Any] | None = Field(
        None, description="Custom metadata dictionary"
    )
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class SkillCatalogItem(BaseModel):
    """Catalog item containing only name and description."""

    name: str = Field(..., description="Skill name (unique within project)")
    description: str = Field(..., description="Skill description")


class ListSkillsOutput(BaseModel):
    """Response model for listing skills (catalog format with name and description only)."""

    items: list[SkillCatalogItem] = Field(
        ..., description="List of skills with name and description"
    )
    total: int = Field(..., description="Total number of skills in this response")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")


class _ListSkillsResponse(BaseModel):
    """Internal response model for API pagination (full Skill objects).
    
    This is used internally to parse the raw API response before converting
    to the catalog format (ListSkillsOutput).
    """
    items: list[Skill]
    next_cursor: str | None = None
    has_more: bool = False


class GetSkillFileResp(BaseModel):
    """Response model for getting a skill file."""

    path: str = Field(..., description="File path")
    mime: str = Field(..., description="MIME type of the file")
    url: str | None = Field(None, description="Presigned URL for downloading the file (present if file is not parseable)")
    content: FileContent | None = Field(None, description="Parsed file content if available (present if file is parseable)")

