"""
User management endpoints (async).
"""

from urllib.parse import quote

from .._utils import build_params
from ..client_types import AsyncRequesterProtocol
from ..types.user import GetUserResourcesOutput, ListUsersOutput


class AsyncUsersAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def list(
        self,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListUsersOutput:
        """List all users in the project.

        Args:
            limit: Maximum number of users to return. If not provided or 0, all users will be returned. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.

        Returns:
            ListUsersOutput containing the list of users and pagination information.
        """
        params = build_params(limit=limit, cursor=cursor, time_desc=time_desc)
        data = await self._requester.request("GET", "/user/ls", params=params or None)
        return ListUsersOutput.model_validate(data)

    async def get_resources(self, identifier: str) -> GetUserResourcesOutput:
        """Get resource counts for a user.

        Args:
            identifier: The user identifier string.

        Returns:
            GetUserResourcesOutput containing counts for Sessions, Disks, and Skills.
        """
        data = await self._requester.request(
            "GET", f"/user/{quote(identifier, safe='')}/resources"
        )
        return GetUserResourcesOutput.model_validate(data)

    async def delete(self, identifier: str) -> None:
        """Delete a user and cascade delete all associated resources (Session, Disk, Skill).

        Args:
            identifier: The user identifier string.
        """
        await self._requester.request("DELETE", f"/user/{quote(identifier, safe='')}")
