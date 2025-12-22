from typing import Any, Dict, Optional

from pydantic import BaseModel


class CloudflareLifecycleInitResult(BaseModel):
    """Initialization result for the sandbox (data.init)."""

    exitCode: int
    stdout: str
    stderr: str


class CloudflareLifecycleData(BaseModel):
    """Payload in data for lifecycle-related endpoints (POST/DELETE /lifecycle)."""

    sandboxId: Optional[str] = None
    created: Optional[bool] = None
    initialized: Optional[bool] = None
    destroyed: Optional[bool] = None
    init: Optional[CloudflareLifecycleInitResult] = None
    options: Optional[Dict[str, Any]] = None


class CloudflareMeta(BaseModel):
    """Metadata returned by the Cloudflare Sandbox API."""

    sandboxId: str
    timestamp: str


class CloudflareError(BaseModel):
    """Error object returned when success is false."""

    code: str
    message: str
    context: Optional[Dict[str, Any]] = None


class CloudflareResponse(BaseModel):
    """
    Standard Cloudflare Sandbox API response envelope.

    Example:
        {
          "success": true,
          "data": {...},
          "error": {...},
          "meta": {...}
        }
    """

    success: bool
    data: Optional[CloudflareLifecycleData] = None
    error: Optional[CloudflareError] = None
    meta: Optional[CloudflareMeta] = None


