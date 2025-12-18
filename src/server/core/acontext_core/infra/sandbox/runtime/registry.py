from typing import Callable, Dict

from ..lifecycle.models import SandboxBackend, SandboxInfo
from .base import SandboxRuntime


_RUNTIME_REGISTRY: Dict[SandboxBackend, Callable[[SandboxInfo], SandboxRuntime]] = {

}


def register_runtime_backend(
    backend: SandboxBackend, factory: Callable[[SandboxInfo], SandboxRuntime]
) -> None:
    """Register a runtime factory for a backend."""
    _RUNTIME_REGISTRY[backend] = factory


def get_runtime_for_sandbox(sandbox: SandboxInfo) -> SandboxRuntime:
    """Dispatch to a runtime implementation based on sandbox backend."""
    factory = _RUNTIME_REGISTRY.get(sandbox.backend)
    if factory is None:
        raise ValueError(f"No runtime registered for backend: {sandbox.backend}")
    return factory(sandbox)

