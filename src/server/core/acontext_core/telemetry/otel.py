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
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy import event
from redis.asyncio import Redis


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
            resource=resource,
            sampler=TraceIdRatioBased(sample_ratio)
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
        CompositeHTTPPropagator([
            TraceContextTextMapPropagator(),
            W3CBaggagePropagator(),
        ])
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
        if hasattr(provider, 'shutdown'):
            provider.shutdown()
    except Exception:
        # Silently ignore shutdown errors to avoid affecting application shutdown
        pass


def instrument_fastapi(app):
    """Instrument FastAPI app with OpenTelemetry"""
    FastAPIInstrumentor.instrument_app(app)


def instrument_sqlalchemy(engine: AsyncEngine) -> None:
    """
    Instrument SQLAlchemy async engine with OpenTelemetry tracing.
    
    This adds tracing to all database operations including:
    - SQL queries (SELECT, INSERT, UPDATE, DELETE)
    - Transaction operations (COMMIT, ROLLBACK)
    - Connection pool operations
    
    Args:
        engine: The SQLAlchemy AsyncEngine to instrument
    """
    tracer = trace.get_tracer(__name__)
    
    # Get the sync engine for event listeners
    sync_engine = engine.sync_engine
    
    @event.listens_for(sync_engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """Start a span before executing a SQL statement"""
        # Create span - it will automatically be a child of the current span if one exists
        span = tracer.start_span(
            "db.query",
            kind=trace.SpanKind.CLIENT,
        )
        
        # Extract query type (SELECT, INSERT, UPDATE, DELETE, etc.)
        query_type = statement.strip().split()[0].upper() if statement.strip() else "UNKNOWN"
        
        span.set_attribute("db.system", "postgresql")
        span.set_attribute("db.statement", statement)
        span.set_attribute("db.operation", query_type)
        table_name = _extract_table_name(statement)
        if table_name:
            span.set_attribute("db.sql.table", table_name)
        
        # Store span in connection info for later use
        conn.info["otel_span"] = span
        return statement, parameters
    
    @event.listens_for(sync_engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """End the span after executing a SQL statement"""
        span = conn.info.get("otel_span")
        if span:
            # Add row count if available
            if hasattr(cursor, "rowcount") and cursor.rowcount is not None:
                span.set_attribute("db.rows_affected", cursor.rowcount)
            span.end()
            conn.info.pop("otel_span", None)
    
    @event.listens_for(sync_engine, "handle_error")
    def handle_error(exception_context):
        """Record errors in the span"""
        span = exception_context.connection.info.get("otel_span")
        if span:
            span.record_exception(exception_context.original_exception)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(exception_context.original_exception)))
            span.end()
            exception_context.connection.info.pop("otel_span", None)


def _extract_table_name(statement: str) -> Optional[str]:
    """
    Extract table name from SQL statement.
    
    This is a simple heuristic that works for most common SQL patterns.
    """
    statement_upper = statement.strip().upper()
    
    # Try to extract table name from common patterns
    keywords = ["FROM", "INTO", "UPDATE", "JOIN"]
    for keyword in keywords:
        if keyword in statement_upper:
            parts = statement_upper.split(keyword, 1)
            if len(parts) > 1:
                # Get the part after the keyword and extract first word
                after_keyword = parts[1].strip().split()[0]
                # Remove quotes and schema prefixes
                table_name = after_keyword.strip('"').split(".")[-1]
                return table_name.lower() if table_name else None
    
    return None


