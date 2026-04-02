"""Utility functions for the acontext Python client."""

from typing import Any, Iterable, Mapping


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


def validate_edit_strategies(edit_strategies: Iterable[dict[str, Any]]) -> None:
    """Validate edit strategies before sending to the API."""
    for strategy in edit_strategies:
        if not isinstance(strategy, dict):
            continue
        if strategy.get("type") not in {"remove_tool_result", "remove_tool_call_params"}:
            continue
        params = strategy.get("params")
        if not isinstance(params, dict):
            continue
        if "gt_token" not in params:
            continue
        gt_token = params["gt_token"]
        if isinstance(gt_token, bool) or not isinstance(gt_token, int):
            raise ValueError("gt_token must be an integer >= 1")
        if gt_token < 1:
            raise ValueError("gt_token must be >= 1")


def validate_editing_trigger(editing_trigger: Mapping[str, Any]) -> None:
    """Validate editing trigger before sending to the API."""
    if len(editing_trigger) == 0:
        raise ValueError("editing_trigger must include at least one supported field")

    # Keep the SDK strict so unsupported trigger names fail locally with a
    # clearer error instead of making a round trip to the API first.
    allowed_keys = {"token_gte"}
    unknown_keys = set(editing_trigger.keys()) - allowed_keys
    if unknown_keys:
        unknown = ", ".join(sorted(unknown_keys))
        raise ValueError(f"unsupported editing_trigger field(s): {unknown}")

    if "token_gte" in editing_trigger:
        token_gte = editing_trigger["token_gte"]
        if isinstance(token_gte, bool) or not isinstance(token_gte, int):
            raise ValueError("token_gte must be an integer > 0")
        if token_gte <= 0:
            raise ValueError("token_gte must be > 0")
