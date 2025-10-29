"""Sessions endpoints."""

import json
from dataclasses import asdict, field, is_dataclass
from enum import Enum
from typing import Any, BinaryIO, Mapping, MutableMapping

from ..client_types import RequesterProtocol
from ..messages import AcontextMessage, MessagePart
from ..uploads import FileUpload, normalize_file_upload

UploadPayload = FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None]
MessageBlob = AcontextMessage 


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
        blob: MessageBlob,
        format: str | None = "acontext",
        file_field: str | None = "",
        file: FileUpload | None = None
    ) -> Any:
        if format not in {"acontext", "openai", "anthropic"}:
            raise ValueError("format must be one of {'acontext', 'openai', 'anthropic'}")

        payload = {
            "blob": asdict(blob),
            "format": format,
        }

        file_payload: dict[str, tuple[str, BinaryIO, str | None]] | None = None
        if file:
            # only support upload one file now
            file_payload = {
                file_field: file.as_httpx()
            }

        if file_payload:
            form_data = {"payload": json.dumps(payload)}
            return self._requester.request(
                "POST",
                f"/session/{session_id}/messages",
                data=form_data,
                files=file_payload,
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
