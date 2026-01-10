"""Type definitions for disk and artifact resources."""

from typing import Any

from pydantic import BaseModel, Field

from .common import FileContent


class Disk(BaseModel):
    """Disk model representing a disk resource."""

    id: str = Field(..., description="Disk UUID")
    project_id: str = Field(..., description="Project UUID")
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class ListDisksOutput(BaseModel):
    """Response model for listing disks."""

    items: list[Disk] = Field(..., description="List of disks")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")


class Artifact(BaseModel):
    """Artifact model representing a file artifact."""

    disk_id: str = Field(..., description="Disk UUID")
    path: str = Field(..., description="File path")
    filename: str = Field(..., description="Filename")
    meta: dict[str, Any] = Field(
        ...,
        description="Metadata dictionary containing __artifact_info__ system metadata and user-defined metadata",
    )
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class GetArtifactResp(BaseModel):
    """Response model for getting an artifact."""

    artifact: Artifact = Field(..., description="Artifact information")
    public_url: str | None = Field(None, description="Presigned URL for downloading the artifact")
    content: FileContent | None = Field(None, description="Parsed file content if available")


class ListArtifactsResp(BaseModel):
    """Response model for listing artifacts."""

    artifacts: list[Artifact] = Field(..., description="List of artifacts")
    directories: list[str] = Field(..., description="List of directory paths")


class UpdateArtifactResp(BaseModel):
    """Response model for updating an artifact."""

    artifact: Artifact = Field(..., description="Updated artifact information")

