"""
Tool management endpoints (async).
"""

import json
from collections.abc import Mapping
from typing import Any, Literal
from urllib.parse import quote

from .._utils import build_params
from ..client_types import AsyncRequesterProtocol
from ..types.tool import ListToolsOutput, SearchToolsOutput, Tool


ToolFormat = Literal["openai", "anthropic", "gemini"]


class AsyncToolsAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def upsert(
        self,
        *,
        openai_schema: Mapping[str, Any],
        config: Mapping[str, Any] | None = None,
        user: str | None = None,
    ) -> Tool:
        """Create or update a tool schema."""
        payload: dict[str, Any] = {"openai_schema": dict(openai_schema)}
        if config is not None:
            payload["config"] = dict(config)
        if user is not None:
            payload["user"] = user
        data = await self._requester.request("POST", "/tools", json_data=payload)
        return Tool.model_validate(data)

    async def list(
        self,
        *,
        user: str | None = None,
        filter_config: Mapping[str, Any] | None = None,
        format: ToolFormat | None = None,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListToolsOutput:
        """List tools."""
        params: dict[str, Any] = {}
        if user is not None:
            params["user"] = user
        if filter_config is not None and len(filter_config) > 0:
            params["filter_config"] = json.dumps(filter_config)
        params.update(
            build_params(
                format=format,
                limit=limit,
                cursor=cursor,
                time_desc=time_desc,
            )
        )
        data = await self._requester.request("GET", "/tools", params=params or None)
        return ListToolsOutput.model_validate(data)

    async def search(
        self,
        *,
        query: str,
        user: str | None = None,
        format: ToolFormat | None = None,
        limit: int | None = None,
    ) -> SearchToolsOutput:
        """Semantic search for tools by natural-language query."""
        params: dict[str, Any] = {"query": query}
        if user is not None:
            params["user"] = user
        params.update(build_params(format=format, limit=limit))
        data = await self._requester.request("GET", "/tools/search", params=params)
        return SearchToolsOutput.model_validate(data)

    async def delete(self, name: str, *, user: str | None = None) -> None:
        """Delete a tool by name."""
        params: dict[str, Any] = {}
        if user is not None:
            params["user"] = user
        await self._requester.request(
            "DELETE", f"/tools/{quote(name, safe='')}", params=params or None
        )

