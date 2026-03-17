import os
import sys
import logging
import contextvars
import structlog

bound_logging_vars = structlog.contextvars.bound_contextvars

_wide_event_var: contextvars.ContextVar[dict | None] = contextvars.ContextVar(
    "wide_event", default=None
)


def set_wide_event(event: dict) -> None:
    _wide_event_var.set(event)


def get_wide_event() -> dict | None:
    """Returns the current wide event dict, or None if not in an MQ handler context."""
    return _wide_event_var.get()


def clear_wide_event() -> None:
    _wide_event_var.set(None)


def get_logging_contextvars():
    return structlog.contextvars.get_contextvars()


def inject_otel_trace_context(
    logger: logging.Logger, method_name: str, event_dict: dict
) -> dict:
    try:
        from opentelemetry import trace

        span = trace.get_current_span()
        if span is not None:
            ctx = span.get_span_context()
            if ctx is not None and ctx.trace_id != 0:
                event_dict["trace_id"] = format(ctx.trace_id, "032x")
                event_dict["span_id"] = format(ctx.span_id, "016x")
    except ImportError:
        pass
    except Exception:
        pass
    return event_dict


def _get_initial_values() -> dict:
    initial = {
        "service": os.environ.get("OTEL_SERVICE_NAME", "acontext-core"),
    }
    version = os.environ.get("OTEL_SERVICE_VERSION")
    if version:
        initial["version"] = version
    commit_hash = os.environ.get("COMMIT_HASH") or os.environ.get("GIT_COMMIT")
    if commit_hash:
        initial["commit_hash"] = commit_hash
    hostname = os.environ.get("HOSTNAME")
    if hostname:
        initial["hostname"] = hostname
    return initial


def __get_json_logger(level: int = logging.INFO) -> structlog.stdlib.BoundLogger:
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        inject_otel_trace_context,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.CallsiteParameterAdder(
            [
                structlog.processors.CallsiteParameter.LINENO,
                structlog.processors.CallsiteParameter.PATHNAME,
            ]
        ),
    ]

    structlog.configure(
        processors=shared_processors
        + [
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ],
    )
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    if not any(
        isinstance(h, logging.StreamHandler)
        and getattr(h, "formatter", None).__class__
        == structlog.stdlib.ProcessorFormatter
        for h in root.handlers
    ):
        root.addHandler(handler)

    return structlog.get_logger(**_get_initial_values())


def __get_text_logger(level: int = logging.INFO) -> structlog.stdlib.BoundLogger:
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        inject_otel_trace_context,
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    structlog.configure(
        processors=shared_processors
        + [
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.dev.ConsoleRenderer(),
        ],
    )
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root = logging.getLogger()
    if not any(
        isinstance(h, logging.StreamHandler)
        and getattr(h, "formatter", None).__class__
        == structlog.stdlib.ProcessorFormatter
        for h in root.handlers
    ):
        root.addHandler(handler)

    return structlog.get_logger(**_get_initial_values())


def get_logger(
    format: str = "json", level: str = "INFO"
) -> structlog.stdlib.BoundLogger:
    level_int = logging.getLevelName(level)
    if format == "json":
        LOG = __get_json_logger(level_int)
    else:
        LOG = __get_text_logger(level_int)
    logging.getLogger().setLevel(level_int)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    return LOG
