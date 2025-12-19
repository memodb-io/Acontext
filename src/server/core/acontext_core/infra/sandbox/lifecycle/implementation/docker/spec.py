from dataclasses import dataclass, field
from typing import Dict, Optional

from ...base import SandboxSpecService
from ...enums import SandboxBackend
from ...models import SandboxSpecInfoBase


class DockerSandboxSpecInfo(SandboxSpecInfoBase):
    """Spec definition for Docker-based sandboxes.

    Only a subset of Docker-related fields that are useful for this project are
    modeled here. More advanced options can be added incrementally when needed.
    """

    backend: SandboxBackend = SandboxBackend.DOCKER

    # Base image and command configuration
    image: str = "python:3.11-slim"
    command: Optional[str] = None  # Fallbacks to image CMD when not provided

    # Resource limits
    mem_limit: Optional[str] = None  # e.g. "512m", "1g"
    cpu_shares: Optional[int] = None
    cpuset_cpus: Optional[str] = None  # e.g. "0-1"

    # Environment variables, ports, volumes, network, etc.
    environment: Optional[Dict[str, str]] = None
    ports: Optional[Dict[str, int]] = None  # e.g. {"8080/tcp": 18080}
    volumes: Optional[Dict[str, Dict[str, str]]] = None
    network: Optional[str] = None
    labels: Optional[Dict[str, str]] = None

    # Restart policy (usually not required for sandboxes; kept as a placeholder)
    restart_policy: Optional[Dict[str, object]] = None


@dataclass
class DockerSandboxSpecService(SandboxSpecService):
    """In-memory Docker spec service for simple templates/preset configs."""

    _specs: Dict[str, DockerSandboxSpecInfo] = field(
        default_factory=lambda: {
            # Default lightweight Python sandbox
            "docker-default": DockerSandboxSpecInfo(
                id="docker-default",
                image="python:3.11-slim",
                mem_limit="1g",
                cpu_shares=512,
                environment={"PYTHONUNBUFFERED": "1"},
                labels={"acontext.profile": "default"},
            ),
            # Long-running sandbox (e.g. notebook / VS Code-like workloads)
            "docker-long-running": DockerSandboxSpecInfo(
                id="docker-long-running",
                image="python:3.11-slim",
                mem_limit="2g",
                cpu_shares=1024,
                environment={
                    "PYTHONUNBUFFERED": "1",
                    "ACONTEXT_SANDBOX_MODE": "long-running",
                },
                labels={"acontext.profile": "long-running"},
            ),
            # Short-running sandbox (scripts / tests)
            "docker-short-running": DockerSandboxSpecInfo(
                id="docker-short-running",
                image="python:3.11-slim",
                mem_limit="512m",
                cpu_shares=256,
                environment={
                    "PYTHONUNBUFFERED": "1",
                    "ACONTEXT_SANDBOX_MODE": "short-running",
                },
                labels={"acontext.profile": "short-running"},
            ),
        }
    )

    async def get_sandbox_spec(self, spec_id: str) -> Optional[DockerSandboxSpecInfo]:
        return self._specs.get(spec_id)

    async def get_default_sandbox_spec(self) -> DockerSandboxSpecInfo:
        return self._specs["docker-default"]


