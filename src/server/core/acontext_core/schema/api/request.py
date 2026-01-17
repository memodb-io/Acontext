from pydantic import BaseModel, Field
from typing import Literal, Any, Optional
from ..utils import asUUID


SearchMode = Literal["fast", "agentic"]


class ToolRename(BaseModel):
    old_name: str = Field(..., description="Old tool name")
    new_name: str = Field(..., description="New tool name")


class ToolRenameRequest(BaseModel):
    rename: list[ToolRename] = Field(..., description="List of tool renames")


class InsertBlockRequest(BaseModel):
    parent_id: Optional[asUUID] = Field(
        None, description="Parent block ID (optional for page/folder types)"
    )
    props: dict[str, Any] = Field(..., description="Block properties")
    title: str = Field(..., description="Block title")
    type: str = Field(..., description="Block type")


class SandboxExecRequest(BaseModel):
    command: str = Field(..., description="Shell command to execute in the sandbox")


class SandboxDownloadRequest(BaseModel):
    from_sandbox_file: str = Field(..., description="Path to the file in the sandbox")
    download_to_s3_key: str = Field(
        ..., description="The full S3 key (path) to upload the file to"
    )


class SandboxUploadRequest(BaseModel):
    from_s3_key: str = Field(..., description="The S3 key of the file to download")
    upload_to_sandbox_file: str = Field(
        ..., description="The full path in the sandbox to upload the file to"
    )
