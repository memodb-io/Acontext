from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from ..enums import SandboxBackend, SandboxStatus


class ExposedUrl(BaseModel):
    """Service URL exposed from inside the container (e.g. action server, VSCode)."""

    name: str
    url: str
    port: int


class SandboxInfo(BaseModel):
    """Sandbox metadata that can be persisted or returned to upper layers."""

    id: str
    created_by_user_id: Optional[str] = None
    sandbox_spec_id: str
    backend: SandboxBackend = SandboxBackend.DOCKER
    status: SandboxStatus
    session_api_key: Optional[str] = None
    exposed_urls: Optional[List[ExposedUrl]] = None  # URLs exposed from the container for runtimes
    created_at: datetime = datetime.now()


class SandboxPage(BaseModel):
    """Paginated result for sandbox listings."""

    items: List[SandboxInfo]
    next_page_id: Optional[str] = None


