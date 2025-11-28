"""
OpenTelemetry configuration management for Python Core service.
"""
import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class TelemetryConfig:
    """OpenTelemetry configuration
    
    Attributes:
        enabled: Whether OpenTelemetry tracing is enabled
        otlp_endpoint: OTLP endpoint URL (e.g., "http://localhost:4317")
        sample_ratio: Sampling ratio (0.0-1.0), default 1.0 (100% sampling)
        service_name: Service name for tracing
        service_version: Service version for tracing
    """
    enabled: bool = True
    otlp_endpoint: Optional[str] = None
    sample_ratio: float = 1.0
    service_name: str = "acontext-core"
    service_version: str = "0.0.1"
    
    @classmethod
    def from_env(cls) -> "TelemetryConfig":
        """Load configuration from environment variables
        
        Environment variables:
            OTEL_EXPORTER_OTLP_ENDPOINT: OTLP endpoint URL (required for enabling)
            OTEL_ENABLED: Whether to enable tracing (default: true)
            OTEL_SAMPLE_RATIO: Sampling ratio 0.0-1.0 (default: 1.0)
            OTEL_SERVICE_NAME: Service name (default: "acontext-core")
            OTEL_SERVICE_VERSION: Service version (default: "0.0.1")
        
        Returns:
            TelemetryConfig instance
        """
        otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
        enabled_str = os.getenv("OTEL_ENABLED", "true").lower()
        enabled = enabled_str == "true" and otlp_endpoint is not None
        
        # Parse sample ratio with validation
        try:
            sample_ratio = float(os.getenv("OTEL_SAMPLE_RATIO", "1.0"))
            # Clamp to valid range
            if sample_ratio < 0.0:
                sample_ratio = 1.0
            elif sample_ratio > 1.0:
                sample_ratio = 1.0
        except (ValueError, TypeError):
            sample_ratio = 1.0
        
        service_name = os.getenv("OTEL_SERVICE_NAME", "acontext-core")
        service_version = os.getenv("OTEL_SERVICE_VERSION", "0.0.1")
        
        return cls(
            enabled=enabled,
            otlp_endpoint=otlp_endpoint,
            sample_ratio=sample_ratio,
            service_name=service_name,
            service_version=service_version,
        )

