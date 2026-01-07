from typing import Type
from .backend.base import SandboxBackend
from .backend.e2b import E2BSandboxBackend
from .backend.novita import NovitaSandboxBackend
from ...env import DEFAULT_CORE_CONFIG, LOG

SANDBOX_FACTORIES: dict[str, Type[SandboxBackend]] = {
    "disabled": None,
    E2BSandboxBackend.type: E2BSandboxBackend,
    NovitaSandboxBackend.type: NovitaSandboxBackend,
}


class SandboxClient:
    def __init__(self):
        self.__enabled = False
        self.__sanbox_backend: SandboxBackend | None = None

    async def init(self):
        if self.enabled:
            LOG.info("Sandbox is already initialized")
            return

        st = DEFAULT_CORE_CONFIG.sandbox_type
        if st not in SANDBOX_FACTORIES:
            raise ValueError(
                f"Invalid sandbox type: {DEFAULT_CORE_CONFIG.sandbox_type}"
            )
        if SANDBOX_FACTORIES[st] is None:
            LOG.warning("Sandbox is disabled")
            return
        self.__sanbox_backend = SANDBOX_FACTORIES[
            DEFAULT_CORE_CONFIG.sandbox_type
        ].from_default()
        LOG.info("Sandbox is enabled")

    async def close(self):
        self.__sanbox_backend = None
        self.__enabled = False

    @property
    def enabled(self) -> bool:
        return self.__enabled

    def use_backend(self) -> SandboxBackend:
        if self.__sanbox_backend is None:
            raise ValueError("No Sandboxbackend is enabled")
        return self.__sanbox_backend


SANDBOX_CLIENT = SandboxClient()


async def init_sandbox():
    await SANDBOX_CLIENT.init()


async def close_sandbox():
    await SANDBOX_CLIENT.close()
