"""Type definitions for sandbox resources."""

from pydantic import BaseModel, Field


class SandboxRuntimeInfo(BaseModel):
    """Runtime information about a sandbox."""

    sandbox_id: str = Field(..., description="Sandbox ID")
    sandbox_status: str = Field(..., description="Sandbox status (running, killed, paused, error)")
    sandbox_created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    sandbox_expires_at: str = Field(..., description="ISO 8601 formatted expiration timestamp")


class SandboxCommandOutput(BaseModel):
    """Output from executing a command in a sandbox."""

    stdout: str = Field(..., description="Standard output from the command")
    stderr: str = Field(..., description="Standard error from the command")
    exit_code: int = Field(..., description="Exit code of the command")
