import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional

import httpx

from ...base import SandboxService, SandboxSpecService
from ...models import SandboxBackend, SandboxInfo, SandboxPage, SandboxStatus
from .models import CloudflareResponse
from .spec import CloudflareSandboxSpecInfo


@dataclass
class CloudflareSandboxService(SandboxService):

    spec_service: SandboxSpecService
    api_base: str = os.getenv("cloudflare_base_url","http://localhost:8787")#
    user_id: Optional[str] = None
    http_client: Optional[httpx.AsyncClient] = field(default=None, init=False)


    def _require_httpx(self) -> None:
        """Ensure httpx is available."""
        if httpx is None:
            raise RuntimeError(
                "httpx is required for CloudflareSandboxService. "
                "Install it with: pip install httpx"
            )

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        self._require_httpx()
        if self.http_client is None:
            self.http_client = httpx.AsyncClient(timeout=30.0)
        return self.http_client

    async def aclose(self) -> None:
        """
        Close underlying HTTP client and release resources.

        This should be called when the service is being shut down,
        e.g. from an application shutdown hook.
        """
        if self.http_client is not None:
            await self.http_client.aclose()
            self.http_client = None

    async def _make_request(
        self,
        method: str,
        path: str,
        sandbox_id: str,
        json_data: Optional[Dict] = None,
    ) -> Dict:
        """
        Make HTTP request to Cloudflare Sandbox API.
        
        Args:
            method: HTTP method (e.g., 'GET', 'POST', 'DELETE')
            path: API endpoint path (e.g., '/lifecycle')
            sandbox_id: Unique identifier for the sandbox instance
            json_data: Optional JSON payload to send in the request body
            
        Returns:
            Dict: Parsed JSON response from the API
            
        Raises:
            httpx.HTTPStatusError: If the HTTP request returns an error status code
        """
        # Get or create HTTP client instance
        client = await self._get_client()
        
        # Construct full URL by combining base URL and path
        # Remove trailing slash from base URL and leading slash from path to avoid double slashes
        url = f"{self.api_base.rstrip('/')}/{path.lstrip('/')}"
        
        # Prepare request headers
        # x-sandbox-id header is required by Cloudflare API to identify the sandbox
        # Content-Type header indicates JSON payload
        headers = {
            "x-sandbox-id": sandbox_id,
            "Content-Type": "application/json",
        }

        # Send HTTP request with specified method, URL, headers, and JSON data
        response = await client.request(
            method=method,
            url=url,
            headers=headers,
            json=json_data,
        )
        
        # Raise exception if HTTP status code indicates an error (4xx, 5xx)
        response.raise_for_status()
        
        # Parse and return JSON response body
        return response.json()

    async def search_sandboxes(
        self, page_id: Optional[str] = None, limit: int = 100
    ) -> SandboxPage:
        """Search sandboxes - P2: returns empty list (not supported by API)."""
        _ = (page_id, limit)
        # Cloudflare API doesn't support listing sandboxes
        return SandboxPage(items=[], next_page_id=None)

    async def get_sandbox(self, sandbox_id: str) -> Optional[SandboxInfo]:
        """Get a single sandbox - P1: returns None (API doesn't support query)."""
        _ = sandbox_id
        # Cloudflare API doesn't support querying a single sandbox
        return None

    async def get_sandbox_by_session_api_key(
        self, session_api_key: str
    ) -> Optional[SandboxInfo]:
        """Lookup sandbox by session API key - not supported."""
        _ = session_api_key
        # Cloudflare API doesn't support lookup by session key
        return None

    async def start_sandbox(self, sandbox_spec_id: Optional[str] = None) -> SandboxInfo:
        """Start a new sandbox - P0: calls POST /lifecycle API."""
        spec = None
        if sandbox_spec_id:
            spec = await self.spec_service.get_sandbox_spec(sandbox_spec_id)
        if not spec:
            spec = await self.spec_service.get_default_sandbox_spec()
        if not isinstance(spec, CloudflareSandboxSpecInfo):
            raise TypeError(f"Expected CloudflareSandboxSpecInfo, got {type(spec).__name__}")

        # Generate sandbox ID and session API key
        sandbox_id = f"cf-sandbox-{uuid.uuid4().hex[:16]}"
        session_api_key = str(uuid.uuid4())#TODO: currently no use

        # Build request payload
        # Only SandboxOptions fields are supported by the API:
        # - sleepAfter, baseUrl, keepAlive, normalizeId, containerTimeouts
        options: Dict = {}
        
        if spec.sleep_after is not None:
            options["sleepAfter"] = spec.sleep_after
        if spec.keep_alive is not None:
            options["keepAlive"] = spec.keep_alive
        if spec.normalize_id is not None:
            options["normalizeId"] = spec.normalize_id
        # if spec.base_url:
        #     options["baseUrl"] = spec.base_url
        if spec.container_timeouts:
            options["containerTimeouts"] = spec.container_timeouts

        payload = {"options": options}

        try:
            response_json = await self._make_request(
                method="POST",
                path="/lifecycle",
                sandbox_id=sandbox_id,
                json_data=payload,
            )

            # 用 Pydantic 进行结构化解析，较直观且有类型检查
            cf_resp = CloudflareResponse.model_validate(response_json)

            if not cf_resp.success:
                error_msg = (
                    cf_resp.error.message
                    if cf_resp.error and cf_resp.error.message
                    else "Unknown error"
                )
                raise RuntimeError(f"Failed to start Cloudflare sandbox: {error_msg}")

            data = cf_resp.data
            created = bool(data and data.created)# mean get the sandbox instance
            initialized = bool(data and data.initialized)# mean run sandbox.exec

            if not created or not initialized:
                raise RuntimeError(
                    f"Sandbox created but not initialized: created={created}, initialized={initialized}"
                )

            # Build SandboxInfo
            sandbox_info = SandboxInfo(
                id=cf_resp.sandbox_id,
                created_by_user_id=self.user_id,
                sandbox_spec_id=spec.id,
                backend=SandboxBackend.CLOUDFLARE,
                status=SandboxStatus.RUNNING,
                session_api_key=session_api_key,
                exposed_urls=None,  # Cloudflare sandboxes don't expose URLs in the same way
                created_at=datetime.utcnow(),
            )

            # Prefer the sandboxId returned by Cloudflare (if present),
            # but fall back to our generated sandbox_id.
            cf_sandbox_id = data.sandboxId # shall be same as sandbox_id
            init_exit_code = data.init.exitCode

            print(
                f"Cloudflare sandbox started: "
                f"sandbox_id={cf_sandbox_id}, "
                f"spec_id={spec.id}, "
                f"created={created}, initialized={initialized}, "
                f"init_exit_code={init_exit_code}"
            )
            return sandbox_info

        except Exception as e:
            if httpx and isinstance(e, httpx.HTTPStatusError):
                error_msg = "Unknown error"
                try:
                    error_data = e.response.json()
                    error = error_data.get("error", {})
                    error_msg = error.get("message", str(e))
                except Exception:
                    error_msg = str(e)
                raise RuntimeError(f"Failed to start Cloudflare sandbox: {error_msg}") from e
            raise RuntimeError(f"Failed to start Cloudflare sandbox: {e}") from e

    async def pause_sandbox(self, sandbox_id: str) -> bool:
        """Pause a sandbox - P2: returns False (not supported)."""
        _ = sandbox_id
        # Cloudflare API doesn't support pause/resume
        return False

    async def resume_sandbox(self, sandbox_id: str) -> bool:
        """Resume a sandbox - P2: returns False (not supported)."""
        _ = sandbox_id
        # Cloudflare API doesn't support pause/resume
        return False

    async def delete_sandbox(self, sandbox_id: str) -> bool:
        """Delete a sandbox - P0: calls DELETE /lifecycle API."""
        try:
            response_data = await self._make_request(
                method="DELETE",
                path="/lifecycle",
                sandbox_id=sandbox_id,
            )

            # Parse response using shared CloudflareResponse model
            cf_resp = CloudflareResponse.model_validate(response_data)

            if not cf_resp.success:
                error = cf_resp.error
                error_code = error.code if error else ""
                # If sandbox not found, consider it already deleted
                if error_code == "NOT_FOUND":
                    print(
                        f"Cloudflare sandbox {sandbox_id} already deleted "
                        f"(code={error_code})"
                    )
                    return True
                error_msg = error.message if error and error.message else "Unknown error"
                raise RuntimeError(f"Failed to delete Cloudflare sandbox: {error_msg}")

            data = cf_resp.data
            destroyed = bool(data and data.destroyed)

            cf_sandbox_id = cf_resp.data

            if destroyed:
                print(
                    f"Cloudflare sandbox deleted: sandbox_id={cf_sandbox_id}, "
                    f"destroyed={destroyed}"
                )
                return True
            else:
                print(
                    f"Cloudflare sandbox deletion returned false: "
                    f"sandbox_id={cf_sandbox_id}, destroyed={destroyed}"
                )
                return False

        except Exception as e:
            if httpx and isinstance(e, httpx.HTTPStatusError):
                # If 404, sandbox doesn't exist (already deleted)
                if e.response.status_code == 404:
                    print(f"Cloudflare sandbox {sandbox_id} not found (already deleted)")
                    return True
                error_msg = "Unknown error"
                try:
                    error_data = e.response.json()
                    error = error_data.get("error", {})
                    error_msg = error.get("message", str(e))
                except Exception:
                    error_msg = str(e)
                print(f"Failed to delete Cloudflare sandbox {sandbox_id}: {error_msg}")
                return False
            print(f"Failed to delete Cloudflare sandbox {sandbox_id}: {e}")
            return False
        

