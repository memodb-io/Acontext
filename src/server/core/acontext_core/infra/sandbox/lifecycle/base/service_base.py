from abc import ABC, abstractmethod
from typing import  Optional
from ..models.entities import SandboxInfo, SandboxPage


class SandboxService(ABC):
    """Abstract base class for sandbox lifecycle services."""

    @abstractmethod
    async def search_sandboxes(
        self, page_id: Optional[str] = None, limit: int = 100
    ) -> SandboxPage:
        """Search sandboxes with pagination."""
        raise NotImplementedError

    @abstractmethod
    async def get_sandbox(self, sandbox_id: str) -> Optional[SandboxInfo]:
        """Get a single sandbox, or return None if it does not exist."""
        raise NotImplementedError

    @abstractmethod
    async def start_sandbox(self, sandbox_spec_id: Optional[str] = None) -> SandboxInfo:
        """Start a new sandbox, using the default spec when `sandbox_spec_id` is None."""
        raise NotImplementedError

    @abstractmethod
    async def pause_sandbox(self, sandbox_id: str) -> bool:
        """Pause a sandbox. Return True on success, False if it does not exist."""
        raise NotImplementedError

    @abstractmethod
    async def resume_sandbox(self, sandbox_id: str) -> bool:
        """Resume a sandbox. Return True on success, False if it does not exist."""
        raise NotImplementedError

    @abstractmethod
    async def delete_sandbox(self, sandbox_id: str) -> bool:
        """Delete a sandbox, stopping it if needed.

        Returns True on success, False if it does not exist.
        """
        raise NotImplementedError


