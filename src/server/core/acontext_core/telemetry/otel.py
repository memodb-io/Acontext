"""OpenTelemetry tracing setup using official instrumentors."""

from typing import Optional

from opentelemetry import trace, propagate
from opentelemetry.propagators.composite import CompositePropagator
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from opentelemetry.baggage.propagation import W3CBaggagePropagator
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource


def setup_otel_tracing(
    service_name: str = "acontext-core",
    otlp_endpoint: Optional[str] = None,
    sample_ratio: float = 1.0,
    service_version: str = "0.0.1",
) -> Optional[TracerProvider]:
    """Setup OpenTelemetry tracing for Python Core

    Args:
        service_name: Service name for tracing
        otlp_endpoint: OTLP endpoint URL (e.g., "http://localhost:4317")
        sample_ratio: Sampling ratio (0.0-1.0), default 1.0 (100% sampling)
        service_version: Service version for tracing

    Returns:
        TracerProvider instance if tracing is enabled, None otherwise
    """
    if not otlp_endpoint:
        return None

    # Validate and clamp sample_ratio
    if sample_ratio <= 0:
        sample_ratio = 1.0
    if sample_ratio > 1.0:
        sample_ratio = 1.0

    resource = Resource.create(
        {
            "service.name": service_name,
            "service.version": service_version,
        }
    )

    # Configure sampling
    if sample_ratio >= 1.0:
        # 100% sampling - use default (AlwaysOn sampler)
        provider = TracerProvider(resource=resource)
    else:
        # Ratio-based sampling
        provider = TracerProvider(
            resource=resource, sampler=TraceIdRatioBased(sample_ratio)
        )

    otlp_exporter = OTLPSpanExporter(
        endpoint=otlp_endpoint,
        insecure=True,
    )
    provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

    trace.set_tracer_provider(provider)

    # Set global propagator for trace context extraction (important for cross-service tracing)
    # This ensures FastAPIInstrumentor can extract traceparent header from incoming requests
    # The propagator extracts trace context from HTTP headers (traceparent, tracestate)
    propagate.set_global_textmap(
        CompositePropagator(
            [
                TraceContextTextMapPropagator(),
                W3CBaggagePropagator(),
            ]
        )
    )

    return provider


def shutdown_otel_tracing() -> None:
    """Shutdown OpenTelemetry tracing gracefully

    This should be called during application shutdown to ensure
    all spans are properly exported before the application exits.

    This function is safe to call even if tracing was not initialized
    or if shutdown has already been called.
    """
    try:
        provider = trace.get_tracer_provider()
        if hasattr(provider, "shutdown"):
            provider.shutdown()
    except Exception:
        # Silently ignore shutdown errors to avoid affecting application shutdown
        pass


def instrument_fastapi(app):
    """Instrument FastAPI app with OpenTelemetry"""
    FastAPIInstrumentor.instrument_app(app, excluded_urls="/health")


def instrument_all_clients() -> None:
    """
    Instrument all supported clients using official OpenTelemetry instrumentors.
    
    Should be called once at application startup before creating client instances.
    """
    from ..env import LOG

    # Instrument OpenAI SDK (covers both chat completions and embeddings)
    # Package: opentelemetry-instrumentation-openai-v2
    try:
        from opentelemetry.instrumentation.openai_v2 import OpenAIInstrumentor

        OpenAIInstrumentor().instrument()
        LOG.info("OpenAI instrumentation enabled")
    except ImportError as e:
        LOG.debug(f"OpenAI instrumentation not available: {e}")
    except Exception as e:
        LOG.warning(f"Failed to instrument OpenAI: {e}")

    # Instrument Anthropic SDK
    try:
        from opentelemetry.instrumentation.anthropic import AnthropicInstrumentor

        AnthropicInstrumentor().instrument()
        LOG.info("Anthropic instrumentation enabled")
    except ImportError as e:
        LOG.debug(f"Anthropic instrumentation not available: {e}")
    except Exception as e:
        LOG.warning(f"Failed to instrument Anthropic: {e}")

    # Note: SQLAlchemy instrumentation is handled per-engine in db.py
    # because async engines require explicit instrumentation with engine.sync_engine

    # Instrument Redis
    try:
        from opentelemetry.instrumentation.redis import RedisInstrumentor

        RedisInstrumentor().instrument()
        LOG.info("Redis instrumentation enabled")
    except ImportError as e:
        LOG.debug(f"Redis instrumentation not available: {e}")
    except Exception as e:
        LOG.warning(f"Failed to instrument Redis: {e}")

    # Instrument httpx (for external API calls like Jina, LMStudio, etc.)
    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

        HTTPXClientInstrumentor().instrument()
        LOG.info("httpx instrumentation enabled")
    except ImportError as e:
        LOG.debug(f"httpx instrumentation not available: {e}")
    except Exception as e:
        LOG.warning(f"Failed to instrument httpx: {e}")

    # Instrument aiobotocore (S3, etc.)
    try:
        from aiobotocore_otel import AioBotocoreInstrumentor

        AioBotocoreInstrumentor().instrument()
        LOG.info("aiobotocore (S3) instrumentation enabled")
    except ImportError as e:
        LOG.debug(f"aiobotocore instrumentation not available: {e}")
    except Exception as e:
        LOG.warning(f"Failed to instrument aiobotocore: {e}")

    # Note: aio-pika (RabbitMQ) uses manual spans in async_mq.py for better control


# Legacy alias for backward compatibility
instrument_llm_clients = instrument_all_clients
