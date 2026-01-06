"""
Novita's sandbox sdk looks just like E2B, except the Sandbox.connect will reset the timeout
"""

from novita_sandbox.code_interpreter import AsyncSandbox
from novita_sandbox.code_interpreter import SandboxState as E2B_SandboxState
from typing import Type
from .base import SandboxBackend
from ....env import DEFAULT_CORE_CONFIG
from ....schema.sandbox import (
    SandboxCreateConfig,
    SandboxUpdateConfig,
    SandboxRuntimeInfo,
    SandboxCommandOutput,
    SandboxStatus,
)


def _convert_e2b_state(state: E2B_SandboxState) -> SandboxStatus:
    if state == E2B_SandboxState.RUNNING:
        return SandboxStatus.RUNNING
    elif state == E2B_SandboxState.PAUSED:
        return SandboxStatus.PAUSED
    raise ValueError(f"Unknown sandbox state: {state}")


class NovitaSandboxBackend(SandboxBackend):
    """Novita Sandbox Backend using novita_sandbox SDK.

    This backend manages cloud sandboxes through Novita's infrastructure,
    providing secure isolated environments for code execution.
    """

    type: str = "novita"

    def __init__(
        self, api_key: str, default_template: str, domain_base_url: str | None = None
    ):
        """Initialize the Novita sandbox backend.

        Args:
            domain_base_url: The Novita domain base URL (for custom domains). None for default Novita cloud.
            api_key: The Novita API key for authentication.
        """
        self.__domain_base_url = domain_base_url
        self.__default_template = default_template
        self.__api_key = api_key

    @classmethod
    def from_default(cls: Type["NovitaSandboxBackend"]) -> "NovitaSandboxBackend":
        return cls(
            api_key=DEFAULT_CORE_CONFIG.novita_api_key,
            default_template=DEFAULT_CORE_CONFIG.sandbox_default_template,
        )

    async def start_sandbox(
        self, create_config: SandboxCreateConfig
    ) -> SandboxRuntimeInfo:
        """Create and start a new Novita sandbox.

        Args:
            create_config: Configuration for the sandbox including timeout, CPU, memory, etc.

        Returns:
            Runtime information about the created sandbox.
        """
        template = create_config.template or self.__default_template
        sandbox = await AsyncSandbox.create(
            template=template,
            api_key=self.__api_key,
            domain=self.__domain_base_url,
            timeout=create_config.keepalive_seconds,
            metadata=create_config.additional_configs,
        )
        info = await sandbox.get_info()
        return SandboxRuntimeInfo(
            sandbox_id=info.sandbox_id,
            sandbox_status=_convert_e2b_state(info.state),
            sandbox_created_at=info.started_at,
            sandbox_expires_at=info.end_at,
        )

    async def kill_sandbox(self, sandbox_id: str) -> bool:
        """Kill a running sandbox.

        Args:
            sandbox_id: The ID of the sandbox to kill.
        """
        r = await AsyncSandbox.kill(
            sandbox_id=str(sandbox_id),
            api_key=self.__api_key,
            domain=self.__domain_base_url,
        )
        return r

    async def get_sandbox(self, sandbox_id: str) -> SandboxRuntimeInfo:
        """Get runtime information about a sandbox.

        Args:
            sandbox_id: The ID of the sandbox to query.

        Returns:
            Runtime information including status, creation time, and expiration.

        Raises:
            ValueError: If the sandbox is not found or not running.
        """
        sandbox_id_str = str(sandbox_id)

        try:
            # Connect to the sandbox to verify it exists and is running
            sandbox = await AsyncSandbox.connect(
                sandbox_id=sandbox_id_str,
                api_key=self.__api_key,
                domain=self.__domain_base_url,
                timeout=DEFAULT_CORE_CONFIG.sandbox_default_keepalive_seconds,
            )

            # Get sandbox info using the SDK method
            info = await sandbox.get_info()

            return SandboxRuntimeInfo(
                sandbox_id=info.sandbox_id,
                sandbox_status=_convert_e2b_state(info.state),
                sandbox_created_at=info.started_at,
                sandbox_expires_at=info.end_at,
            )
        except Exception as e:
            raise ValueError(f"Sandbox with ID {sandbox_id_str} not found: {e}")

    async def update_sandbox(
        self, sandbox_id: str, update_config: SandboxUpdateConfig
    ) -> SandboxRuntimeInfo:
        """Update sandbox configuration, such as extending the timeout.

        Args:
            sandbox_id: The ID of the sandbox to update.
            update_config: Configuration updates to apply.

        Returns:
            Runtime information about the updated sandbox.
        """
        sandbox = await AsyncSandbox.connect(
            sandbox_id=str(sandbox_id),
            api_key=self.__api_key,
            domain=self.__domain_base_url,
            timeout=DEFAULT_CORE_CONFIG.sandbox_default_keepalive_seconds,
        )
        await sandbox.set_timeout(update_config.keepalive_longer_by_seconds)
        info = await sandbox.get_info()
        return SandboxRuntimeInfo(
            sandbox_id=info.sandbox_id,
            sandbox_status=_convert_e2b_state(info.state),
            sandbox_created_at=info.started_at,
            sandbox_expires_at=info.end_at,
        )

    async def exec_command(self, sandbox_id: str, command: str) -> SandboxCommandOutput:
        """Execute a shell command in the sandbox.

        Args:
            sandbox_id: The ID of the sandbox to execute the command in.
            command: The shell command to execute.

        Returns:
            The command output including stdout, stderr, and exit code.
        """
        sandbox = await AsyncSandbox.connect(
            sandbox_id=str(sandbox_id),
            api_key=self.__api_key,
            domain=self.__domain_base_url,
            timeout=DEFAULT_CORE_CONFIG.sandbox_default_keepalive_seconds,
        )
        result = await sandbox.commands.run(cmd=command)

        return SandboxCommandOutput(
            stdout=result.stdout,
            stderr=result.stderr,
            exit_code=result.exit_code,
        )
