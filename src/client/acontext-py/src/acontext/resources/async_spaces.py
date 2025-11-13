"""
Spaces endpoints (async).
"""

from collections.abc import Mapping
from typing import Any, List

from .._utils import build_params
from ..client_types import AsyncRequesterProtocol
from ..types.space import (
    ListSpacesOutput,
    SearchResultBlockItem,
    Space,
    SpaceSearchResult,
)


class AsyncSpacesAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def list(
        self,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListSpacesOutput:
        """List all spaces in the project.

        Args:
            limit: Maximum number of spaces to return. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.

        Returns:
            ListSpacesOutput containing the list of spaces and pagination information.
        """
        params = build_params(limit=limit, cursor=cursor, time_desc=time_desc)
        data = await self._requester.request("GET", "/space", params=params or None)
        return ListSpacesOutput.model_validate(data)

    async def create(self, *, configs: Mapping[str, Any] | None = None) -> Space:
        """Create a new space.

        Args:
            configs: Optional space configuration dictionary. Defaults to None.

        Returns:
            The created Space object.
        """
        payload: dict[str, Any] = {}
        if configs is not None:
            payload["configs"] = configs
        data = await self._requester.request("POST", "/space", json_data=payload)
        return Space.model_validate(data)

    async def delete(self, space_id: str) -> None:
        """Delete a space by its ID.

        Args:
            space_id: The UUID of the space to delete.
        """
        await self._requester.request("DELETE", f"/space/{space_id}")

    async def update_configs(
        self,
        space_id: str,
        *,
        configs: Mapping[str, Any],
    ) -> None:
        """Update space configurations.

        Args:
            space_id: The UUID of the space.
            configs: Space configuration dictionary.
        """
        payload = {"configs": configs}
        await self._requester.request(
            "PUT", f"/space/{space_id}/configs", json_data=payload
        )

    async def get_configs(self, space_id: str) -> Space:
        """Get space configurations.

        Args:
            space_id: The UUID of the space.

        Returns:
            Space object containing the configurations.
        """
        data = await self._requester.request("GET", f"/space/{space_id}/configs")
        return Space.model_validate(data)

    async def experience_search(
        self,
        space_id: str,
        *,
        query: str,
        limit: int | None = None,
        mode: str | None = None,
        semantic_threshold: float | None = None,
        max_iterations: int | None = None,
    ) -> SpaceSearchResult:
        """Perform experience search within a space.

        This is the most advanced search option that can operate in two modes:
        - fast: Quick semantic search (default)
        - agentic: Iterative search with AI-powered refinement

        Args:
            space_id: The UUID of the space.
            query: The search query string.
            limit: Maximum number of results to return (1-50, default 10).
            mode: Search mode, either "fast" or "agentic" (default "fast").
            semantic_threshold: Cosine distance threshold (0=identical, 2=opposite).
            max_iterations: Maximum iterations for agentic search (1-100, default 16).

        Returns:
            SpaceSearchResult containing cited blocks and optional final answer.
        """
        params = build_params(
            query=query,
            limit=limit,
            mode=mode,
            semantic_threshold=semantic_threshold,
            max_iterations=max_iterations,
        )
        data = await self._requester.request(
            "GET", f"/space/{space_id}/experience_search", params=params or None
        )
        return SpaceSearchResult.model_validate(data)

    async def semantic_glob(
        self,
        space_id: str,
        *,
        query: str,
        limit: int | None = None,
        threshold: float | None = None,
    ) -> List[SearchResultBlockItem]:
        """Perform semantic global (glob) search for page/folder titles.

        Searches specifically for page/folder titles using semantic similarity,
        similar to a semantic version of the glob command.

        Args:
            space_id: The UUID of the space.
            query: Search query for page/folder titles.
            limit: Maximum number of results to return (1-50, default 10).
            threshold: Cosine distance threshold (0=identical, 2=opposite).

        Returns:
            List of SearchResultBlockItem objects matching the query.
        """
        params = build_params(query=query, limit=limit, threshold=threshold)
        data = await self._requester.request(
            "GET", f"/space/{space_id}/semantic_glob", params=params or None
        )
        return [SearchResultBlockItem.model_validate(item) for item in data]

    async def semantic_grep(
        self,
        space_id: str,
        *,
        query: str,
        limit: int | None = None,
        threshold: float | None = None,
    ) -> List[SearchResultBlockItem]:
        """Perform semantic grep search for content blocks.

        Searches through content blocks (actual text content) using semantic similarity,
        similar to a semantic version of the grep command.

        Args:
            space_id: The UUID of the space.
            query: Search query for content blocks.
            limit: Maximum number of results to return (1-50, default 10).
            threshold: Cosine distance threshold (0=identical, 2=opposite).

        Returns:
            List of SearchResultBlockItem objects matching the query.
        """
        params = build_params(query=query, limit=limit, threshold=threshold)
        data = await self._requester.request(
            "GET", f"/space/{space_id}/semantic_grep", params=params or None
        )
        return [SearchResultBlockItem.model_validate(item) for item in data]
