"""Common type definitions shared across modules."""

from pydantic import BaseModel, Field


class FileContent(BaseModel):
    """Parsed file content model."""

    type: str = Field(..., description="File content type: 'text', 'json', 'csv', or 'code'")
    raw: str = Field(..., description="Raw text content of the file")

