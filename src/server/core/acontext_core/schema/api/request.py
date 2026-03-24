from pydantic import BaseModel, Field
from typing import Literal, Optional


SearchMode = Literal["fast", "agentic"]


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
    user_kek: Optional[str] = Field(
        None, description="Base64-encoded user KEK for decrypting encrypted S3 objects"
    )
