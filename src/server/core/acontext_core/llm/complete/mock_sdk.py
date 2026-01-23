import json
from typing import Optional
from time import perf_counter
from ...env import LOG
from ...schema.llm import LLMResponse


async def mock_complete(
    prompt=None,
    model=None,
    system_prompt=None,
    history_messages=None,
    json_mode=False,
    max_tokens=1024,
    prompt_kwargs: Optional[dict] = None,
    tools=None,
    **kwargs,
) -> LLMResponse:
    """
    Mock LLM provider for deterministic testing.
    
    Logic:
    - If prompt contains "Simple Hello" -> Return "Hello World"
    - If prompt contains "CALL_TOOL_DISK_LIST" -> Return structured tool call JSON for disk.list
    - Otherwise return a generic response
    """
    # Safe handling of mutable default arguments
    history_messages = history_messages or []
    prompt_kwargs = prompt_kwargs or {}
    prompt_id = prompt_kwargs.get("prompt_id", "mock-prompt")
    
    start_time = perf_counter()
    
    # Combine all text content to check for patterns
    full_text = ""
    if prompt:
        full_text += str(prompt)
    if system_prompt:
        full_text += str(system_prompt)
    for msg in history_messages:
        if hasattr(msg, 'content') and msg.content:
            full_text += str(msg.content)
    
    LOG.info(f"Mock LLM processing: prompt_id={prompt_id}, text_length={len(full_text)}")
    
    # Determine response based on content
    if "Simple Hello" in full_text:
        content = "Hello World"
        tool_calls = None
    elif "CALL_TOOL_DISK_LIST" in full_text:
        content = None
        tool_calls = [
            {
                "id": "call_mock_disk_list",
                "type": "function",
                "function": {
                    "name": "disk.list",
                    "arguments": {"path": "/tmp"}
                }
            }
        ]
    else:
        content = "This is a mock response for testing purposes."
        tool_calls = None
    
    # Handle JSON mode
    if json_mode and content:
        try:
            # Try to parse as JSON, if not valid wrap it
            json.loads(content)
        except json.JSONDecodeError:
            content = json.dumps({"response": content})
    
    end_time = perf_counter()
    duration = end_time - start_time
    
    LOG.info(f"Mock LLM completed: duration={duration:.3f}s, has_tools={tool_calls is not None}")
    
    return LLMResponse(
        role="assistant",  # Required field
        raw_response={"mock": True, "content": content, "tool_calls": tool_calls},  # Required field
        content=content,
        tool_calls=tool_calls,
    )