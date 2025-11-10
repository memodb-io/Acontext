import os
import sys
import logging
import structlog
from ..util.terminal_color import TerminalColorMarks

bound_logging_vars = structlog.contextvars.bound_contextvars


def get_logging_contextvars():
    return structlog.contextvars.get_contextvars()


def __get_json_logger():
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.stdlib.ExtraAdder(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.CallsiteParameterAdder(
            [
                structlog.processors.CallsiteParameter.LINENO,
                structlog.processors.CallsiteParameter.PATHNAME,
            ]
        ),
    ]

    structlog_processors = shared_processors + [
        structlog.processors.dict_tracebacks,
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ]

    structlog.configure(
        processors=structlog_processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
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

    logger = logging.getLogger("acontext-core")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


class CustomTextFormatter(logging.Formatter):
    """Custom formatter that supports extra fields for text logging"""

    def format(self, record):
        # First, format the standard message
        base_msg = super().format(record)

        # Check if there are extra fields (beyond the standard ones)
        printout_attrs = {"traceback", "session_id", "message_id"}

        all_fields = record.__dict__
        extra_fields = []
        for attr in printout_attrs:
            if attr in all_fields:
                extra_fields.append(f"{attr}={all_fields[attr]}")

        # If there are extra fields, append them to the message
        if extra_fields:
            extra_text = "\n- " + "\n- ".join(extra_fields)
            return base_msg + extra_text
        return base_msg


def __get_text_logger():
    logger = logging.getLogger("acontext-core")
    logger.setLevel(logging.INFO)

    formatter = CustomTextFormatter(
        f"{TerminalColorMarks.BOLD}{TerminalColorMarks.BLUE}|{TerminalColorMarks.END} %(asctime)s - %(levelname)s - %(message)s"
    )
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger


def get_logger(format="text") -> logging.Logger:
    if format == "json":
        LOG = __get_json_logger()
    else:
        LOG = __get_text_logger()
    return LOG
