"""
User management endpoints.
"""

from urllib.parse import quote

from ..client_types import RequesterProtocol


class UsersAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def delete(self, identifier: str) -> None:
        """Delete a user and cascade delete all associated resources (Space, Session, Disk, Skill).

        Args:
            identifier: The user identifier string.
        """
        self._requester.request("DELETE", f"/user/{quote(identifier, safe='')}")
