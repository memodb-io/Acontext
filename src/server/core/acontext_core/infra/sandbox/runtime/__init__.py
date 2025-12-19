from .base import SandboxRuntime
from .registry import get_runtime_for_sandbox, register_runtime_backend

# Register runtime implementations
from ..lifecycle.enums import SandboxBackend
from ..lifecycle.models import SandboxInfo
from .implementation.docker import DockerSandboxRuntime


def _create_docker_runtime(sandbox: SandboxInfo) -> SandboxRuntime:
    """
    Factory function to create Docker runtime instance.
    
    Design Principle:
        One Docker container corresponds to one Docker runtime instance.
        Each runtime instance is bound to a specific sandbox_id, which uniquely
        identifies a Docker container via the 'acontext.sandboxId' label.
    
    Note:
        While it's technically possible to create multiple runtime instances
        for the same sandbox_id (they will all operate on the same container),
        this is not recommended as it can lead to:
        - Concurrent command execution conflicts
        - File operation race conditions
        - Resource contention issues
    Args:
        sandbox: SandboxInfo containing the sandbox_id to bind the runtime to.
    
    Returns:
        A new DockerSandboxRuntime instance bound to the given sandbox_id.
    """
    return DockerSandboxRuntime(sandbox.id)


# Auto-register Docker runtime
register_runtime_backend(SandboxBackend.DOCKER, _create_docker_runtime)

__all__ = [
    "SandboxRuntime",
    "get_runtime_for_sandbox",
    "register_runtime_backend",
]


