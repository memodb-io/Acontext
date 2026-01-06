from enum import StrEnum
from datetime import datetime
from pydantic import BaseModel, Field
from .utils import asUUID


class SandboxStatus(StrEnum):
    RUNNING = "running"
    SUCCESS = "killed"
    ERROR = "error"


class SandboxCreateConfig(BaseModel):
    keepalive_seconds: int = 60 * 60
    cpu_cores: float = 1
    memory_mb: int = 1024
    disk_gb: int = 10
    additional_configs: dict[str, str] = Field(default_factory=dict)


class SandboxUpdateConfig(BaseModel):
    keepalive_longer_by_seconds: int


class SandboxRuntimeInfo(BaseModel):
    sandbox_id: asUUID
    sandbox_status: SandboxStatus
    sandbox_created_at: datetime
    sandbox_expires_at: datetime
