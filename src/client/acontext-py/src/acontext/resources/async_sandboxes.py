"""
Sandboxes endpoints (async).
"""

from .._utils import build_params
from ..client_types import AsyncRequesterProtocol
from ..types.sandbox import (
    GetSandboxLogsOutput,
    SandboxCommandOutput,
    SandboxRuntimeInfo,
)
from ..types.tool import FlagResponse


class AsyncSandboxesAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def create(self) -> SandboxRuntimeInfo:
        """Create and start a new sandbox.

        Returns:
            SandboxRuntimeInfo containing the sandbox ID, status, and timestamps.
        """
        data = await self._requester.request("POST", "/sandbox")
        return SandboxRuntimeInfo.model_validate(data)

    async def exec_command(
        self,
        *,
        sandbox_id: str,
        command: str,
    ) -> SandboxCommandOutput:
        """Execute a shell command in the sandbox.

        Args:
            sandbox_id: The UUID of the sandbox.
            command: The shell command to execute.

        Returns:
            SandboxCommandOutput containing stdout, stderr, and exit code.
        """
        data = await self._requester.request(
            "POST",
            f"/sandbox/{sandbox_id}/exec",
            json_data={"command": command},
        )
        return SandboxCommandOutput.model_validate(data)

    async def kill(self, sandbox_id: str) -> FlagResponse:
        """Kill a running sandbox.

        Args:
            sandbox_id: The UUID of the sandbox to kill.

        Returns:
            FlagResponse with status and error message.
        """
        data = await self._requester.request("DELETE", f"/sandbox/{sandbox_id}")
        return FlagResponse.model_validate(data)

    async def get_logs(
        self,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> GetSandboxLogsOutput:
        """Get sandbox logs for the project with cursor-based pagination.

        Args:
            limit: Maximum number of logs to return (default 20, max 200).
            cursor: Cursor for pagination. Use the cursor from the previous response to get the next page.
            time_desc: Order by created_at descending if True, ascending if False (default False).

        Returns:
            GetSandboxLogsOutput containing the list of sandbox logs and pagination information.
        """
        params = build_params(limit=limit, cursor=cursor, time_desc=time_desc)
        data = await self._requester.request("GET", "/sandbox/logs", params=params or None)
        return GetSandboxLogsOutput.model_validate(data)
