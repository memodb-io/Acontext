from hmac import new
import json
from typing import Optional
from .clients import get_anthropic_async_client_instance
from anthropic.types import Message, ContentBlock
from time import perf_counter
from ...env import LOG, DEFAULT_CORE_CONFIG
from ...schema.llm import LLMResponse


def convert_openai_tool_to_anthropic_tool(tools: list[dict]) -> list[dict]:
    return [
        {
            "name": tool["function"]["name"],
            "description": tool["function"].get("description", ""),
            "input_schema": tool["function"].get("parameters", {}),
        }
        for tool in tools
    ]


def process_messages(messages: list[dict]) -> list[dict]:
    new_messages = []
    for m in messages:
        if isinstance(m, dict) and m["role"] == "tool" and "tool_call_id" in m:
            if (
                isinstance(new_messages[-1], dict)
                and new_messages[-1]["role"] == "user"
            ):
                new_messages[-1]["content"].append(
                    {
                        "type": "tool_result",
                        "tool_use_id": m["tool_call_id"],
                        "content": m["content"],
                    }
                )
            else:
                new_messages.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "tool_result",
                                "tool_use_id": m["tool_call_id"],
                                "content": m["content"],
                            }
                        ],
                    }
                )
        else:
            new_messages.append(m)
    return new_messages


async def anthropic_complete(
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

    anthropic_async_client = get_anthropic_async_client_instance()

    # Convert messages to Anthropic format
    messages = []
    messages.extend(history_messages)
    # Add the current user prompt
    if prompt:
        messages.append({"role": "user", "content": prompt})

    if not messages:
        raise ValueError("No messages provided")

    messages = process_messages(messages)
    # Prepare request parameters
    request_params = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        **kwargs,
    }

    # Add system prompt if provided
    request_params["system"] = system_prompt

    # Handle JSON mode for Anthropic
    if json_mode:
        request_params["system"] = (
            f"{system_prompt}\nPlease respond with valid JSON only, don't wrap the json with ```json"
        )

    # Handle tools if provided (Anthropic has a different tool format)
    if tools:
        # Convert OpenAI-style tools to Anthropic format if needed
        anthropic_tools = convert_openai_tool_to_anthropic_tool(tools)
        request_params["tools"] = anthropic_tools

    try:
        _start_s = perf_counter()
        response: Message = await anthropic_async_client.messages.create(
            **request_params
        )
        _end_s = perf_counter()

        LOG.info(
            f"LLM Complete: {prompt_id} {model}. "
            f"cached {response.usage.cache_read_input_tokens}, "
            f"input {response.usage.input_tokens}, "
            f"total {response.usage.input_tokens + response.usage.output_tokens}, "
            f"time {_end_s - _start_s:.4f}s"
        )

        # Extract content from response
        content = ""
        tool_calls = []
        for content_block in response.content:
            if content_block.type == "text":
                content += content_block.text
            elif content_block.type == "tool_use":
                # Convert Anthropic tool use to OpenAI-style tool call
                tool_call = {
                    "id": content_block.id,
                    "type": "function",
                    "function": {
                        "name": content_block.name,
                        "arguments": (content_block.input or {}),
                    },
                }
                tool_calls.append(tool_call)

        llm_response = LLMResponse(
            role="assistant",
            raw_response=response,
            content=content if content else None,
            tool_calls=tool_calls if tool_calls else None,
        )

        # Handle JSON mode parsing
        if json_mode and content:
            try:
                json_content = json.loads(content)
                llm_response.json_content = json_content
            except json.JSONDecodeError:
                LOG.error(f"JSON decode error: {content}")
                llm_response.json_content = None

        return llm_response

    except Exception as e:
        LOG.error(f"Anthropic completion failed: {str(e)}")
        raise e
