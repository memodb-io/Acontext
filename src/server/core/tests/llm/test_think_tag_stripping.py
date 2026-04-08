"""
Tests for configurable tag stripping in ``openai_complete``.

The ``_strip_tags`` helper removes XML-style tag blocks (e.g.
``<think>...</think>``, ``<reasoning>...</reasoning>``) that reasoning models
inject before their final answer.  Stripping is **off by default** and
controlled by the ``llm_strip_tags`` config field (env var
``LLM_STRIP_TAGS``).
"""

import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from openai.types.chat import ChatCompletion, ChatCompletionMessage
from openai.types.chat.chat_completion import Choice
from openai.types.completion_usage import CompletionUsage

from acontext_core.llm.complete.openai_sdk import _strip_tags, openai_complete
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


def _patch_openai_complete(mock_response, strip_tags=None):
    """Return context-manager patches for ``openai_complete``.

    Args:
        mock_response: The ``ChatCompletion`` to return from the mocked client.
        strip_tags: List of tag names for ``llm_strip_tags`` config.
                    Defaults to ``[]`` (no stripping).
    """
    if strip_tags is None:
        strip_tags = []

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    mock_cfg = MagicMock()
    mock_cfg.llm_strip_tags = strip_tags
    mock_cfg.llm_response_timeout = 60
    mock_cfg.llm_openai_completion_kwargs = {}

    p_client = patch(
        "acontext_core.llm.complete.openai_sdk.get_openai_async_client_instance",
        return_value=mock_client,
    )
    p_wide = patch(
        "acontext_core.llm.complete.openai_sdk.get_wide_event",
        return_value={},
    )
    p_config = patch(
        "acontext_core.llm.complete.openai_sdk.DEFAULT_CORE_CONFIG",
        mock_cfg,
    )
    return p_client, p_wide, p_config


# ---------------------------------------------------------------------------
# _strip_tags unit tests
# ---------------------------------------------------------------------------

class TestStripTags:
    """Test stripping arbitrary XML-style tag blocks from model responses."""

    def test_strip_single_tag(self):
        text = "<think>reasoning here</think>actual response"
        assert _strip_tags(text, ["think"]) == "actual response"

    def test_strip_multiline_tag(self):
        text = "<think>\nstep 1\nstep 2\n</think>\nfinal answer"
        assert _strip_tags(text, ["think"]) == "final answer"

    def test_no_matching_tags(self):
        text = "just a normal response"
        assert _strip_tags(text, ["think"]) == "just a normal response"

    def test_empty_tag_block(self):
        text = "<think></think>response"
        assert _strip_tags(text, ["think"]) == "response"

    def test_tag_in_middle(self):
        text = "before <think>thinking</think> after"
        assert _strip_tags(text, ["think"]) == "before  after"

    def test_multiple_occurrences(self):
        text = "<think>first</think>middle<think>second</think>end"
        assert _strip_tags(text, ["think"]) == "middleend"

    def test_nested_angle_brackets_inside_tag(self):
        text = "<think>if a < b and b > c then</think>answer"
        assert _strip_tags(text, ["think"]) == "answer"

    def test_empty_string(self):
        assert _strip_tags("", ["think"]) == ""

    def test_only_tag_block(self):
        text = "<think>all reasoning</think>"
        assert _strip_tags(text, ["think"]) == ""

    def test_multiple_tag_types(self):
        text = "<think>thought</think>middle<reasoning>reason</reasoning>end"
        assert _strip_tags(text, ["think", "reasoning"]) == "middleend"

    def test_empty_tags_list_preserves_content(self):
        text = "<think>reasoning</think>answer"
        assert _strip_tags(text, []) == "<think>reasoning</think>answer"

    def test_non_matching_tag_preserved(self):
        text = "<think>reasoning</think>answer"
        assert _strip_tags(text, ["reasoning"]) == "<think>reasoning</think>answer"


# ---------------------------------------------------------------------------
# openai_complete integration tests (mocked client)
# ---------------------------------------------------------------------------

class TestOpenAICompleteTagStripping:
    """Verify that ``openai_complete`` strips tags only when configured."""

    @pytest.mark.asyncio
    async def test_no_stripping_by_default(self):
        """With default config (empty strip_tags), think tags are preserved."""
        raw = "<think>Let me reason...</think>The answer is 42."
        response = _make_chat_completion(content=raw)
        p1, p2, p3 = _patch_openai_complete(response, strip_tags=[])

        with p1, p2, p3:
            result = await openai_complete(prompt="test", model="m")

        assert result.content == raw

    @pytest.mark.asyncio
    async def test_stripping_when_configured(self):
        """When llm_strip_tags=["think"], think tags are removed."""
        response = _make_chat_completion(
            content="<think>Let me reason step by step...</think>The answer is 42."
        )
        p1, p2, p3 = _patch_openai_complete(response, strip_tags=["think"])

        with p1, p2, p3:
            result = await openai_complete(prompt="test", model="m")

        assert isinstance(result, LLMResponse)
        assert result.content == "The answer is 42."

    @pytest.mark.asyncio
    async def test_no_think_tags_unchanged(self):
        """Response without think tags should pass through unchanged."""
        response = _make_chat_completion(content="Hello from the model!")
        p1, p2, p3 = _patch_openai_complete(response, strip_tags=["think"])

        with p1, p2, p3:
            result = await openai_complete(prompt="Say hello", model="m")

        assert result.content == "Hello from the model!"

    @pytest.mark.asyncio
    async def test_json_mode_with_stripping(self):
        """JSON mode should parse correctly after stripping think tags."""
        response = _make_chat_completion(
            content='<think>reasoning</think>{"key": "value"}'
        )
        p1, p2, p3 = _patch_openai_complete(response, strip_tags=["think"])

        with p1, p2, p3:
            result = await openai_complete(
                prompt="Return JSON", model="m", json_mode=True,
            )

        assert result.json_content == {"key": "value"}

    @pytest.mark.asyncio
    async def test_none_content_not_stripped(self):
        """None content (e.g. tool-call-only response) should remain None."""
        response = _make_chat_completion(content=None)
        p1, p2, p3 = _patch_openai_complete(response, strip_tags=["think"])

        with p1, p2, p3:
            result = await openai_complete(prompt="call a tool", model="m")

        assert result.content is None

    @pytest.mark.asyncio
    async def test_multiple_tag_types_stripped(self):
        """Multiple tag types configured should all be stripped."""
        response = _make_chat_completion(
            content="<think>thought</think><reasoning>reason</reasoning>final"
        )
        p1, p2, p3 = _patch_openai_complete(
            response, strip_tags=["think", "reasoning"]
        )

        with p1, p2, p3:
            result = await openai_complete(prompt="test", model="m")

        assert result.content == "final"
