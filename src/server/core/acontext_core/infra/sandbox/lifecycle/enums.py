from enum import Enum


class SandboxBackend(str, Enum):
    """Backend implementation type."""

    DOCKER = "docker"
    CLOUDFLARE = "cloudflare"


class SandboxStatus(Enum):
    """Status of a sandbox instance."""

    STARTING = "STARTING"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    ERROR = "ERROR"
    MISSING = "MISSING"


