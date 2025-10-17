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
