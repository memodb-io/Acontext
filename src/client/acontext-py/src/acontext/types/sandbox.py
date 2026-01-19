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


class HistoryCommand(BaseModel):
    command: str = Field(..., description="The shell command that was executed")
    exit_code: int = Field(..., description="The exit code of the command")


class GeneratedFile(BaseModel):
    sandbox_path: str = Field(..., description="The path to the file in the sandbox")


class SandboxLog(BaseModel):
    id: str = Field(..., description="Sandbox log UUID")
    project_id: str = Field(..., description="Project UUID")
    backend_sandbox_id: str | None = Field(None, description="Backend sandbox ID")
    backend_type: str = Field(..., description="Backend type (e.g., e2b, cloudflare)")
    history_commands: list[HistoryCommand] = Field(..., description="Array of command execution records")
    generated_files: list[GeneratedFile] = Field(..., description="Array of files generated/downloaded from the sandbox")
    will_total_alive_seconds: int = Field(..., description="Total seconds the sandbox will be alive")
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class GetSandboxLogsOutput(BaseModel):
    items: list[SandboxLog] = Field(..., description="List of sandbox logs")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")
