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
    return logger


class ColoredFormatter(logging.Formatter):
    """Custom formatter that applies different colors based on log level."""

    LEVEL_COLORS = {
        logging.DEBUG: TerminalColorMarks.CYAN,
        logging.INFO: TerminalColorMarks.BLUE,
        logging.WARNING: TerminalColorMarks.YELLOW,
        logging.ERROR: TerminalColorMarks.RED,
        logging.CRITICAL: TerminalColorMarks.RED,
    }

    def format(self, record):
        color = self.LEVEL_COLORS.get(record.levelno, TerminalColorMarks.BLUE)
        levelname = f"{color}{record.levelname}{TerminalColorMarks.END}"

        original_levelname = record.levelname
        record.levelname = levelname
        formatted = super().format(record)
        record.levelname = original_levelname

        return formatted


def __get_text_logger():
    logger = logging.getLogger("acontext-core")

    formatter = ColoredFormatter("%(levelname)s - %(asctime)s - %(message)s")
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger


def get_logger(format: str = "text", level: str = "INFO") -> logging.Logger:
    if format == "json":
        LOG = __get_json_logger()
    else:
        LOG = __get_text_logger()
    LOG.setLevel(level)
    return LOG
