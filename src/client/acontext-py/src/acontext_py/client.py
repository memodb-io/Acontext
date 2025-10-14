"""
High-level synchronous client for the Acontext API.
"""

from __future__ import annotations

import io
import json
from dataclasses import dataclass
from typing import Any, BinaryIO, Mapping, MutableMapping, Sequence

import httpx

from .errors import APIError, TransportError

DEFAULT_BASE_URL = "https://api.acontext.io/api/v1"
_SUPPORTED_ROLES = {"user", "assistant", "system", "tool", "function"}

try:  # pragma: no cover - metadata might be unavailable during development
    from importlib import metadata as _metadata

    _VERSION = _metadata.version("acontext-py")
except Exception:  # noqa: BLE001 - fall back gracefully
    _VERSION = "0.0.0"

_DEFAULT_USER_AGENT = f"acontext-py/{_VERSION}"


@dataclass(slots=True)
class FileUpload:
    """
    Represents a file payload for multipart requests.

    Accepts either a binary stream (any object exposing ``read``) or raw ``bytes``.
    """

    filename: str
    content: BinaryIO | bytes
    content_type: str | None = None

    def as_httpx(self) -> tuple[str, BinaryIO, str | None]:
        """
        Convert to the tuple format expected by ``httpx``.
        """
        if isinstance(self.content, (bytes, bytearray)):
            buffer = io.BytesIO(self.content)
            return self.filename, buffer, self.content_type or "application/octet-stream"
        return self.filename, self.content, self.content_type or "application/octet-stream"


@dataclass(slots=True)
class MessagePart:
    """
    Represents a single message part for ``/session/{id}/messages``.

    Args:
        type: One of ``text``, ``image``, ``audio``, ``video``, ``file``, ``tool-call``,
            ``tool-result`` or ``data``.
        text: Optional textual payload for ``text`` parts.
        meta: Optional metadata dictionary accepted by the API.
        file: Optional file attachment; required for binary part types.
        file_field: Optional field name to use in the multipart body. When omitted the
            client will auto-generate deterministic field names.
    """

    type: str
    text: str | None = None
    meta: Mapping[str, Any] | None = None
    file: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None] | None = None
    file_field: str | None = None

    @classmethod
    def text_part(cls, text: str, *, meta: Mapping[str, Any] | None = None) -> "MessagePart":
        return cls(type="text", text=text, meta=meta)

    @classmethod
    def file_part(
        cls,
        upload: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None],
        *,
        meta: Mapping[str, Any] | None = None,
        type: str = "file",
    ) -> "MessagePart":
        return cls(type=type, file=upload, meta=meta)


def _normalize_file_upload(
    upload: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None],
) -> FileUpload:
    if isinstance(upload, FileUpload):
        return upload
    if isinstance(upload, tuple):
        if len(upload) == 2:
            filename, content = upload
            return FileUpload(filename=filename, content=content)
        if len(upload) == 3:
            filename, content, content_type = upload
            return FileUpload(filename=filename, content=content, content_type=content_type)
    raise TypeError("Unsupported file upload payload")


def _normalize_message_part(part: MessagePart | str | Mapping[str, Any]) -> MessagePart:
    if isinstance(part, MessagePart):
        return part
    if isinstance(part, str):
        return MessagePart(type="text", text=part)
    if isinstance(part, Mapping):
        if "type" not in part:
            raise ValueError("mapping message parts must include a 'type'")
        file = part.get("file")
        normalized_file: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None] | None
        if file is None:
            normalized_file = None
        else:
            normalized_file = file  # type: ignore[assignment]
        return MessagePart(
            type=str(part["type"]),
            text=part.get("text"),
            meta=part.get("meta"),
            file=normalized_file,
            file_field=part.get("file_field"),
        )
    raise TypeError("unsupported message part type")


def _build_message_payload(
    parts: Sequence[MessagePart | str | Mapping[str, Any]],
) -> tuple[list[MutableMapping[str, Any]], dict[str, tuple[str, BinaryIO, str | None]]]:
    payload_parts: list[MutableMapping[str, Any]] = []
    files: dict[str, tuple[str, BinaryIO, str | None]] = {}

    for idx, raw_part in enumerate(parts):
        part = _normalize_message_part(raw_part)
        payload: MutableMapping[str, Any] = {"type": part.type}

        if part.meta is not None:
            payload["meta"] = dict(part.meta)
        if part.text is not None:
            payload["text"] = part.text

        if part.file is not None:
            upload = _normalize_file_upload(part.file)
            field_name = part.file_field or f"file_{idx}"
            payload["file_field"] = field_name
            files[field_name] = upload.as_httpx()

        payload_parts.append(payload)

    return payload_parts, files


