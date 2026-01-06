from abc import abstractmethod, ABC
from ....schema.utils import asUUID
from ....schema.sandbox import (
    SandboxCreateConfig,
    SandboxUpdateConfig,
    SandboxRuntimeInfo,
)


class SandboxBackend(ABC):
    @abstractmethod
    def enabled(self) -> bool: ...

    @abstractmethod
    def start_sandbox(self, create_config: SandboxCreateConfig) -> asUUID: ...

    @abstractmethod
    def kill_sandbox(self, sandbox_id: asUUID) -> None: ...

    @abstractmethod
    def get_sandbox(self, sandbox_id: asUUID) -> SandboxRuntimeInfo: ...

    @abstractmethod
    def update_sandbox(
        self, sandbox_id: asUUID, update_config: SandboxUpdateConfig
    ) -> None: ...
