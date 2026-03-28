"""
Tests for generic think-tag stripping in ``openai_complete``.

The ``_strip_think_tags`` helper removes ``<think>...</think>`` blocks that
reasoning models (MiniMax, DeepSeek, QwQ, etc.) inject before their final
answer.  These tests verify the helper itself and confirm that
``openai_complete`` applies it to response content.
"""

import json
import pytest
from unittest.mock import AsyncMock, patch
from openai.types.chat import ChatCompletion, ChatCompletionMessage
from openai.types.chat.chat_completion import Choice
from openai.types.completion_usage import CompletionUsage

from acontext_core.llm.complete.openai_sdk import _strip_think_tags, openai_complete
from acontext_core.schema.llm import LLMResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_chat_completion(content="Hello", tool_calls=None):
    """Build a real ``ChatCompletion`` object for tests."""
    message = ChatCompletionMessage(
        role="assistant",
        content=content,
        tool_calls=tool_calls,
    )
    return ChatCompletion(
        id="chatcmpl-test",
        choices=[Choice(finish_reason="stop", index=0, message=message)],
        created=1700000000,
        model="test-model",
        object="chat.completion",
        usage=CompletionUsage(
            prompt_tokens=10,
            completion_tokens=20,
            total_tokens=30,
        ),
    )


# ---------------------------------------------------------------------------
# _strip_think_tags unit tests
# ---------------------------------------------------------------------------

class TestStripThinkTags:
    """Test stripping <think>...</think> tags from reasoning model responses."""

    def test_strip_simple_think_tags(self):
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
        text = "before <think>thinking</think> after"
        assert _strip_think_tags(text) == "before  after"

    def test_multiple_think_tags(self):
        text = "<think>first</think>middle<think>second</think>end"
        assert _strip_think_tags(text) == "middleend"

    def test_nested_angle_brackets_inside_think(self):
        text = "<think>if a < b and b > c then</think>answer"
        assert _strip_think_tags(text) == "answer"

    def test_empty_string(self):
        assert _strip_think_tags("") == ""

    def test_only_think_tags(self):
        text = "<think>all reasoning</think>"
        assert _strip_think_tags(text) == ""


# ---------------------------------------------------------------------------
# openai_complete integration tests (mocked client)
# ---------------------------------------------------------------------------

class TestOpenAICompleteThinkStripping:
    """Verify that ``openai_complete`` strips think tags from responses."""

    def _patch_openai(self, mock_response):
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        return (
            patch(
                "acontext_core.llm.complete.openai_sdk.get_openai_async_client_instance",
                return_value=mock_client,
            ),
            patch(
                "acontext_core.llm.complete.openai_sdk.get_wide_event",
                return_value={},
            ),
            mock_client,
        )

    @pytest.mark.asyncio
    async def test_think_tags_stripped_from_content(self):
        """Response content with <think> tags should have them removed."""
        response = _make_chat_completion(
            content="<think>Let me reason step by step...</think>The answer is 42."
        )
        p1, p2, _ = self._patch_openai(response)

        with p1, p2:
            result = await openai_complete(
                prompt="What is the meaning of life?",
                model="test-model",
            )

        assert isinstance(result, LLMResponse)
        assert result.content == "The answer is 42."

    @pytest.mark.asyncio
    async def test_no_think_tags_unchanged(self):
        """Response without think tags should pass through unchanged."""
        response = _make_chat_completion(content="Hello from the model!")
        p1, p2, _ = self._patch_openai(response)

        with p1, p2:
            result = await openai_complete(
                prompt="Say hello",
                model="test-model",
            )

        assert result.content == "Hello from the model!"

    @pytest.mark.asyncio
    async def test_json_mode_with_think_tags(self):
        """JSON mode should parse correctly after stripping think tags."""
        response = _make_chat_completion(
            content='<think>reasoning</think>{"key": "value"}'
        )
        p1, p2, _ = self._patch_openai(response)

        with p1, p2:
            result = await openai_complete(
                prompt="Return JSON",
                model="test-model",
                json_mode=True,
            )

        assert result.json_content == {"key": "value"}

    @pytest.mark.asyncio
    async def test_none_content_not_stripped(self):
        """None content (e.g. tool-call-only response) should remain None."""
        response = _make_chat_completion(content=None)
        p1, p2, _ = self._patch_openai(response)

        with p1, p2:
            result = await openai_complete(
                prompt="call a tool",
                model="test-model",
            )

        assert result.content is None
