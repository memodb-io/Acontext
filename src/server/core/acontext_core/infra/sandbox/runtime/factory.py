from ..lifecycle.models import SandboxInfo
from .base import SandboxRuntime
from .registry import get_runtime_for_sandbox as _dispatch_runtime


def get_runtime_for_sandbox(sandbox: SandboxInfo) -> SandboxRuntime:
    """Backward-compatible wrapper to dispatch runtime by backend."""
    return _dispatch_runtime(sandbox)

