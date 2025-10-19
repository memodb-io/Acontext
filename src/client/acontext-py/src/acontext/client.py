"""
High-level synchronous client for the Acontext API.
"""

from typing import Any, BinaryIO, Mapping, MutableMapping

import httpx

from ._constants import DEFAULT_BASE_URL, DEFAULT_USER_AGENT
from .errors import APIError, TransportError
from .messages import MessagePart as MessagePart
from .uploads import FileUpload as FileUpload
from .resources.artifacts import ArtifactsAPI as ArtifactsAPI
from .resources.blocks import BlocksAPI as BlocksAPI
from .resources.pages import PagesAPI as PagesAPI
from .resources.folders import FoldersAPI as FoldersAPI
from .resources.sessions import SessionsAPI as SessionsAPI
from .resources.spaces import SpacesAPI as SpacesAPI

class AcontextClient:
    """
    Synchronous HTTP client for the Acontext REST API.

    Example::

        from acontext import AcontextClient, MessagePart

        with AcontextClient(api_key="sk_...") as client:
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
            "User-Agent": user_agent or DEFAULT_USER_AGENT,
        }

        if client is not None:
            self._client = client
            self._owns_client = False
            if client.base_url == httpx.URL():
                client.base_url = httpx.URL(base_url)
            for name, value in headers.items():
                if name not in client.headers:
                    client.headers[name] = value
            self._base_url = str(client.base_url) or base_url
        else:
            self._client = httpx.Client(base_url=base_url, headers=headers, timeout=timeout)
            self._owns_client = True
            self._base_url = base_url

        self._timeout = timeout

        self.spaces = SpacesAPI(self)
        self.sessions = SessionsAPI(self)
        self.artifacts = ArtifactsAPI(self)
        self.pages = PagesAPI(self)
        self.blocks = BlocksAPI(self)
        self.folders = FoldersAPI(self)

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

    # ------------------------------------------------------------------
    # HTTP plumbing shared by resource clients
    # ------------------------------------------------------------------
    def request(
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
