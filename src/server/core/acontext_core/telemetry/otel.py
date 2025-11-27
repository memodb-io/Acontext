"""
OpenTelemetry tracing setup for Python Core service.
"""
import os
from typing import Optional

from opentelemetry import trace, propagate
from opentelemetry.propagators.composite import CompositeHTTPPropagator
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from opentelemetry.baggage.propagation import W3CBaggagePropagator
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource


def setup_otel_tracing(
    service_name: str = "acontext-core", otlp_endpoint: Optional[str] = None
) -> Optional[TracerProvider]:
    """Setup OpenTelemetry tracing for Python Core"""
    if not otlp_endpoint:
        return None

    resource = Resource.create(
        {
            "service.name": service_name,
            "service.version": "0.0.1",
        }
    )

    provider = TracerProvider(resource=resource)

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
        CompositeHTTPPropagator([
            TraceContextTextMapPropagator(),
            W3CBaggagePropagator(),
        ])
    )

    return provider


def instrument_fastapi(app):
    """Instrument FastAPI app with OpenTelemetry"""
    FastAPIInstrumentor.instrument_app(app)