class AcontextClient:
    """
    Synchronous HTTP client for the Acontext REST API.

    Example::

        from acontext import AcontextClient, MessagePart

        with AcontextClient(api_key="sk_...", project_id="...") as client:
            spaces = client.spaces.list()
            session = client.sessions.create(space_id=spaces[0]["id"])
            client.sessions.send_message(
                session["id"],
                role="user",
                parts=[MessagePart.text_part("Hello Acontext!")],
            )
    """

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float | httpx.Timeout | None = 10.0,
        user_agent: str | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        if not api_key:
            raise ValueError("api_key is required")

        base_url = base_url.rstrip("/")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "User-Agent": user_agent or _DEFAULT_USER_AGENT,
        }

        if client is not None:
            self._client = client
            self._owns_client = False
            if client.base_url == httpx.URL():
                client.base_url = httpx.URL(base_url)
            # Merge headers without clobbering user overrides.
            for name, value in headers.items():
                if name not in client.headers:
                    client.headers[name] = value
            self._base_url = str(client.base_url) or base_url
        else:
            self._client = httpx.Client(base_url=base_url, headers=headers, timeout=timeout)
            self._owns_client = True
            self._base_url = base_url

        self._timeout = timeout

        self.spaces = _SpacesAPI(self)
        self.sessions = _SessionsAPI(self)
        self.artifacts = _ArtifactsAPI(self)

    @property
    def base_url(self) -> str:
        return self._base_url

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "AcontextClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # noqa: D401 - standard context manager protocol
        self.close()

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        json_data: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
        data: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
        files: Mapping[str, tuple[str, BinaryIO, str | None]] | None = None,
        unwrap: bool = True,
    ) -> Any:
        try:
            response = self._client.request(
                method=method,
                url=path,
                params=params,
                json=json_data,
                data=data,
                files=files,
                timeout=self._timeout,
            )
        except httpx.HTTPError as exc:  # pragma: no cover - passthrough to caller
            raise TransportError(str(exc)) from exc

        return self._handle_response(response, unwrap=unwrap)

    @staticmethod
    def _handle_response(response: httpx.Response, *, unwrap: bool) -> Any:
        content_type = response.headers.get("content-type", "")

        parsed: Mapping[str, Any] | MutableMapping[str, Any] | None
        if "application/json" in content_type or content_type.startswith("application/problem+json"):
            try:
                parsed = response.json()
            except ValueError:
                parsed = None
        else:
            parsed = None

        if response.status_code >= 400:
            message = response.reason_phrase
            payload: Mapping[str, Any] | MutableMapping[str, Any] | None = parsed
            code: int | None = None
            error: str | None = None
            if payload and isinstance(payload, Mapping):
                message = str(payload.get("msg") or payload.get("message") or message)
                error = payload.get("error")
                try:
                    code_val = payload.get("code")
                    if isinstance(code_val, int):
                        code = code_val
                except Exception:  # pragma: no cover - defensive
                    code = None
            raise APIError(
                status_code=response.status_code,
                code=code,
                message=message,
                error=error,
                payload=payload,
            )

        if parsed is None:
            if unwrap:
                return response.text
            return {"code": response.status_code, "data": response.text, "msg": response.reason_phrase}

        if not isinstance(parsed, Mapping):
            if unwrap:
                return parsed
            return parsed

        app_code = parsed.get("code")
        if isinstance(app_code, int) and app_code >= 400:
            raise APIError(
                status_code=response.status_code,
                code=app_code,
                message=str(parsed.get("msg") or response.reason_phrase),
                error=parsed.get("error"),
                payload=parsed,
            )

        return parsed.get("data") if unwrap else parsed


class _SpacesAPI:
    def __init__(self, client: AcontextClient) -> None:
        self._client = client

    def list(self) -> Any:
        return self._client._request("GET", "/space")

    def create(self, *, configs: Mapping[str, Any] | MutableMapping[str, Any] | None = None) -> Any:
        payload: dict[str, Any] = {}
        if configs is not None:
            payload["configs"] = configs
        return self._client._request("POST", "/space", json_data=payload)

    def delete(self, space_id: str) -> None:
        self._client._request("DELETE", f"/space/{space_id}")

    def update_configs(
        self,
        space_id: str,
        *,
        configs: Mapping[str, Any] | MutableMapping[str, Any],
    ) -> None:
        payload = {"configs": configs}
        self._client._request("PUT", f"/space/{space_id}/configs", json_data=payload)

    def get_configs(self, space_id: str) -> Any:
        return self._client._request("GET", f"/space/{space_id}/configs")


