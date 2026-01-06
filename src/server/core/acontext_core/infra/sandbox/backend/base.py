from abc import abstractmethod, ABC
from ....schema.sandbox import (
    SandboxCreateConfig,
    SandboxUpdateConfig,
    SandboxRuntimeInfo,
    SandboxCommandOutput,
)


class SandboxBackend(ABC):
    @abstractmethod
    def start_sandbox(
        self, create_config: SandboxCreateConfig
    ) -> SandboxRuntimeInfo: ...

    @abstractmethod
    def kill_sandbox(self, sandbox_id: str) -> bool: ...

    @abstractmethod
    def get_sandbox(self, sandbox_id: str) -> SandboxRuntimeInfo: ...

    @abstractmethod
    def update_sandbox(
        self, sandbox_id: str, update_config: SandboxUpdateConfig
    ) -> SandboxRuntimeInfo: ...

    @abstractmethod
    def exec_command(self, sandbox_id: str, command: str) -> SandboxCommandOutput: ...
