"""
Utility functions for OpenTelemetry tracing with consistent error handling.
"""
from functools import wraps
from typing import Callable, Any, Optional
from ..env import LOG


def safe_otel_operation(operation_name: str):
    """Decorator for safe OpenTelemetry operations with error handling
    
    This decorator ensures that OpenTelemetry operations don't cause
    the application to fail if tracing is misconfigured or unavailable.
    
    Args:
        operation_name: Name of the operation for logging purposes
    
    Example:
        @safe_otel_operation("instrumentation")
        def instrument_something():
            # ... instrumentation code
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Optional[Any]:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                LOG.warning(
                    f"OpenTelemetry {operation_name} failed, continuing without tracing: {e}",
                    exc_info=True
                )
                return None
        return wrapper
    return decorator


def safe_otel_operation_async(operation_name: str):
    """Decorator for safe async OpenTelemetry operations with error handling
    
    Args:
        operation_name: Name of the operation for logging purposes
    
    Example:
        @safe_otel_operation_async("setup")
        async def setup_tracing():
            # ... setup code
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Optional[Any]:
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                LOG.warning(
                    f"OpenTelemetry {operation_name} failed, continuing without tracing: {e}",
                    exc_info=True
                )
                return None
        return wrapper
    return decorator

