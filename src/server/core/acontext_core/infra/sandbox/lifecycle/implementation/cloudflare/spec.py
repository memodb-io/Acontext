from dataclasses import dataclass, field
from typing import Dict, Optional, Union

from ...base import SandboxSpecService
from ...models import SandboxBackend, SandboxSpecInfoBase


class CloudflareSandboxSpecInfo(SandboxSpecInfoBase):
    """Spec definition for Cloudflare Sandbox."""

    backend: SandboxBackend = SandboxBackend.CLOUDFLARE
    
    # SandboxOptions fields (supported by Cloudflare SDK)
    # Reference: https://developers.cloudflare.com/sandbox/configuration/sandbox-options/
    sleep_after: Optional[Union[str, int]] = None  # Duration string ("30s", "3m", "1h") or seconds. Default: "10m"
    keep_alive: Optional[bool] = None  # Keep container alive indefinitely. Default: false
    normalize_id: Optional[bool] = None  # Normalize sandbox ID to lowercase. Default: false
    # base_url: Optional[str] = None  # Base URL for the sandbox API (SDK supports but not documented)
    # container_timeouts: Dict with keys:
    #   - instanceGetTimeoutMS: default 30000 (30s)
    #   - portReadyTimeoutMS: default 90000 (90s)
    #   - waitIntervalMS: default 1000 (1s) - polling interval (SDK supports but not explicitly documented)
    container_timeouts: Optional[Dict[str, int]] = None


@dataclass
class CloudflareSandboxSpecService(SandboxSpecService):
    """In-memory Cloudflare spec service placeholder."""

    _specs: Dict[str, CloudflareSandboxSpecInfo] = field(
        default_factory=lambda: {
            # Default configuration - basic testing
            "cloudflare-default": CloudflareSandboxSpecInfo(
                id="cloudflare-default",
                normalize_id=True,
            ),
            # Long-running configuration - keep container alive
            "cloudflare-long-running": CloudflareSandboxSpecInfo(
                id="cloudflare-long-running",
                keep_alive=True,
                sleep_after="1h",
                #When keepAlive: true is set, sleepAfter is ignored and the sandbox never sleeps automatically.
                #("30s", "5m", "1h") or numbers (seconds).
                normalize_id=True,
            ),
            # Production configuration - full timeouts and settings
            "cloudflare-short-running": CloudflareSandboxSpecInfo(
                id="cloudflare-short-running",
                keep_alive=False,
                sleep_after="10m",
                normalize_id=True,
                container_timeouts={
                    "instanceGetTimeoutMS": 60000,#1 minute for provisioning
                    "portReadyTimeoutMS": 90000,
                    "waitIntervalMS": 1000,
                },
            ),
        }
    )

    async def get_sandbox_spec(self, spec_id: str) -> Optional[CloudflareSandboxSpecInfo]:
        return self._specs.get(spec_id)

    async def get_default_sandbox_spec(self) -> CloudflareSandboxSpecInfo:
        return self._specs["cloudflare-default"]

