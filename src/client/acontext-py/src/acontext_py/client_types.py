"""
Common typing helpers used by resource modules to avoid circular imports.
"""

from __future__ import annotations

from typing import Any, BinaryIO, Mapping, MutableMapping, Protocol


class RequesterProtocol(Protocol):
    def request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        json_data: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
        data: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
        files: Mapping[str, tuple[str, BinaryIO, str | None]] | None = None,
        unwrap: bool = True,
    ) -> Any:
        ...
