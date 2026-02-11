import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from acontext_core.di import setup, cleanup
from acontext_core.infra.async_mq import start_mq
from acontext_core.env import LOG
from acontext_core.telemetry.otel import (
    setup_otel_tracing,
    instrument_fastapi,
    instrument_all_clients,
    shutdown_otel_tracing,
)
from acontext_core.telemetry.config import TelemetryConfig
from routers import session_router, sandbox_router, tool_router


# Filter to exclude /health endpoint from uvicorn access logs
# Uses record.args directly instead of parsing formatted message for efficiency
class _HealthCheckFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        """True if the record should be logged, False otherwise."""
        if not record.args:
            return True
        if len(record.args) != 5:
            return True
        endpoint: str = record.args[2]
        status_code: int = record.args[4]
        if not endpoint.startswith("/health"):
            return True
        if status_code != 200:
            return True
        return False


logging.getLogger("uvicorn.access").addFilter(_HealthCheckFilter())

# Setup OpenTelemetry tracing before app creation
# This ensures tracer provider is set up before instrumentation
telemetry_config = TelemetryConfig.from_env()
tracer_provider = None
if telemetry_config.enabled:
    try:
        tracer_provider = setup_otel_tracing(
            service_name=telemetry_config.service_name,
            otlp_endpoint=telemetry_config.otlp_endpoint,
            sample_ratio=telemetry_config.sample_ratio,
            service_version=telemetry_config.service_version,
        )
        # Instrument all clients (must be called before client creation)
        instrument_all_clients()
        LOG.info(
            f"OpenTelemetry tracing setup: endpoint={telemetry_config.otlp_endpoint}, "
            f"sample_ratio={telemetry_config.sample_ratio}"
        )
    except Exception as e:
        LOG.warning(
            f"Failed to setup OpenTelemetry tracing, continuing without tracing: {e}",
            exc_info=True,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await setup()

    # Run consumer in the background
    asyncio.create_task(start_mq())

    yield

    # Shutdown
    if tracer_provider:
        try:
            shutdown_otel_tracing()
            LOG.info("OpenTelemetry tracing shutdown")
        except Exception as e:
            LOG.warning(f"Failed to shutdown OpenTelemetry tracing: {e}", exc_info=True)

    await cleanup()


app = FastAPI(lifespan=lifespan)

# Include routers
app.include_router(session_router)
app.include_router(sandbox_router)
app.include_router(tool_router)

# Instrument FastAPI app after creation and route registration
# This is the recommended approach: instrument after app creation and route registration
# but before app startup. Routes are registered via decorators during module import,
# so by the time we reach here, all routes are already registered.
if tracer_provider:
    try:
        instrument_fastapi(app)
        LOG.info("FastAPI instrumentation enabled")
    except Exception as e:
        LOG.warning(
            f"Failed to instrument FastAPI, continuing without instrumentation: {e}",
            exc_info=True,
        )


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"msg": "ok"}
