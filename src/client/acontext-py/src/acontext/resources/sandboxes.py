"""
Sandboxes endpoints.
"""

from ..client_types import RequesterProtocol
from ..types.sandbox import (
    SandboxCommandOutput,
    SandboxRuntimeInfo,
)
from ..types.tool import FlagResponse


class SandboxesAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def create(self) -> SandboxRuntimeInfo:
        """Create and start a new sandbox.

        Returns:
            SandboxRuntimeInfo containing the sandbox ID, status, and timestamps.
        """
        data = self._requester.request("POST", "/sandbox")
        return SandboxRuntimeInfo.model_validate(data)

    def exec_command(
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
        data = self._requester.request(
            "POST",
            f"/sandbox/{sandbox_id}/exec",
            json_data={"command": command},
        )
        return SandboxCommandOutput.model_validate(data)

    def kill(self, sandbox_id: str) -> FlagResponse:
        """Kill a running sandbox.

        Args:
            sandbox_id: The UUID of the sandbox to kill.

        Returns:
            FlagResponse with status and error message.
        """
        data = self._requester.request("DELETE", f"/sandbox/{sandbox_id}")
        return FlagResponse.model_validate(data)
