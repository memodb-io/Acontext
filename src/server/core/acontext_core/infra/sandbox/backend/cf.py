import os
import base64
from datetime import datetime
from typing import Type
import httpx

from .base import SandboxBackend
from ....schema.sandbox import (
    SandboxCreateConfig,
    SandboxUpdateConfig,
    SandboxRuntimeInfo,
    SandboxCommandOutput,
    SandboxStatus,
)
from ....env import DEFAULT_CORE_CONFIG, LOG as logger
from ...s3 import S3_CLIENT


def _convert_status(status_str: str) -> SandboxStatus:
    """Convert Cloudflare Sandbox status string to SandboxStatus enum."""
    status_lower = status_str.lower()
    if status_lower == "running":
        return SandboxStatus.RUNNING
    elif status_lower == "paused":
        return SandboxStatus.PAUSED
    elif status_lower == "killed" or status_lower == "success":
        return SandboxStatus.SUCCESS
    elif status_lower == "error":
        return SandboxStatus.ERROR
    else:
        logger.warning(f"Unknown sandbox status: {status_str}, defaulting to RUNNING")
        return SandboxStatus.RUNNING


class CloudflareSandboxBackend(SandboxBackend):
    """Cloudflare Sandbox Backend using HTTP API proxy.

    This backend communicates with a Cloudflare Worker that acts as a proxy
    to the Cloudflare Sandbox SDK, providing secure isolated environments
    for code execution.
    """

    type: str = "cloudflare"

    def __init__(
        self,
        worker_url: str,
        auth_token: str | None = None,
        timeout: float = 120.0,
    ):
        """Initialize the Cloudflare sandbox backend.

        Args:
            worker_url: The base URL of the Cloudflare Worker API.
            auth_token: Optional authentication token for the Worker API.
            timeout: HTTP request timeout in seconds (default: 120.0).
        """
        self.__worker_url = worker_url.rstrip("/")
        self.__auth_token = auth_token
        self.__timeout = timeout
        self.__keepalive_seconds = DEFAULT_CORE_CONFIG.sandbox_default_keepalive_seconds
        self.__client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.__timeout),
            follow_redirects=True,
        )

    @classmethod
    def from_default(
        cls: Type["CloudflareSandboxBackend"],
    ) -> "CloudflareSandboxBackend":
        """Create an instance using default configuration from CoreConfig."""
        return cls(
            worker_url=DEFAULT_CORE_CONFIG.cloudflare_worker_url
            or "http://localhost:8787",
            auth_token=DEFAULT_CORE_CONFIG.cloudflare_worker_auth_token,
        )

    def _get_headers(self) -> dict[str, str]:
        """Get HTTP headers including optional authentication."""
        headers = {"Content-Type": "application/json"}
        if self.__auth_token:
            headers["Authorization"] = f"Bearer {self.__auth_token}"
        return headers

    async def start_sandbox(
        self, create_config: SandboxCreateConfig
    ) -> SandboxRuntimeInfo:
        """Create and start a new Cloudflare sandbox.

        Args:
            create_config: Configuration for the sandbox including timeout, CPU, memory, etc.

        Returns:
            Runtime information about the created sandbox.
        """
        additional_configs = dict(create_config.additional_configs)
        sandbox_id = (
            additional_configs.pop("sandbox_id", None)
            or f"sandbox-{os.urandom(8).hex()}"
        )

        request_body = {
            "sandbox_id": sandbox_id,
            "keepalive_seconds": self.__keepalive_seconds,
            "additional_configs": additional_configs,
        }

        try:
            response = await self.__client.post(
                f"{self.__worker_url}/sandbox/create",
                json=request_body,
                headers=self._get_headers(),
            )
            response.raise_for_status()
            data = response.json()

            # Parse response
            created_at = datetime.fromisoformat(
                data["sandbox_created_at"].replace("Z", "+00:00")
            )
            expires_at = (
                datetime.fromisoformat(
                    data["sandbox_expires_at"].replace("Z", "+00:00")
                )
                if data.get("sandbox_expires_at")
                else None
            )

            return SandboxRuntimeInfo(
                sandbox_id=data["sandbox_id"],
                sandbox_status=_convert_status(data["sandbox_status"]),
                sandbox_created_at=created_at,
                sandbox_expires_at=expires_at or created_at,
            )
        except httpx.HTTPStatusError as e:
            logger.error(
                f"Failed to create sandbox: {e.response.status_code} - {e.response.text}"
            )
            raise ValueError(f"Failed to create sandbox: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Failed to create sandbox: {e}")
            raise ValueError(f"Failed to create sandbox: {e}")

    async def kill_sandbox(self, sandbox_id: str) -> bool:
        """Kill a running sandbox.

        Args:
            sandbox_id: The ID of the sandbox to kill.

        Returns:
            True if the sandbox was successfully killed, False otherwise.
        """
        try:
            response = await self.__client.post(
                f"{self.__worker_url}/sandbox/{sandbox_id}/kill",
                headers=self._get_headers(),
            )
            response.raise_for_status()
            data = response.json()
            return data.get("success", False)
        except httpx.HTTPStatusError as e:
            logger.error(
                f"Failed to kill sandbox {sandbox_id}: {e.response.status_code} - {e.response.text}"
            )
            return False
        except Exception as e:
            logger.error(f"Failed to kill sandbox {sandbox_id}: {e}")
            return False

    async def get_sandbox(self, sandbox_id: str) -> SandboxRuntimeInfo:
        """Get runtime information about a sandbox.

        Args:
            sandbox_id: The ID of the sandbox to query.

        Returns:
            Runtime information including status, creation time, and expiration.

        Raises:
            ValueError: If the sandbox is not found or not accessible.
        """
        try:
            response = await self.__client.get(
                f"{self.__worker_url}/sandbox/{sandbox_id}",
                params={"keepalive_seconds": self.__keepalive_seconds},
                headers=self._get_headers(),
            )
            response.raise_for_status()
            data = response.json()

            # Parse response
            created_at = datetime.fromisoformat(
                data["sandbox_created_at"].replace("Z", "+00:00")
            )
            expires_at = (
                datetime.fromisoformat(
                    data["sandbox_expires_at"].replace("Z", "+00:00")
                )
                if data.get("sandbox_expires_at")
                else None
            )

            return SandboxRuntimeInfo(
                sandbox_id=data["sandbox_id"],
                sandbox_status=_convert_status(data["sandbox_status"]),
                sandbox_created_at=created_at,
                sandbox_expires_at=expires_at or created_at,
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Sandbox with ID {sandbox_id} not found")
            logger.error(
                f"Failed to get sandbox {sandbox_id}: {e.response.status_code} - {e.response.text}"
            )
            raise ValueError(f"Failed to get sandbox: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Failed to get sandbox {sandbox_id}: {e}")
            raise ValueError(f"Failed to get sandbox: {e}")

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
        try:
            request_body = {
                "keepalive_longer_by_seconds": update_config.keepalive_longer_by_seconds,
            }

            response = await self.__client.post(
                f"{self.__worker_url}/sandbox/{sandbox_id}/update",
                json=request_body,
                headers=self._get_headers(),
            )
            response.raise_for_status()
            data = response.json()

            # Parse response
            created_at = datetime.fromisoformat(
                data["sandbox_created_at"].replace("Z", "+00:00")
            )
            expires_at = (
                datetime.fromisoformat(
                    data["sandbox_expires_at"].replace("Z", "+00:00")
                )
                if data.get("sandbox_expires_at")
                else None
            )

            return SandboxRuntimeInfo(
                sandbox_id=data["sandbox_id"],
                sandbox_status=_convert_status(data["sandbox_status"]),
                sandbox_created_at=created_at,
                sandbox_expires_at=expires_at or created_at,
            )
        except httpx.HTTPStatusError as e:
            logger.error(
                f"Failed to update sandbox {sandbox_id}: {e.response.status_code} - {e.response.text}"
            )
            raise ValueError(f"Failed to update sandbox: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Failed to update sandbox {sandbox_id}: {e}")
            raise ValueError(f"Failed to update sandbox: {e}")

    async def exec_command(self, sandbox_id: str, command: str) -> SandboxCommandOutput:
        """Execute a shell command in the sandbox.

        Args:
            sandbox_id: The ID of the sandbox to execute the command in.
            command: The shell command to execute.

        Returns:
            The command output including stdout, stderr, and exit code.
        """
        try:
            request_body = {
                "command": command,
                "keepalive_seconds": self.__keepalive_seconds,
            }

            response = await self.__client.post(
                f"{self.__worker_url}/sandbox/{sandbox_id}/exec",
                json=request_body,
                headers=self._get_headers(),
            )
            response.raise_for_status()
            data = response.json()

            return SandboxCommandOutput(
                stdout=data.get("stdout", ""),
                stderr=data.get("stderr", ""),
                exit_code=data.get("exit_code", 0),
            )
        except httpx.HTTPStatusError as e:
            logger.error(
                f"Failed to execute command in sandbox {sandbox_id}: {e.response.status_code} - {e.response.text}"
            )
            raise ValueError(f"Failed to execute command: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Failed to execute command in sandbox {sandbox_id}: {e}")
            raise ValueError(f"Failed to execute command: {e}")

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
            request_body = {
                "file_path": from_sandbox_file,
                "encoding": "base64",
                "keepalive_seconds": self.__keepalive_seconds,
            }
            response = await self.__client.post(
                f"{self.__worker_url}/sandbox/{sandbox_id}/download",
                json=request_body,
                headers=self._get_headers(),
            )
            response.raise_for_status()
            data = response.json()

            content_base64 = data.get("content", "")
            if not content_base64:
                raise ValueError("Empty content received from sandbox")

            try:
                content_bytes = base64.b64decode(content_base64, validate=True)
            except Exception as decode_error:
                logger.error(
                    f"Base64 decode failed. Content length: {len(content_base64)}, "
                    f"First 50 chars: {content_base64[:50]}, error: {decode_error}"
                )
                raise

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
            content_bytes = await S3_CLIENT.download_object(key=from_s3_file)
            content_base64 = base64.b64encode(content_bytes).decode("utf-8")

            filename = os.path.basename(from_s3_file)
            sandbox_file_path = f"{upload_to_sandbox_path.rstrip('/')}/{filename}"

            request_body = {
                "file_path": sandbox_file_path,
                "content": content_base64,
                "encoding": "base64",
                "keepalive_seconds": self.__keepalive_seconds,
            }

            response = await self.__client.post(
                f"{self.__worker_url}/sandbox/{sandbox_id}/upload",
                json=request_body,
                headers=self._get_headers(),
            )
            response.raise_for_status()
            data = response.json()

            if not data.get("success", False):
                raise ValueError("Upload to sandbox failed")

            logger.info(
                f"Uploaded file to sandbox {sandbox_id}: s3://{from_s3_file} -> {sandbox_file_path}"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to upload file to sandbox {sandbox_id}: {from_s3_file} -> {upload_to_sandbox_path}, error: {e}"
            )
            return False
