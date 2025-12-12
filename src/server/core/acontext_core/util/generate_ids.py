from typing import final
import uuid
from functools import wraps
from ..env import LOG
from ..telemetry.log import bound_logging_vars


def generate_temp_id() -> str:
    return uuid.uuid4().hex


def track_process(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        func_name = func.__name__
        use_id = generate_temp_id()
        with bound_logging_vars(temp_id=use_id, func_name=func_name):
            LOG.info(f"Enter {func_name}")
            try:
                return await func(*args, **kwargs)
            finally:
                LOG.info(f"Exit {func_name}")

    return wrapper
