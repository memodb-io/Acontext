"""
Block endpoints.
"""

from typing import Any, Mapping, MutableMapping

from ..client_types import RequesterProtocol


class BlocksAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def list(self, space_id: str, *, parent_id: str) -> Any:
        if not parent_id:
            raise ValueError("parent_id is required")
        params = {"parent_id": parent_id}
        return self._requester.request("GET", f"/space/{space_id}/block", params=params)

    def create(
        self,
        space_id: str,
        *,
        parent_id: str,
        block_type: str,
        title: str | None = None,
        props: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    ) -> Any:
        if not parent_id:
            raise ValueError("parent_id is required")
        if not block_type:
            raise ValueError("block_type is required")
        payload: dict[str, Any] = {"parent_id": parent_id, "type": block_type}
        if title is not None:
            payload["title"] = title
        if props is not None:
            payload["props"] = props
        return self._requester.request("POST", f"/space/{space_id}/block", json_data=payload)

    def delete(self, space_id: str, block_id: str) -> None:
        self._requester.request("DELETE", f"/space/{space_id}/block/{block_id}")

    def get_properties(self, space_id: str, block_id: str) -> Any:
        return self._requester.request("GET", f"/space/{space_id}/block/{block_id}/properties")

    def update_properties(
        self,
        space_id: str,
        block_id: str,
        *,
        title: str | None = None,
        props: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    ) -> None:
        payload: dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if props is not None:
            payload["props"] = props
        if not payload:
            raise ValueError("title or props must be provided")
        self._requester.request("PUT", f"/space/{space_id}/block/{block_id}/properties", json_data=payload)

    def move(
        self,
        space_id: str,
        block_id: str,
        *,
        parent_id: str,
        sort: int | None = None,
    ) -> None:
        if not parent_id:
            raise ValueError("parent_id is required")
        payload: dict[str, Any] = {"parent_id": parent_id}
        if sort is not None:
            payload["sort"] = sort
        self._requester.request("PUT", f"/space/{space_id}/block/{block_id}/move", json_data=payload)

    def update_sort(self, space_id: str, block_id: str, *, sort: int) -> None:
        self._requester.request(
            "PUT",
            f"/space/{space_id}/block/{block_id}/sort",
            json_data={"sort": sort},
        )
