"""Type definitions for tool resources."""

from pydantic import BaseModel, Field


class FlagResponse(BaseModel):
    """Flag response with status and error message."""

    status: int = Field(..., description="Status code")
    errmsg: str = Field(..., description="Error message")


class ToolReferenceData(BaseModel):
    """Tool reference data."""

    name: str = Field(..., description="Tool name")
    sop_count: int = Field(..., description="Number of SOPs using this tool")


class ToolRenameItem(BaseModel):
    """Tool rename item."""

    old_name: str = Field(..., description="Old tool name")
    new_name: str = Field(..., description="New tool name")

