from abc import ABC, abstractmethod
from typing import Optional

from ..models.specs import SandboxSpecInfoBase


class SandboxSpecService(ABC):
    """Abstract base class for sandbox spec/template services."""

    @abstractmethod
    async def get_sandbox_spec(self, spec_id: str) -> Optional[SandboxSpecInfoBase]:
        """Get a sandbox spec by ID."""
        raise NotImplementedError

    @abstractmethod
    async def get_default_sandbox_spec(self) -> SandboxSpecInfoBase:
        """Get the default sandbox spec."""
        raise NotImplementedError


