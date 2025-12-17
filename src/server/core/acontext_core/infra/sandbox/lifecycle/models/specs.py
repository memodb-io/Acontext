from pydantic import BaseModel

from ..enums import SandboxBackend


class SandboxSpecInfoBase(BaseModel):
    """Base class for sandbox specs; concrete implementations can extend fields."""

    id: str
    backend: SandboxBackend


