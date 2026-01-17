from abc import abstractmethod, ABC
from typing import Type
from ....schema.sandbox import (
    SandboxCreateConfig,
    SandboxUpdateConfig,
    SandboxRuntimeInfo,
    SandboxCommandOutput,
)


class SandboxBackend(ABC):
    type: str

    @classmethod
    @abstractmethod
    def from_default(cls: Type["SandboxBackend"]) -> "SandboxBackend": ...

    @abstractmethod
    async def start_sandbox(
        self, create_config: SandboxCreateConfig
    ) -> SandboxRuntimeInfo: ...

    @abstractmethod
    async def kill_sandbox(self, sandbox_id: str) -> bool: ...

    @abstractmethod
    async def get_sandbox(self, sandbox_id: str) -> SandboxRuntimeInfo: ...

    @abstractmethod
    async def update_sandbox(
        self, sandbox_id: str, update_config: SandboxUpdateConfig
    ) -> SandboxRuntimeInfo: ...

    @abstractmethod
    async def exec_command(
        self, sandbox_id: str, command: str
    ) -> SandboxCommandOutput: ...

    @abstractmethod
    async def download_file(
        self, sandbox_id: str, from_sandbox_file: str, download_to_s3_key: str
    ) -> bool:
        """Download a file from the sandbox and upload it to S3.

        Args:
            sandbox_id: The ID of the sandbox to download from.
            from_sandbox_file: The path to the file in the sandbox.
            download_to_s3_key: The full S3 key (path) to upload the file to.

        Returns:
            True if the download and upload were successful, False otherwise.
        """
        ...

    @abstractmethod
    async def upload_file(
        self, sandbox_id: str, from_s3_key: str, upload_to_sandbox_file: str
    ) -> bool:
        """Download a file from S3 and upload it to the sandbox.

        Args:
            sandbox_id: The ID of the sandbox to upload to.
            from_s3_key: The S3 key to download the file from.
            upload_to_sandbox_file: The full path in the sandbox to upload the file to.

        Returns:
            True if the download and upload were successful, False otherwise.
        """
        ...
