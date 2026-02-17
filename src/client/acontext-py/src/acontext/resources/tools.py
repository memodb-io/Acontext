"""
Tool management endpoints.
"""

import json
from collections.abc import Mapping
from typing import Any, Literal
from urllib.parse import quote

from .._utils import build_params
from ..client_types import RequesterProtocol
from ..types.tool import ListToolsOutput, SearchToolsOutput, Tool


ToolFormat = Literal["openai", "anthropic", "gemini"]


class ToolsAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def upsert(
        self,
        *,
        openai_schema: Mapping[str, Any],
        config: Mapping[str, Any] | None = None,
        user: str | None = None,
    ) -> Tool:
        """Create or update a tool schema.

        Args:
            openai_schema: Tool schema in OpenAI tool schema format.
            config: Optional tool metadata config.
            user: Optional user identifier string. If omitted, the tool is project-scoped.

        Returns:
            The upserted Tool object (schema is returned in OpenAI format).
        """
        payload: dict[str, Any] = {"openai_schema": dict(openai_schema)}
        if config is not None:
            payload["config"] = dict(config)
        if user is not None:
            payload["user"] = user
        data = self._requester.request("POST", "/tools", json_data=payload)
        return Tool.model_validate(data)

    def list(
        self,
        *,
        user: str | None = None,
        filter_config: Mapping[str, Any] | None = None,
        format: ToolFormat | None = None,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListToolsOutput:
        """List tools.

        Args:
            user: Optional user identifier string. If omitted, lists project-scoped tools.
            filter_config: Optional JSONB containment filter for tool config.
            format: Output tool schema format: openai|anthropic|gemini.
            limit: Maximum number of tools to return. Defaults to None (server default).
            cursor: Cursor for pagination.
            time_desc: Order by created_at descending if True.

        Returns:
            ListToolsOutput containing tools and pagination info.
        """
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
        data = self._requester.request("GET", "/tools", params=params or None)
        return ListToolsOutput.model_validate(data)

    def search(
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
        data = self._requester.request("GET", "/tools/search", params=params)
        return SearchToolsOutput.model_validate(data)

    def delete(self, name: str, *, user: str | None = None) -> None:
        """Delete a tool by name."""
        params: dict[str, Any] = {}
        if user is not None:
            params["user"] = user
        self._requester.request(
            "DELETE", f"/tools/{quote(name, safe='')}", params=params or None
        )