class _SessionsAPI:
    def __init__(self, client: AcontextClient) -> None:
        self._client = client

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
        return self._client._request("GET", "/session", params=params or None)

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
        return self._client._request("POST", "/session", json_data=payload)

    def delete(self, session_id: str) -> None:
        self._client._request("DELETE", f"/session/{session_id}")

    def update_configs(
        self,
        session_id: str,
        *,
        configs: Mapping[str, Any] | MutableMapping[str, Any],
    ) -> None:
        payload = {"configs": configs}
        self._client._request("PUT", f"/session/{session_id}/configs", json_data=payload)

    def get_configs(self, session_id: str) -> Any:
        return self._client._request("GET", f"/session/{session_id}/configs")

    def connect_to_space(self, session_id: str, *, space_id: str) -> None:
        payload = {"space_id": space_id}
        self._client._request("POST", f"/session/{session_id}/connect_to_space", json_data=payload)

    def send_message(
        self,
        session_id: str,
        *,
        role: str,
        parts: Sequence[MessagePart | str | Mapping[str, Any]],
    ) -> Any:
        if role not in _SUPPORTED_ROLES:
            raise ValueError(f"role must be one of {_SUPPORTED_ROLES!r}")
        if not parts:
            raise ValueError("parts must contain at least one entry")

        payload_parts, files = _build_message_payload(parts)
        payload = {"role": role, "parts": payload_parts}

        if files:
            form_data = {"payload": json.dumps(payload)}
            return self._client._request(
                "POST",
                f"/session/{session_id}/messages",
                data=form_data,
                files=files,
            )

        return self._client._request(
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
    ) -> Any:
        params: dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if cursor is not None:
            params["cursor"] = cursor
        if with_asset_public_url is not None:
            params["with_asset_public_url"] = "true" if with_asset_public_url else "false"
        return self._client._request("GET", f"/session/{session_id}/messages", params=params or None)


class _ArtifactsAPI:
    def __init__(self, client: AcontextClient) -> None:
        self._client = client
        self.files = _ArtifactFilesAPI(client)

    def list(self) -> Any:
        return self._client._request("GET", "/artifact")

    def create(self) -> Any:
        return self._client._request("POST", "/artifact")

    def delete(self, artifact_id: str) -> None:
        self._client._request("DELETE", f"/artifact/{artifact_id}")


class _ArtifactFilesAPI:
    def __init__(self, client: AcontextClient) -> None:
        self._client = client

    def upload(
        self,
        artifact_id: str,
        *,
        file: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None],
        file_path: str | None = None,
        meta: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    ) -> Any:
        upload = _normalize_file_upload(file)
        files = {"file": upload.as_httpx()}
        form: dict[str, Any] = {}
        if file_path:
            form["file_path"] = file_path
        if meta is not None:
            form["meta"] = json.dumps(meta)
        return self._client._request(
            "POST",
            f"/artifact/{artifact_id}/file",
            data=form or None,
            files=files,
        )

    def update(
        self,
        artifact_id: str,
        *,
        file_path: str,
        file: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None],
    ) -> Any:
        upload = _normalize_file_upload(file)
        files = {"file": upload.as_httpx()}
        form = {"file_path": file_path}
        return self._client._request(
            "PUT",
            f"/artifact/{artifact_id}/file",
            data=form,
            files=files,
        )

    def delete(self, artifact_id: str, *, file_path: str) -> None:
        params = {"file_path": file_path}
        self._client._request("DELETE", f"/artifact/{artifact_id}/file", params=params)

    def get(
        self,
        artifact_id: str,
        *,
        file_path: str,
        with_public_url: bool | None = None,
        expire: int | None = None,
    ) -> Any:
        params: dict[str, Any] = {"file_path": file_path}
        if with_public_url is not None:
            params["with_public_url"] = "true" if with_public_url else "false"
        if expire is not None:
            params["expire"] = expire
        return self._client._request("GET", f"/artifact/{artifact_id}/file", params=params)

    def list(
        self,
        artifact_id: str,
        *,
        path: str | None = None,
    ) -> Any:
        params: dict[str, Any] = {}
        if path is not None:
            params["path"] = path
        return self._client._request("GET", f"/artifact/{artifact_id}/file/ls", params=params or None)
