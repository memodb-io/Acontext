"""
Spaces endpoints (async).
"""

from collections.abc import Mapping
from typing import Any

from .._utils import build_params
from ..client_types import AsyncRequesterProtocol
from ..types.space import (
    ExperienceConfirmation,
    ListExperienceConfirmationsOutput,
    ListSpacesOutput,
    Space,
    SpaceSearchResult,
)


class AsyncSpacesAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def list(
        self,
        *,
        user: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListSpacesOutput:
        """List all spaces in the project.

        Args:
            user: Filter by user identifier. Defaults to None.
            limit: Maximum number of spaces to return. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.

        Returns:
            ListSpacesOutput containing the list of spaces and pagination information.
        """
        params = build_params(user=user, limit=limit, cursor=cursor, time_desc=time_desc)
        data = await self._requester.request("GET", "/space", params=params or None)
        return ListSpacesOutput.model_validate(data)

    async def create(
        self,
        *,
        user: str | None = None,
        configs: Mapping[str, Any] | None = None,
    ) -> Space:
        """Create a new space.

        Args:
            user: Optional user identifier string. Defaults to None.
            configs: Optional space configuration dictionary. Defaults to None.

        Returns:
            The created Space object.
        """
        payload: dict[str, Any] = {}
        if user is not None:
            payload["user"] = user
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

    async def get_unconfirmed_experiences(
        self,
        space_id: str,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListExperienceConfirmationsOutput:
        """Get all unconfirmed experiences in a space with cursor-based pagination.

        Args:
            space_id: The UUID of the space.
            limit: Maximum number of confirmations to return (1-200, default 20).
            cursor: Cursor for pagination. Use the cursor from the previous response to get the next page.
            time_desc: Order by created_at descending if True, ascending if False (default False).

        Returns:
            ListExperienceConfirmationsOutput containing the list of experience confirmations and pagination information.
        """
        params = build_params(limit=limit, cursor=cursor, time_desc=time_desc)
        data = await self._requester.request(
            "GET",
            f"/space/{space_id}/experience_confirmations",
            params=params or None,
        )
        return ListExperienceConfirmationsOutput.model_validate(data)

    async def confirm_experience(
        self,
        space_id: str,
        experience_id: str,
        *,
        save: bool,
    ) -> ExperienceConfirmation | None:
        """Confirm an experience confirmation.

        If save is False, delete the row. If save is True, get the data first,
        then delete the row.

        Args:
            space_id: The UUID of the space.
            experience_id: The UUID of the experience confirmation.
            save: If True, get data before deleting. If False, just delete.

        Returns:
            ExperienceConfirmation object if save is True, None otherwise.
        """
        payload = {"save": save}
        data = await self._requester.request(
            "PUT",
            f"/space/{space_id}/experience_confirmations/{experience_id}",
            json_data=payload,
        )
        if data is None:
            return None
        return ExperienceConfirmation.model_validate(data)
