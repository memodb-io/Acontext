"""
Novita's sandbox sdk looks just like E2B, except the Sandbox.connect will reset the timeout
"""

import os
from novita_sandbox.code_interpreter import AsyncSandbox
from novita_sandbox.code_interpreter import SandboxState as E2B_SandboxState
from typing import Type
from .base import SandboxBackend
from ....env import DEFAULT_CORE_CONFIG, LOG as logger
from ....schema.sandbox import (
    SandboxCreateConfig,
    SandboxUpdateConfig,
    SandboxRuntimeInfo,
    SandboxCommandOutput,
    SandboxStatus,
)
from ...s3 import S3_CLIENT


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

    async def connect_sandbox(self, sandbox_id: str) -> AsyncSandbox:
        return await AsyncSandbox.connect(
            sandbox_id=str(sandbox_id),
            api_key=self.__api_key,
            domain=self.__domain_base_url,
            timeout=DEFAULT_CORE_CONFIG.sandbox_default_keepalive_seconds,
        )

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
        try:
            # Connect to the sandbox to verify it exists and is running
            sandbox = await self.connect_sandbox(sandbox_id)

            # Get sandbox info using the SDK method
            info = await sandbox.get_info()

            return SandboxRuntimeInfo(
                sandbox_id=info.sandbox_id,
                sandbox_status=_convert_e2b_state(info.state),
                sandbox_created_at=info.started_at,
                sandbox_expires_at=info.end_at,
            )
        except Exception as e:
            raise ValueError(f"Sandbox with ID {sandbox_id} not found: {e}")

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
        sandbox = await self.connect_sandbox(sandbox_id)
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
        sandbox = await self.connect_sandbox(sandbox_id)
        result = await sandbox.commands.run(cmd=command)

        return SandboxCommandOutput(
            stdout=result.stdout,
            stderr=result.stderr,
            exit_code=result.exit_code,
        )

    async def download_file(
        self, sandbox_id: str, from_sandbox_file: str, download_to_s3_path: str
    ) -> bool:
        """Download a file from the sandbox and upload it to S3.

        Args:
            sandbox_id: The ID of the sandbox to download from.
            from_sandbox_file: The path to the file in the sandbox.
            download_to_s3_path: The S3 parent directory to upload the file to.

        Returns:
            True if the download and upload were successful, False otherwise.
        """

        try:
            sandbox = await self.connect_sandbox(sandbox_id)

            # Read file content from sandbox
            content = await sandbox.files.read(from_sandbox_file)

            # Convert to bytes if necessary (files.read returns str or bytes)
            if isinstance(content, str):
                content_bytes = content.encode("utf-8")
            else:
                content_bytes = content

            # Extract base filename and construct full S3 key
            filename = os.path.basename(from_sandbox_file)
            s3_key = f"{download_to_s3_path.rstrip('/')}/{filename}"

            # Upload to S3
            await S3_CLIENT.upload_object(
                key=s3_key,
                data=content_bytes,
            )

            logger.info(
                f"Downloaded file from sandbox {sandbox_id}: {from_sandbox_file} -> s3://{s3_key}"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to download file from sandbox {sandbox_id}: {from_sandbox_file} -> {download_to_s3_path}, error: {e}"
            )
            return False

    async def upload_file(
        self, sandbox_id: str, from_s3_file: str, upload_to_sandbox_path: str
    ) -> bool:
        """Download a file from S3 and upload it to the sandbox.

        Args:
            sandbox_id: The ID of the sandbox to upload to.
            from_s3_file: The S3 key to download the file from.
            upload_to_sandbox_path: The parent directory in the sandbox to upload the file to.

        Returns:
            True if the download and upload were successful, False otherwise.
        """

        try:
            # Download from S3
            content = await S3_CLIENT.download_object(key=from_s3_file)

            sandbox = await self.connect_sandbox(sandbox_id)

            # Extract base filename and construct full sandbox path
            filename = os.path.basename(from_s3_file)
            sandbox_file_path = f"{upload_to_sandbox_path.rstrip('/')}/{filename}"

            # Write file to sandbox
            await sandbox.files.write(sandbox_file_path, content)

            logger.info(
                f"Uploaded file to sandbox {sandbox_id}: s3://{from_s3_file} -> {sandbox_file_path}"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to upload file to sandbox {sandbox_id}: {from_s3_file} -> {upload_to_sandbox_path}, error: {e}"
            )
            return False
