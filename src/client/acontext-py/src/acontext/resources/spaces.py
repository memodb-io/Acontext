"""
Spaces endpoints.
"""

from typing import Any, Mapping, MutableMapping

from ..client_types import RequesterProtocol


class SpacesAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def list(self) -> Any:
        return self._requester.request("GET", "/space")

    def status(self) -> Any:
        return self._requester.request("GET", "/space/status")

    def create(self, *, configs: Mapping[str, Any] | MutableMapping[str, Any] | None = None) -> Any:
        payload: dict[str, Any] = {}
        if configs is not None:
            payload["configs"] = configs
        return self._requester.request("POST", "/space", json_data=payload)

    def delete(self, space_id: str) -> None:
        self._requester.request("DELETE", f"/space/{space_id}")

    def update_configs(
        self,
        space_id: str,
        *,
        configs: Mapping[str, Any] | MutableMapping[str, Any],
    ) -> None:
        payload = {"configs": configs}
        self._requester.request("PUT", f"/space/{space_id}/configs", json_data=payload)

    def get_configs(self, space_id: str) -> Any:
        return self._requester.request("GET", f"/space/{space_id}/configs")

    def get_semantic_answer(self, space_id: str, *, query: str) -> Any:
        if not query:
            raise ValueError("query is required")
        params = {"query": query}
        return self._requester.request("GET", f"/space/{space_id}/semantic_answer", params=params)

    def get_semantic_global(self, space_id: str, *, query: str) -> Any:
        if not query:
            raise ValueError("query is required")
        params = {"query": query}
        return self._requester.request("GET", f"/space/{space_id}/semantic_global", params=params)

    def get_semantic_grep(self, space_id: str, *, query: str) -> Any:
        if not query:
            raise ValueError("query is required")
        params = {"query": query}
        return self._requester.request("GET", f"/space/{space_id}/semantic_grep", params=params)
