"""Utility functions for the acontext Python client."""

from typing import Any


def bool_to_str(value: bool) -> str:
    """Convert a boolean value to string representation used by the API.
    
    Args:
        value: The boolean value to convert.
        
    Returns:
        "true" if value is True, "false" otherwise.
    """
    return "true" if value else "false"


def build_params(**kwargs: Any) -> dict[str, Any]:
    """Build query parameters dictionary, filtering None values and converting booleans.
    
    This function filters out None values and converts boolean values to their
    string representations ("true" or "false") as expected by the API.
    
    Args:
        **kwargs: Keyword arguments to build parameters from.
        
    Returns:
        Dictionary with non-None parameters, with booleans converted to strings.
        
    Example:
        >>> build_params(limit=10, cursor=None, time_desc=True)
        {'limit': 10, 'time_desc': 'true'}
    """
    params: dict[str, Any] = {}
    for key, value in kwargs.items():
        if value is not None:
            if isinstance(value, bool):
                params[key] = bool_to_str(value)
            else:
                params[key] = value
    return params

