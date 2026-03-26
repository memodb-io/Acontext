"""
Tests for MiniMax LLM provider integration.

Tests minimax_sdk.py functions (temperature clamping, think-tag stripping),
client initialization, factory registration, and config schema validation.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from openai.types.chat import ChatCompletion, ChatCompletionMessage
from openai.types.chat.chat_completion import Choice
from openai.types.completion_usage import CompletionUsage

from acontext_core.llm.complete.minimax_sdk import (
    _clamp_temperature,
    _strip_think_tags,
    minimax_complete,
)
from acontext_core.schema.llm import LLMResponse


def _make_chat_completion(content="Hello", tool_calls=None):
    """Build a real ChatCompletion object for tests."""
    message = ChatCompletionMessage(
        role="assistant",
        content=content,
        tool_calls=tool_calls,
    )
    return ChatCompletion(
        id="chatcmpl-test",
        choices=[Choice(finish_reason="stop", index=0, message=message)],
        created=1700000000,
        model="MiniMax-M2.7",
        object="chat.completion",
        usage=CompletionUsage(
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30,
        ),
    )


class TestClampTemperature:
    """Test MiniMax temperature clamping to (0.0, 1.0]."""

    def test_zero_temperature_clamped(self):
        kwargs = {"temperature": 0}
        result = _clamp_temperature(kwargs)
        assert result["temperature"] == 0.01

    def test_negative_temperature_clamped(self):
        kwargs = {"temperature": -0.5}
        result = _clamp_temperature(kwargs)
        assert result["temperature"] == 0.01

    def test_above_one_clamped(self):
        kwargs = {"temperature": 1.5}
        result = _clamp_temperature(kwargs)
        assert result["temperature"] == 1.0

    def test_exactly_one_unchanged(self):
        kwargs = {"temperature": 1.0}
        result = _clamp_temperature(kwargs)
        assert result["temperature"] == 1.0

    def test_valid_temperature_unchanged(self):
        kwargs = {"temperature": 0.7}
        result = _clamp_temperature(kwargs)
        assert result["temperature"] == 0.7

    def test_no_temperature_key(self):
        kwargs = {"top_p": 0.9}
        result = _clamp_temperature(kwargs)
        assert "temperature" not in result
        assert result["top_p"] == 0.9

    def test_empty_kwargs(self):
        kwargs = {}
        result = _clamp_temperature(kwargs)
        assert result == {}

    def test_small_positive_unchanged(self):
        kwargs = {"temperature": 0.01}
        result = _clamp_temperature(kwargs)
        assert result["temperature"] == 0.01


class TestStripThinkTags:
    """Test stripping <think>...</think> tags from MiniMax reasoning responses."""

    def test_strip_think_tags(self):
        text = "<think>reasoning here</think>actual response"
        assert _strip_think_tags(text) == "actual response"

    def test_strip_multiline_think_tags(self):
        text = "<think>\nstep 1\nstep 2\n</think>\nfinal answer"
        assert _strip_think_tags(text) == "final answer"

    def test_no_think_tags(self):
        text = "just a normal response"
        assert _strip_think_tags(text) == "just a normal response"

    def test_empty_think_tags(self):
        text = "<think></think>response"
        assert _strip_think_tags(text) == "response"

    def test_think_tag_in_middle(self):
        text = "before<think>thinking</think>after"
        assert _strip_think_tags(text) == "beforeafter"

    def test_multiple_think_tags(self):
        text = "<think>first</think>middle<think>second</think>end"
        assert _strip_think_tags(text) == "middleend"


class TestMiniMaxComplete:
    """Test minimax_complete function."""

    def _patch_minimax(self, mock_response):
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        return (
            patch(
                "acontext_core.llm.complete.minimax_sdk.get_minimax_async_client_instance",
                return_value=mock_client,
            ),
            patch(
                "acontext_core.llm.complete.minimax_sdk.get_wide_event",
                return_value={},
            ),
            mock_client,
        )

    @pytest.mark.asyncio
    async def test_basic_completion(self):
        """Test basic text completion."""
        response = _make_chat_completion(content="Hello from MiniMax!")
        p1, p2, _ = self._patch_minimax(response)

        with p1, p2:
            result = await minimax_complete(
                prompt="Say hello",
                model="MiniMax-M2.7",
                max_tokens=100,
            )

        assert isinstance(result, LLMResponse)
        assert result.content == "Hello from MiniMax!"
        assert result.role == "assistant"

    @pytest.mark.asyncio
    async def test_think_tags_stripped(self):
        """Test that think tags are stripped from responses."""
        response = _make_chat_completion(
            content="<think>Let me think...</think>The answer is 42."
        )
        p1, p2, _ = self._patch_minimax(response)

        with p1, p2:
            result = await minimax_complete(
                prompt="What is the meaning of life?",
                model="MiniMax-M2.7",
            )

        assert result.content == "The answer is 42."

    @pytest.mark.asyncio
    async def test_json_mode(self):
        """Test JSON mode completion."""
        response = _make_chat_completion(content='{"key": "value"}')
        p1, p2, _ = self._patch_minimax(response)

        with p1, p2:
            result = await minimax_complete(
                prompt="Return JSON",
                model="MiniMax-M2.7",
                json_mode=True,
            )

        assert result.json_content == {"key": "value"}

    @pytest.mark.asyncio
    async def test_tool_calls(self):
        """Test tool call handling."""
        from openai.types.chat.chat_completion_message_tool_call import (
            ChatCompletionMessageToolCall,
            Function,
        )
        tool_call = ChatCompletionMessageToolCall(
            id="call_123",
            type="function",
            function=Function(name="get_weather", arguments='{"city": "Beijing"}'),
        )
        response = _make_chat_completion(content=None, tool_calls=[tool_call])
        p1, p2, _ = self._patch_minimax(response)

        with p1, p2:
            result = await minimax_complete(
                prompt="What's the weather?",
                model="MiniMax-M2.7",
                tools=[{"type": "function", "function": {"name": "get_weather"}}],
            )

        assert result.tool_calls is not None
        assert len(result.tool_calls) == 1
        tc = result.tool_calls[0]
        assert tc.function.name == "get_weather"
        assert tc.function.arguments == {"city": "Beijing"}

    @pytest.mark.asyncio
    async def test_temperature_clamped_in_complete(self):
        """Test that temperature is clamped in minimax_complete."""
        response = _make_chat_completion(content="ok")
        p1, p2, mock_client = self._patch_minimax(response)

        with p1, p2:
            await minimax_complete(
                prompt="test",
                model="MiniMax-M2.7",
                temperature=0,
            )

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["temperature"] == 0.01

    @pytest.mark.asyncio
    async def test_no_messages_raises(self):
        """Test that empty messages raises ValueError."""
        with pytest.raises(ValueError, match="No messages provided"):
            await minimax_complete()

    @pytest.mark.asyncio
    async def test_system_prompt_included(self):
        """Test that system prompt is included in messages."""
        response = _make_chat_completion(content="Hello")
        p1, p2, mock_client = self._patch_minimax(response)

        with p1, p2:
            await minimax_complete(
                prompt="Hi",
                model="MiniMax-M2.7",
                system_prompt="You are a helpful assistant",
            )

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        messages = call_kwargs["messages"]
        assert messages[0]["role"] == "system"
        assert messages[0]["content"] == "You are a helpful assistant"
        assert messages[1]["role"] == "user"
        assert messages[1]["content"] == "Hi"


class TestMiniMaxClientInit:
    """Test MiniMax client initialization."""

    def test_default_base_url(self):
        """Test that default base URL is set to MiniMax API."""
        with patch(
            "acontext_core.llm.complete.clients.DEFAULT_CORE_CONFIG"
        ) as mock_config:
            mock_config.llm_base_url = None
            mock_config.llm_api_key = "test-key"

            import acontext_core.llm.complete.clients as clients_mod
            clients_mod._global_minimax_async_client = None

            client = clients_mod.get_minimax_async_client_instance()
            assert client.base_url.host == "api.minimax.io"

            clients_mod._global_minimax_async_client = None

    def test_custom_base_url(self):
        """Test that custom base URL is used when configured."""
        with patch(
            "acontext_core.llm.complete.clients.DEFAULT_CORE_CONFIG"
        ) as mock_config:
            mock_config.llm_base_url = "https://custom.minimax.io/v1"
            mock_config.llm_api_key = "test-key"

            import acontext_core.llm.complete.clients as clients_mod
            clients_mod._global_minimax_async_client = None

            client = clients_mod.get_minimax_async_client_instance()
            assert "custom.minimax.io" in str(client.base_url)

            clients_mod._global_minimax_async_client = None


class TestMiniMaxFactoryRegistration:
    """Test MiniMax is registered in the FACTORIES mapping."""

    def test_minimax_in_factories(self):
        from acontext_core.llm.complete import FACTORIES
        assert "minimax" in FACTORIES

    def test_minimax_factory_callable(self):
        from acontext_core.llm.complete import FACTORIES
        assert callable(FACTORIES["minimax"])

    def test_minimax_factory_is_minimax_complete(self):
        from acontext_core.llm.complete import FACTORIES
        assert FACTORIES["minimax"] is minimax_complete


class TestMiniMaxConfigSchema:
    """Test MiniMax is accepted in CoreConfig.llm_sdk."""

    def test_minimax_sdk_accepted(self):
        from acontext_core.schema.config import CoreConfig
        config = CoreConfig(llm_api_key="test", llm_sdk="minimax")
        assert config.llm_sdk == "minimax"

    def test_invalid_sdk_rejected(self):
        from acontext_core.schema.config import CoreConfig
        with pytest.raises(Exception):
            CoreConfig(llm_api_key="test", llm_sdk="invalid_provider")

    def test_all_sdks_valid(self):
        from acontext_core.schema.config import CoreConfig
        for sdk in ("openai", "anthropic", "minimax", "mock"):
            config = CoreConfig(llm_api_key="test", llm_sdk=sdk)
            assert config.llm_sdk == sdk


class TestResponseToSendableMessage:
    """Test response_to_sendable_message handles minimax SDK."""

    def test_minimax_uses_openai_format(self):
        """Test that minimax SDK uses OpenAI response format."""
        mock_message = MagicMock()
        mock_message.model_dump.return_value = {
            "role": "assistant",
            "content": "Hello",
        }

        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=mock_message)]

        llm_response = MagicMock(spec=LLMResponse)
        llm_response.raw_response = mock_response

        with patch(
            "acontext_core.llm.complete.DEFAULT_CORE_CONFIG"
        ) as mock_config:
            mock_config.llm_sdk = "minimax"
            from acontext_core.llm.complete import response_to_sendable_message
            result = response_to_sendable_message(llm_response)

        assert result == {"role": "assistant", "content": "Hello"}
