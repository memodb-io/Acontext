"""
User management endpoints (async).
"""

from urllib.parse import quote

from ..client_types import AsyncRequesterProtocol


class AsyncUsersAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def delete(self, identifier: str) -> None:
        """Delete a user and cascade delete all associated resources (Space, Session, Disk, Skill).

        Args:
            identifier: The user identifier string.
        """
        await self._requester.request("DELETE", f"/user/{quote(identifier, safe='')}")
