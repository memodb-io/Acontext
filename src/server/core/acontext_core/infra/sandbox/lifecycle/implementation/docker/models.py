from typing import Any, Dict, Optional

from pydantic import BaseModel


class DockerRunOptions(BaseModel):
    """Strongly-typed options for starting a Docker sandbox container.

    This mirrors the subset of docker-py container.run(...) arguments that we
    currently use for sandboxes. It can be extended incrementally as needed.
    """

    image: str
    name: str

    # Basic container flags
    detach: bool = True
    tty: bool = True
    stdin_open: bool = True

    # Metadata / labels
    labels: Dict[str, str]

    # Optional runtime configuration
    command: Optional[str] = None
    environment: Optional[Dict[str, str]] = None
    ports: Optional[Dict[str, int]] = None
    volumes: Optional[Dict[str, Dict[str, str]]] = None
    mem_limit: Optional[str] = None
    cpu_shares: Optional[int] = None
    cpuset_cpus: Optional[str] = None
    network: Optional[str] = None
    restart_policy: Optional[Dict[str, Any]] = None

    def to_docker_kwargs(self) -> Dict[str, Any]:
        """Convert into kwargs suitable for docker-py, dropping None values."""
        return self.model_dump(exclude_none=True)


