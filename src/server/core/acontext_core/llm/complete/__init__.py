import time
from typing import Callable, Awaitable, Any, Mapping, Optional
from .openai_sdk import openai_complete
from .anthropic_sdk import anthropic_complete
from ...schema.llm import LLMResponse
from ...schema.result import Result
from ...env import LOG, DEFAULT_CORE_CONFIG, get_logging_contextvars, bound_logging_vars


COMPLETE_FUNC = Callable[..., Awaitable[LLMResponse]]

FACTORIES: Mapping[str, COMPLETE_FUNC] = {
    "openai": openai_complete,
    "anthropic": anthropic_complete,
}


async def llm_complete(
    prompt=None,
    model=None,
    system_prompt=None,
    history_messages=[],
    json_mode=False,
    max_tokens=1024,
    prompt_kwargs: Optional[dict] = None,
    tools=None,
    **kwargs,
) -> Result[LLMResponse]:

    use_model = model or DEFAULT_CORE_CONFIG.llm_simple_model
    use_complete_func = FACTORIES[DEFAULT_CORE_CONFIG.llm_sdk]

    try:
        _start_s = time.perf_counter()
        response = await use_complete_func(
            prompt,
            model=use_model,
            system_prompt=system_prompt,
            history_messages=history_messages,
            json_mode=json_mode,
            max_tokens=max_tokens,
            prompt_kwargs=prompt_kwargs,
            tools=tools,
            **kwargs,
        )
        _end_s = time.perf_counter()
        LOG.info(f"LLM Complete finished in {_end_s - _start_s:.4f}s")
    except Exception as e:
        return Result.reject(f"LLM complete failed - error: {str(e)}")

    return Result.resolve(response)


async def llm_sanity_check():
    with bound_logging_vars(project_id="__test__"):
        r = await llm_complete("Test", max_tokens=1)
    _, eil = r.unpack()
    if eil:
        raise ValueError(f"LLM check failed: {eil}")
    LOG.info("LLM check passed")


def response_to_sendable_message(message: LLMResponse) -> dict:
    if DEFAULT_CORE_CONFIG.llm_sdk == "openai":
        return message.raw_response.choices[0].message.model_dump()
    elif DEFAULT_CORE_CONFIG.llm_sdk == "anthropic":
        dp = {"role": message.role, "content": []}
        if message.content:
            dp["content"].append({"type": "text", "text": message.content})
        if not message.tool_calls:
            return dp
        for tool_call in message.tool_calls:
            dp["content"].append(
                {
                    "type": "tool_use",
                    "id": tool_call.id,
                    "name": tool_call.function.name,
                    "input": tool_call.function.arguments,
                }
            )
        return dp
    else:
        raise ValueError(f"Unsupported LLM SDK: {DEFAULT_CORE_CONFIG.llm_sdk}")
