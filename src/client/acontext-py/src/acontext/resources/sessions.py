"""
Sessions endpoints.
"""

import json
from typing import Any, Mapping, MutableMapping, Sequence

from .._constants import SUPPORTED_ROLES
from ..messages import MessagePart, build_message_payload
from ..client_types import RequesterProtocol


class SessionsAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def list(
        self,
        *,
        space_id: str | None = None,
        not_connected: bool | None = None,
    ) -> Any:
        params: dict[str, Any] = {}
        if space_id:
            params["space_id"] = space_id
        if not_connected is not None:
            params["not_connected"] = "true" if not_connected else "false"
        return self._requester.request("GET", "/session", params=params or None)

    def create(
        self,
        *,
        space_id: str | None = None,
        configs: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    ) -> Any:
        payload: dict[str, Any] = {}
        if space_id:
            payload["space_id"] = space_id
        if configs is not None:
            payload["configs"] = configs
        return self._requester.request("POST", "/session", json_data=payload)

    def delete(self, session_id: str) -> None:
        self._requester.request("DELETE", f"/session/{session_id}")

    def update_configs(
        self,
        session_id: str,
        *,
        configs: Mapping[str, Any] | MutableMapping[str, Any],
    ) -> None:
        payload = {"configs": configs}
        self._requester.request("PUT", f"/session/{session_id}/configs", json_data=payload)

    def get_configs(self, session_id: str) -> Any:
        return self._requester.request("GET", f"/session/{session_id}/configs")

    def connect_to_space(self, session_id: str, *, space_id: str) -> None:
        payload = {"space_id": space_id}
        self._requester.request("POST", f"/session/{session_id}/connect_to_space", json_data=payload)

    def send_message(
        self,
        session_id: str,
        *,
        role: str,
        parts: Sequence[MessagePart | str | Mapping[str, Any]],
        format: str | None = None,
    ) -> Any:
        if role not in SUPPORTED_ROLES:
            raise ValueError(f"role must be one of {SUPPORTED_ROLES!r}")
        if not parts:
            raise ValueError("parts must contain at least one entry")

        payload_parts, files = build_message_payload(parts)
        payload = {"role": role, "parts": payload_parts}
        if format is not None:
            payload["format"] = format

        if files:
            form_data = {"payload": json.dumps(payload)}
            return self._requester.request(
                "POST",
                f"/session/{session_id}/messages",
                data=form_data,
                files=files,
            )

        return self._requester.request(
            "POST",
            f"/session/{session_id}/messages",
            json_data=payload,
        )

    def get_messages(
        self,
        session_id: str,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        with_asset_public_url: bool | None = None,
        format: str | None = None,
    ) -> Any:
        params: dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if cursor is not None:
            params["cursor"] = cursor
        if with_asset_public_url is not None:
            params["with_asset_public_url"] = "true" if with_asset_public_url else "false"
        if format is not None:
            params["format"] = format
        return self._requester.request("GET", f"/session/{session_id}/messages", params=params or None)