def instrument_redis(client: Redis) -> Redis:
    """
    Instrument Redis async client with OpenTelemetry tracing.
    
    This wraps Redis client's execute_command method to add tracing to all Redis operations including:
    - GET, SET, DELETE, EXISTS, etc.
    - List operations (LPUSH, RPUSH, LPOP, etc.)
    - Hash operations (HGET, HSET, etc.)
    - Set operations (SADD, SMEMBERS, etc.)
    - Sorted set operations (ZADD, ZRANGE, etc.)
    - Pub/Sub operations
    - Pipeline operations
    
    Args:
        client: The Redis async client to instrument
        
    Returns:
        The same Redis client instance with tracing enabled (modified in place)
    """
    tracer = trace.get_tracer(__name__)
    
    # Store the original execute_command method
    original_execute_command = client.execute_command
    
    async def traced_execute_command(*args, **kwargs):
        """Wrapped execute_command with OpenTelemetry tracing"""
        command = args[0] if args else "UNKNOWN"
        command_upper = command.upper() if isinstance(command, (str, bytes)) else str(command).upper()
        if isinstance(command_upper, bytes):
            command_upper = command_upper.decode('utf-8', errors='ignore')
        
        # Start span
        span = tracer.start_span(
            f"redis.{command_upper}",
            kind=trace.SpanKind.CLIENT,
        )
        
        try:
            span.set_attribute("db.system", "redis")
            span.set_attribute("db.operation", command_upper)
            
            # Add key if available (first argument after command)
            if len(args) > 1:
                key = args[1]
                if isinstance(key, (str, bytes)):
                    key_str = str(key) if isinstance(key, str) else key.decode('utf-8', errors='ignore')
                    span.set_attribute("db.redis.key", key_str)
            
            # Execute the command
            result = await original_execute_command(*args, **kwargs)
            
            # Add result metadata
            if isinstance(result, (list, tuple)):
                span.set_attribute("db.redis.result_size", len(result))
            elif result is not None:
                span.set_attribute("db.redis.has_result", True)
            
            span.set_status(trace.Status(trace.StatusCode.OK))
            return result
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise
        finally:
            span.end()
    
    # Replace the execute_command method
    client.execute_command = traced_execute_command
    
    return client


def create_mq_publish_span(exchange_name: str, routing_key: str) -> trace.Span:
    """
    Create a span for MQ message publishing.
    
    Args:
        exchange_name: Name of the exchange
        routing_key: Routing key for the message
        
    Returns:
        OpenTelemetry span for the publish operation
    """
    tracer = trace.get_tracer(__name__)
    span = tracer.start_span(
        "mq.publish",
        kind=trace.SpanKind.PRODUCER,
    )
    span.set_attribute("messaging.system", "rabbitmq")
    span.set_attribute("messaging.destination", exchange_name)
    span.set_attribute("messaging.destination_kind", "exchange")
    span.set_attribute("messaging.rabbitmq.routing_key", routing_key)
    return span


def create_mq_consume_span(queue_name: str, exchange_name: str, routing_key: str) -> trace.Span:
    """
    Create a span for MQ message consumption.
    
    Args:
        queue_name: Name of the queue
        exchange_name: Name of the exchange
        routing_key: Routing key
        
    Returns:
        OpenTelemetry span for the consume operation
    """
    tracer = trace.get_tracer(__name__)
    span = tracer.start_span(
        "mq.consume",
        kind=trace.SpanKind.CONSUMER,
    )
    span.set_attribute("messaging.system", "rabbitmq")
    span.set_attribute("messaging.destination", queue_name)
    span.set_attribute("messaging.destination_kind", "queue")
    span.set_attribute("messaging.rabbitmq.exchange", exchange_name)
    span.set_attribute("messaging.rabbitmq.routing_key", routing_key)
    return span


def create_mq_process_span(queue_name: str, message_id: Optional[str] = None) -> trace.Span:
    """
    Create a span for MQ message processing.
    
    Args:
        queue_name: Name of the queue
        message_id: Optional message ID
        
    Returns:
        OpenTelemetry span for the process operation
    """
    tracer = trace.get_tracer(__name__)
    span = tracer.start_span(
        "mq.process",
        kind=trace.SpanKind.CONSUMER,
    )
    span.set_attribute("messaging.system", "rabbitmq")
    span.set_attribute("messaging.destination", queue_name)
    span.set_attribute("messaging.destination_kind", "queue")
    if message_id:
        span.set_attribute("messaging.message_id", message_id)
    return span

