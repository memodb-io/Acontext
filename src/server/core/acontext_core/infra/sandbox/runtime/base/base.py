from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple


class SandboxRuntime(ABC):

    def __init__(self, sandbox_id: str) -> None:
        self.sandbox_id = sandbox_id

    @abstractmethod
    async def exec(
        self,
        cmd: List[str],
        workdir: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> Tuple[int, str, str]:
        pass

    async def upload_file(self, local_path: str, remote_path: str) -> None:

        raise NotImplementedError

    async def download_file(self, remote_path: str) -> bytes:

        raise NotImplementedError



