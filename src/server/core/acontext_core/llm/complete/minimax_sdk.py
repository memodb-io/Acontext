import json
from typing import Optional
from .clients import get_minimax_async_client_instance
from openai.types.chat import ChatCompletion
from openai.types.chat import ChatCompletionMessageToolCall
from time import perf_counter
from ...env import LOG, DEFAULT_CORE_CONFIG
from ...schema.llm import LLMResponse
from ...telemetry.log import get_wide_event


def convert_openai_tool_to_llm_tool(tool_body: ChatCompletionMessageToolCall) -> dict:
    return {
        "id": tool_body.id,
        "type": tool_body.type,
        "function": {
            "name": tool_body.function.name,
            "arguments": json.loads(tool_body.function.arguments),
        },
    }


def _clamp_temperature(kwargs: dict) -> dict:
    """MiniMax requires temperature in (0.0, 1.0]. Clamp accordingly."""
    if "temperature" in kwargs:
        t = kwargs["temperature"]
        if t <= 0:
            kwargs["temperature"] = 0.01
        elif t > 1:
            kwargs["temperature"] = 1.0
    return kwargs


def _strip_think_tags(content: str) -> str:
    """Strip <think>...</think> tags from MiniMax reasoning model responses."""
    import re
    return re.sub(r"<think>[\s\S]*?</think>\s*", "", content)


async def minimax_complete(
    prompt=None,
    model=None,
    system_prompt=None,
    history_messages=[],
    json_mode=False,
    max_tokens=1024,
    prompt_kwargs: Optional[dict] = None,
    tools=None,
    **kwargs,
) -> LLMResponse:
    prompt_kwargs = prompt_kwargs or {}
    prompt_id = prompt_kwargs.get("prompt_id", "...")

    minimax_async_client = get_minimax_async_client_instance()

    kwargs = _clamp_temperature(kwargs)

    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.extend(history_messages)
    if prompt:
        messages.append({"role": "user", "content": prompt})

    if not messages:
        raise ValueError("No messages provided")

    _start_s = perf_counter()
    response: ChatCompletion = await minimax_async_client.chat.completions.create(
        model=model,
        messages=messages,
        timeout=DEFAULT_CORE_CONFIG.llm_response_timeout,
        max_tokens=max_tokens,
        tools=tools,
        **kwargs,
    )
    _end_s = perf_counter()
    _input = response.usage.prompt_tokens
    _output = response.usage.completion_tokens
    _cached = getattr(response.usage.prompt_tokens_details, "cached_tokens", None) or 0

    wide = get_wide_event()
    wide["llm_input_tokens"] = wide.get("llm_input_tokens", 0) + _input
    wide["llm_output_tokens"] = wide.get("llm_output_tokens", 0) + _output
    wide["llm_cached_tokens"] = wide.get("llm_cached_tokens", 0) + _cached

    LOG.info(
        "llm.complete",
        prompt_id=prompt_id,
        model=model,
        cached_tokens=_cached,
        input_tokens=_input,
        output_tokens=_output,
        total_tokens=_input + _output,
        duration_s=round(_end_s - _start_s, 4),
    )

    # Only support tool calls
    _tu = (
        [
            convert_openai_tool_to_llm_tool(tool)
            for tool in response.choices[0].message.tool_calls
        ]
        if response.choices[0].message.tool_calls
        else None
    )

    content = response.choices[0].message.content
    if content:
        content = _strip_think_tags(content)

    llm_response = LLMResponse(
        role=response.choices[0].message.role,
        raw_response=response,
        content=content,
        tool_calls=_tu,
    )

    if json_mode:
        try:
            json_content = json.loads(content) if content else None
        except json.JSONDecodeError:
            LOG.error(
                "llm.json_decode_error",
                content=(content or "")[:200],
            )
            json_content = None
        llm_response.json_content = json_content

    return llm_response
