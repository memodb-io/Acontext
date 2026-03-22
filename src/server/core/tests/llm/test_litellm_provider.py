"""
Tests for the litellm LLM provider.

Validates that litellm_complete correctly:
- Makes async completions and returns LLMResponse
- Handles tool calls
- Handles JSON mode
- Raises on empty messages
- Passes history messages through
- Is registered in FACTORIES
- Is accepted by CoreConfig
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pydantic import BaseModel

from acontext_core.schema.llm import LLMResponse, LLMToolCall, LLMFunction


# ---------------------------------------------------------------------------
# Helpers to build mock litellm responses
# ---------------------------------------------------------------------------

class MockFunction(BaseModel):
    name: str
    arguments: str


class MockToolCall(BaseModel):
    id: str
    type: str = "function"
    function: MockFunction


class MockUsage(BaseModel):
    prompt_tokens: int = 10
    completion_tokens: int = 20
    prompt_tokens_details: object = None


class MockMessage(BaseModel):
    role: str = "assistant"
    content: str | None = None
    tool_calls: list[MockToolCall] | None = None

    def model_dump(self, **kwargs):
        d = {"role": self.role, "content": self.content}
        if self.tool_calls:
            d["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": tc.type,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in self.tool_calls
            ]
        return d


class MockChoice(BaseModel):
    message: MockMessage


class MockModelResponse(BaseModel):
    choices: list[MockChoice]
    usage: MockUsage = MockUsage()


def _make_text_response(content: str = "Hello!") -> MockModelResponse:
    return MockModelResponse(
        choices=[MockChoice(message=MockMessage(content=content))],
    )


def _make_tool_response() -> MockModelResponse:
    return MockModelResponse(
        choices=[
            MockChoice(
                message=MockMessage(
                    content=None,
                    tool_calls=[
                        MockToolCall(
                            id="call_abc123",
                            function=MockFunction(
                                name="get_weather",
                                arguments=json.dumps({"location": "Tokyo"}),
                            ),
                        )
                    ],
                )
            )
        ],
    )


def _make_json_response(content: str) -> MockModelResponse:
    return MockModelResponse(
        choices=[MockChoice(message=MockMessage(content=content))],
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestLitellmComplete:
    @pytest.mark.asyncio
    async def test_basic_completion(self):
        """Basic text completion returns correct LLMResponse."""
        mock_resp = _make_text_response("Hello from litellm!")

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=mock_resp):
            from acontext_core.llm.complete.litellm_sdk import litellm_complete

            result = await litellm_complete(
                prompt="Say hello",
                model="openai/gpt-4.1-mini",
                max_tokens=100,
            )

            assert isinstance(result, LLMResponse)
            assert result.role == "assistant"
            assert result.content == "Hello from litellm!"
            assert result.tool_calls is None

    @pytest.mark.asyncio
    async def test_with_tools(self):
        """Tool call completion returns correct tool_calls in LLMResponse."""
        mock_resp = _make_tool_response()

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=mock_resp):
            from acontext_core.llm.complete.litellm_sdk import litellm_complete

            tools = [
                {
                    "type": "function",
                    "function": {
                        "name": "get_weather",
                        "description": "Get weather for a location",
                        "parameters": {
                            "type": "object",
                            "properties": {"location": {"type": "string"}},
                        },
                    },
                }
            ]

            result = await litellm_complete(
                prompt="What's the weather in Tokyo?",
                model="openai/gpt-4.1",
                tools=tools,
            )

            assert result.content is None
            assert result.tool_calls is not None
            assert len(result.tool_calls) == 1
            assert result.tool_calls[0].function.name == "get_weather"
            assert result.tool_calls[0].function.arguments == {"location": "Tokyo"}
            assert result.tool_calls[0].id == "call_abc123"

    @pytest.mark.asyncio
    async def test_json_mode(self):
        """JSON mode sets response_format and parses json_content."""
        json_str = json.dumps({"answer": 42, "unit": "celsius"})
        mock_resp = _make_json_response(json_str)

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=mock_resp) as mock_call:
            from acontext_core.llm.complete.litellm_sdk import litellm_complete

            result = await litellm_complete(
                prompt="Return JSON",
                model="openai/gpt-4.1",
                json_mode=True,
            )

            assert result.json_content == {"answer": 42, "unit": "celsius"}
            # Verify response_format was passed
            call_kwargs = mock_call.call_args.kwargs
            assert call_kwargs["response_format"] == {"type": "json_object"}

    @pytest.mark.asyncio
    async def test_json_mode_invalid_json(self):
        """JSON mode with invalid JSON content sets json_content to None."""
        mock_resp = _make_json_response("not valid json {{{")

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=mock_resp):
            from acontext_core.llm.complete.litellm_sdk import litellm_complete

            result = await litellm_complete(
                prompt="Return JSON",
                model="openai/gpt-4.1",
                json_mode=True,
            )

            assert result.content == "not valid json {{{"
            assert result.json_content is None

    @pytest.mark.asyncio
    async def test_no_messages_raises(self):
        """Raises ValueError when no messages provided."""
        from acontext_core.llm.complete.litellm_sdk import litellm_complete

        with pytest.raises(ValueError, match="No messages provided"):
            await litellm_complete(model="openai/gpt-4.1")

    @pytest.mark.asyncio
    async def test_with_history_messages(self):
        """History messages are correctly passed through."""
        mock_resp = _make_text_response("I remember!")

        with patch("litellm.acompletion", new_callable=AsyncMock, return_value=mock_resp) as mock_call:
            from acontext_core.llm.complete.litellm_sdk import litellm_complete

            history = [
                {"role": "user", "content": "My name is Alice"},
                {"role": "assistant", "content": "Hello Alice!"},
            ]

            result = await litellm_complete(
                prompt="What's my name?",
                model="openai/gpt-4.1",
                system_prompt="You are helpful.",
                history_messages=history,
            )

            call_kwargs = mock_call.call_args.kwargs
            messages = call_kwargs["messages"]
            # system + 2 history + 1 user prompt = 4
            assert len(messages) == 4
            assert messages[0] == {"role": "system", "content": "You are helpful."}
            assert messages[1] == {"role": "user", "content": "My name is Alice"}
            assert messages[2] == {"role": "assistant", "content": "Hello Alice!"}
            assert messages[3] == {"role": "user", "content": "What's my name?"}


class TestLitellmRegistration:
    def test_registered_in_factories(self):
        """litellm is registered in the FACTORIES mapping."""
        from acontext_core.llm.complete import FACTORIES

        assert "litellm" in FACTORIES

    def test_config_accepts_litellm(self):
        """CoreConfig accepts llm_sdk='litellm'."""
        from acontext_core.schema.config import CoreConfig

        config = CoreConfig(llm_api_key="test-key", llm_sdk="litellm")
        assert config.llm_sdk == "litellm"

    def test_config_still_accepts_openai(self):
        """CoreConfig still accepts llm_sdk='openai' (backward compat)."""
        from acontext_core.schema.config import CoreConfig

        config = CoreConfig(llm_api_key="test-key", llm_sdk="openai")
        assert config.llm_sdk == "openai"

    def test_config_still_accepts_anthropic(self):
        """CoreConfig still accepts llm_sdk='anthropic' (backward compat)."""
        from acontext_core.schema.config import CoreConfig

        config = CoreConfig(llm_api_key="test-key", llm_sdk="anthropic")
        assert config.llm_sdk == "anthropic"
