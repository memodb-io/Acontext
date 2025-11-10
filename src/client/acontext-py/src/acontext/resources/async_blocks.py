"""
Block endpoints (async).
"""

from collections.abc import Mapping, MutableMapping
from typing import Any

from ..client_types import AsyncRequesterProtocol
from ..types.block import Block


class AsyncBlocksAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def list(
        self,
        space_id: str,
        *,
        parent_id: str | None = None,
        block_type: str | None = None,
    ) -> list[Block]:
        """List blocks in a space.
        
        Args:
            space_id: The UUID of the space.
            parent_id: Filter blocks by parent ID. Defaults to None.
            block_type: Filter blocks by type (e.g., "page", "folder", "text", "sop"). Defaults to None.
            
        Returns:
            List of Block objects.
        """
        params: dict[str, Any] = {}
        if parent_id is not None:
            params["parent_id"] = parent_id
        if block_type is not None:
            params["type"] = block_type
        data = await self._requester.request("GET", f"/space/{space_id}/block", params=params or None)
        return [Block.model_validate(item) for item in data]

    async def create(
        self,
        space_id: str,
        *,
        block_type: str,
        parent_id: str | None = None,
        title: str | None = None,
        props: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    ) -> Block:
        """Create a new block in a space.
        
        Args:
            space_id: The UUID of the space.
            block_type: The type of block (e.g., "page", "folder", "text", "sop").
            parent_id: Optional parent block ID. Defaults to None.
            title: Optional block title. Defaults to None.
            props: Optional block properties dictionary. Defaults to None.
            
        Returns:
            The created Block object.
        """
        payload: dict[str, Any] = {"type": block_type}
        if parent_id is not None:
            payload["parent_id"] = parent_id
        if title is not None:
            payload["title"] = title
        if props is not None:
            payload["props"] = props
        data = await self._requester.request("POST", f"/space/{space_id}/block", json_data=payload)
        return Block.model_validate(data)

    async def delete(self, space_id: str, block_id: str) -> None:
        """Delete a block by its ID.
        
        Args:
            space_id: The UUID of the space.
            block_id: The UUID of the block to delete.
        """
        await self._requester.request("DELETE", f"/space/{space_id}/block/{block_id}")

    async def get_properties(self, space_id: str, block_id: str) -> Block:
        """Get block properties.
        
        Args:
            space_id: The UUID of the space.
            block_id: The UUID of the block.
            
        Returns:
            Block object containing the properties.
        """
        data = await self._requester.request("GET", f"/space/{space_id}/block/{block_id}/properties")
        return Block.model_validate(data)

    async def update_properties(
        self,
        space_id: str,
        block_id: str,
        *,
        title: str | None = None,
        props: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    ) -> None:
        """Update block properties.
        
        Args:
            space_id: The UUID of the space.
            block_id: The UUID of the block.
            title: Optional block title. Defaults to None.
            props: Optional block properties dictionary. Defaults to None.
            
        Raises:
            ValueError: If both title and props are None.
        """
        payload: dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if props is not None:
            payload["props"] = props
        if not payload:
            raise ValueError("title or props must be provided")
        await self._requester.request("PUT", f"/space/{space_id}/block/{block_id}/properties", json_data=payload)

    async def move(
        self,
        space_id: str,
        block_id: str,
        *,
        parent_id: str | None = None,
        sort: int | None = None,
    ) -> None:
        """Move a block by updating its parent or sort order.
        
        Args:
            space_id: The UUID of the space.
            block_id: The UUID of the block to move.
            parent_id: Optional new parent block ID. Defaults to None.
            sort: Optional new sort order. Defaults to None.
            
        Raises:
            ValueError: If both parent_id and sort are None.
        """
        payload: dict[str, Any] = {}
        if parent_id is not None:
            payload["parent_id"] = parent_id
        if sort is not None:
            payload["sort"] = sort
        if not payload:
            raise ValueError("parent_id or sort must be provided")
        await self._requester.request("PUT", f"/space/{space_id}/block/{block_id}/move", json_data=payload)

    async def update_sort(self, space_id: str, block_id: str, *, sort: int) -> None:
        """Update block sort order.
        
        Args:
            space_id: The UUID of the space.
            block_id: The UUID of the block.
            sort: The new sort order.
        """
        await self._requester.request(
            "PUT",
            f"/space/{space_id}/block/{block_id}/sort",
            json_data={"sort": sort},
        )

