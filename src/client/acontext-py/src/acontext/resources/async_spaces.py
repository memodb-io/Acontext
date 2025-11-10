"""
Spaces endpoints (async).
"""

from collections.abc import Mapping, MutableMapping
from typing import Any

from .._utils import build_params
from ..client_types import AsyncRequesterProtocol
from ..types.space import (
    ListSpacesOutput,
    Space,
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

    async def create(self, *, configs: Mapping[str, Any] | MutableMapping[str, Any] | None = None) -> Space:
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
        configs: Mapping[str, Any] | MutableMapping[str, Any],
    ) -> None:
        """Update space configurations.
        
        Args:
            space_id: The UUID of the space.
            configs: Space configuration dictionary.
        """
        payload = {"configs": configs}
        await self._requester.request("PUT", f"/space/{space_id}/configs", json_data=payload)

    async def get_configs(self, space_id: str) -> Space:
        """Get space configurations.
        
        Args:
            space_id: The UUID of the space.
            
        Returns:
            Space object containing the configurations.
        """
        data = await self._requester.request("GET", f"/space/{space_id}/configs")
        return Space.model_validate(data)

