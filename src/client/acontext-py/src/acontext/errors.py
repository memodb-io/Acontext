"""
Custom exceptions raised by the acontext Python client.
"""

from collections.abc import Mapping
from typing import Any


class AcontextError(Exception):
    """Base exception for all errors raised by ``acontext``."""


class APIError(AcontextError):
    """
    Raised when the server returns an error response.

    Attributes:
        status_code: HTTP status code returned by the server.
        code: Optional application-level error code from the payload.
        message: Human readable message if provided by the server.
        error: Raw error field from the payload in non-release environments.
        payload: The full parsed JSON payload.
    """

    def __init__(
        self,
        *,
        status_code: int,
        code: int | None = None,
        message: str | None = None,
        error: str | None = None,
        payload: Mapping[str, Any] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.error = error
        self.payload = payload
        details = message or error or "API request failed"
        super().__init__(f"{status_code}: {details}")


class TransportError(AcontextError):
    """Raised when the underlying HTTP transport failed before receiving a response."""


class TimeoutError(AcontextError):
    """Raised when a polling operation exceeds the configured timeout."""

    def __init__(self, message: str = "operation timed out") -> None:
        self.message = message
        super().__init__(message)
