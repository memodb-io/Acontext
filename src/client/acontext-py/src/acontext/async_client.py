"""
High-level asynchronous client for the Acontext API.
"""

import os
from collections.abc import Mapping
from typing import Any, BinaryIO

import httpx

from ._constants import DEFAULT_BASE_URL, DEFAULT_USER_AGENT
from .errors import APIError, TransportError
from .messages import MessagePart as MessagePart
from .uploads import FileUpload as FileUpload
from .resources.async_disks import AsyncDisksAPI as AsyncDisksAPI
from .resources.async_blocks import AsyncBlocksAPI as AsyncBlocksAPI
from .resources.async_sandboxes import AsyncSandboxesAPI as AsyncSandboxesAPI
from .resources.async_sessions import AsyncSessionsAPI as AsyncSessionsAPI
from .resources.async_spaces import AsyncSpacesAPI as AsyncSpacesAPI
from .resources.async_tools import AsyncToolsAPI as AsyncToolsAPI
from .resources.async_skills import AsyncSkillsAPI as AsyncSkillsAPI
from .resources.async_users import AsyncUsersAPI as AsyncUsersAPI


class AcontextAsyncClient:

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: float | httpx.Timeout | None = 32.0,
        user_agent: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        """
        Initialize the Acontext async client.

        Args:
            api_key: API key for authentication. Can also be set via ACONTEXT_API_KEY env var.
            base_url: Base URL for the API. Defaults to DEFAULT_BASE_URL. Can also be set via ACONTEXT_BASE_URL env var.
            timeout: Request timeout in seconds. Defaults to 10.0. Can also be set via ACONTEXT_TIMEOUT env var.
                   Can also be an httpx.Timeout object.
            user_agent: Custom user agent string. Can also be set via ACONTEXT_USER_AGENT env var.
            client: Optional httpx.AsyncClient instance to reuse. If provided, headers and base_url
                   will be merged with the client configuration.
        """
        # Priority: explicit parameters > environment variables > defaults
        # Load api_key from parameter or environment variable
        api_key = api_key or os.getenv("ACONTEXT_API_KEY")
        if not api_key or not api_key.strip():
            raise ValueError(
                "api_key is required. Provide it either as a parameter (api_key='...') "
                "or set the ACONTEXT_API_KEY environment variable."
            )

        # Load other parameters from environment variables if not provided
        if base_url is None:
            base_url = os.getenv("ACONTEXT_BASE_URL", DEFAULT_BASE_URL)
        base_url = base_url.rstrip("/")

        if user_agent is None:
            user_agent = os.getenv("ACONTEXT_USER_AGENT", DEFAULT_USER_AGENT)

        # Handle timeout: support both float and httpx.Timeout
        if timeout is None:
            timeout_str = os.getenv("ACONTEXT_TIMEOUT")
            if timeout_str:
                try:
                    timeout = float(timeout_str)
                except ValueError:
                    timeout = 10.0
            else:
                timeout = 10.0

        # Determine actual timeout value
        actual_timeout: float | httpx.Timeout
        if isinstance(timeout, httpx.Timeout):
            actual_timeout = timeout
        else:
            actual_timeout = float(timeout)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "User-Agent": user_agent,
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
            self._client = httpx.AsyncClient(
                base_url=base_url,
                headers=headers,
                timeout=actual_timeout,
            )
            self._owns_client = True
            self._base_url = base_url

        self._timeout = actual_timeout

        self.spaces = AsyncSpacesAPI(self)
        self.sessions = AsyncSessionsAPI(self)
        self.disks = AsyncDisksAPI(self)
        self.artifacts = self.disks.artifacts
        self.blocks = AsyncBlocksAPI(self)
        self.tools = AsyncToolsAPI(self)
        self.skills = AsyncSkillsAPI(self)
        self.users = AsyncUsersAPI(self)
        self.sandboxes = AsyncSandboxesAPI(self)

    @property
    def base_url(self) -> str:
        return self._base_url

    async def ping(self) -> str:
        """
        Ping the API server to check connectivity.

        Returns:
            str: "pong" if the server is reachable and responding.

        Raises:
            APIError: If the server returns an error response.
            TransportError: If there's a network connectivity issue.
        """
        response = await self.request("GET", "/ping", unwrap=False)
        return response.get("msg", "pong")

    async def aclose(self) -> None:
        """Close the async client."""
        if self._owns_client:
            await self._client.aclose()

    async def __aenter__(self) -> "AcontextAsyncClient":
        return self

    async def __aexit__(
        self, exc_type, exc, tb
    ) -> None:  # noqa: D401 - standard context manager protocol
        await self.aclose()

    # ------------------------------------------------------------------
    # HTTP plumbing shared by resource clients
    # ------------------------------------------------------------------
    async def request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        json_data: Mapping[str, Any] | None = None,
        data: Mapping[str, Any] | None = None,
        files: Mapping[str, tuple[str, BinaryIO, str | None]] | None = None,
        unwrap: bool = True,
        timeout: float | None = None,
    ) -> Any:
        # Use per-request timeout if provided, otherwise use client default
        effective_timeout = timeout if timeout is not None else self._timeout
        try:
            response = await self._client.request(
                method=method,
                url=path,
                params=params,
                json=json_data,
                data=data,
                files=files,
                timeout=effective_timeout,
            )
        except httpx.HTTPError as exc:  # pragma: no cover - passthrough to caller
            raise TransportError(str(exc)) from exc

        return self._handle_response(response, unwrap=unwrap)

    @staticmethod
    def _handle_response(response: httpx.Response, *, unwrap: bool) -> Any:
        content_type = response.headers.get("content-type", "")

        parsed: Mapping[str, Any] | None = None
        if "application/json" in content_type:
            try:
                parsed = response.json()
            except ValueError:
                parsed = None
        else:
            parsed = None

        if response.status_code >= 400:
            message = response.reason_phrase
            payload: Mapping[str, Any] | None = parsed
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
            return {
                "code": response.status_code,
                "data": response.text,
                "msg": response.reason_phrase,
            }

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
