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

    # @abstractmethod
    # def download_path(
    #     self, sandbox_id: str, from_sandbox_path: str, download_to_s3_path: str
    # ) -> bool: ...

    # @abstractmethod
    # def upload_path(
    #     self, sandbox_id: str, from_s3_path: str, upload_to_sandbox_path: str
    # ) -> bool: ...
