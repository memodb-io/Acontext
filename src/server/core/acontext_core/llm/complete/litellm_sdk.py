import json
from typing import Optional
from time import perf_counter

import litellm

from ...env import LOG, DEFAULT_CORE_CONFIG
from ...schema.llm import LLMResponse
from ...telemetry.log import get_wide_event


# Silence litellm's own logging to avoid duplicate noise
litellm.suppress_debug_info = True


async def litellm_complete(
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
    """
    LLM completion via litellm — supports 100+ providers with a unified
    OpenAI-compatible interface.

    litellm accepts OpenAI-format messages/tools and returns OpenAI-format
    responses, so minimal conversion is needed.
    """
    prompt_kwargs = prompt_kwargs or {}
    prompt_id = prompt_kwargs.get("prompt_id", "...")

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

    # Build litellm call kwargs
    call_kwargs = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "timeout": DEFAULT_CORE_CONFIG.llm_response_timeout,
        **kwargs,
    }

    # Pass API key and base URL if configured
    if DEFAULT_CORE_CONFIG.llm_api_key:
        call_kwargs["api_key"] = DEFAULT_CORE_CONFIG.llm_api_key
    if DEFAULT_CORE_CONFIG.llm_base_url:
        call_kwargs["api_base"] = DEFAULT_CORE_CONFIG.llm_base_url

    if tools:
        call_kwargs["tools"] = tools

    _start_s = perf_counter()
    response = await litellm.acompletion(**call_kwargs)
    _end_s = perf_counter()

    # Extract token usage
    _input = getattr(response.usage, "prompt_tokens", 0) or 0
    _output = getattr(response.usage, "completion_tokens", 0) or 0
    _cached = 0
    if hasattr(response.usage, "prompt_tokens_details") and response.usage.prompt_tokens_details:
        _cached = getattr(response.usage.prompt_tokens_details, "cached_tokens", 0) or 0

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

    # litellm returns OpenAI-compatible ModelResponse
    choice = response.choices[0]
    message = choice.message

    # Convert tool calls to LLMToolCall format
    _tu = None
    if message.tool_calls:
        _tu = []
        for tool_call in message.tool_calls:
            _tu.append({
                "id": tool_call.id,
                "type": tool_call.type,
                "function": {
                    "name": tool_call.function.name,
                    "arguments": json.loads(tool_call.function.arguments),
                },
            })

    llm_response = LLMResponse(
        role=message.role,
        raw_response=response,
        content=message.content,
        tool_calls=_tu,
    )

    if json_mode and message.content:
        try:
            json_content = json.loads(message.content)
        except json.JSONDecodeError:
            LOG.error(
                "llm.json_decode_error",
                content=message.content[:200],
            )
            json_content = None
        llm_response.json_content = json_content

    return llm_response
