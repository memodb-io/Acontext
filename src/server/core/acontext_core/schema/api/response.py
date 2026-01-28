from pydantic import BaseModel, Field


class Flag(BaseModel):
    status: int
    errmsg: str


class SandboxFileTransferResponse(BaseModel):
    success: bool = Field(..., description="Whether the file transfer was successful")
