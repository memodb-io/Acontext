"""
Integration tests for MiniMax LLM provider.

These tests require a valid MINIMAX_API_KEY environment variable.
Run with: pytest tests/llm/test_minimax_integration.py -v
"""

import os
import pytest

pytestmark = [
    pytest.mark.skipif(
        not os.environ.get("MINIMAX_API_KEY"),
        reason="MINIMAX_API_KEY not set",
    ),
]


@pytest.fixture
def minimax_client():
    """Create a MiniMax AsyncOpenAI client for integration tests."""
    from openai import AsyncOpenAI

    return AsyncOpenAI(
        base_url="https://api.minimax.io/v1",
        api_key=os.environ["MINIMAX_API_KEY"],
    )


@pytest.mark.asyncio
async def test_minimax_basic_completion(minimax_client):
    """Test basic chat completion with MiniMax API."""
    response = await minimax_client.chat.completions.create(
        model="MiniMax-M2.7",
        messages=[{"role": "user", "content": "Say 'hello' and nothing else."}],
        max_tokens=64,
        temperature=0.01,
    )
    assert response.choices[0].message.content is not None
    assert len(response.choices[0].message.content) > 0


@pytest.mark.asyncio
async def test_minimax_json_mode(minimax_client):
    """Test JSON mode completion with MiniMax M2.5 (non-reasoning model)."""
    response = await minimax_client.chat.completions.create(
        model="MiniMax-M2.5",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant that outputs JSON.",
            },
            {
                "role": "user",
                "content": 'Return a JSON object with key "status" and value "ok".',
            },
        ],
        max_tokens=64,
        temperature=0.01,
        response_format={"type": "json_object"},
    )
    import json
    import re

    raw_content = response.choices[0].message.content
    assert raw_content is not None and len(raw_content) > 0, f"Empty content: {response.choices[0]}"
    # Strip <think> tags from reasoning models
    content = re.sub(r"<think>[\s\S]*?</think>\s*", "", raw_content)
    # Strip markdown code fences (```json ... ```)
    content = re.sub(r"```(?:json)?\s*", "", content).strip()
    parsed = json.loads(content)
    assert "status" in parsed


@pytest.mark.asyncio
async def test_minimax_tool_calling(minimax_client):
    """Test function calling with MiniMax API."""
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get weather for a city",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                            "description": "City name",
                        }
                    },
                    "required": ["city"],
                },
            },
        }
    ]
    response = await minimax_client.chat.completions.create(
        model="MiniMax-M2.7",
        messages=[
            {"role": "user", "content": "What's the weather in Beijing?"}
        ],
        tools=tools,
        max_tokens=100,
        temperature=0.01,
    )
    choice = response.choices[0]
    assert choice.message.tool_calls is not None or choice.message.content is not None
