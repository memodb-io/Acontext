"""Unit tests for :mod:`acontext.integrations.claude_agent`."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from acontext.async_client import AcontextAsyncClient
from acontext.errors import APIError
from acontext.integrations.claude_agent import (
    ClaudeAgentStorage,
    claude_assistant_message_to_anthropic_blob,
    claude_user_message_to_anthropic_blob,
    get_session_id_from_message,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def async_client() -> AcontextAsyncClient:
    client = AcontextAsyncClient(api_key="test-token")
    try:
        yield client
    finally:
        await client.aclose()


def _fake_create(**kwargs):
    """Return a mock Session whose id matches use_uuid (or a generated one)."""
    sid = kwargs.get("use_uuid") or "auto-generated-uuid"
    return MagicMock(id=sid)


@pytest.fixture
def mock_store():
    """Patch ``store_message`` and ``create`` on ``AsyncSessionsAPI``."""
    with patch(
        "acontext.resources.async_sessions.AsyncSessionsAPI.store_message",
        new_callable=AsyncMock,
    ) as m_store, patch(
        "acontext.resources.async_sessions.AsyncSessionsAPI.create",
        new_callable=AsyncMock,
    ) as m_create:
        m_store.return_value = MagicMock(id="msg-id")
        m_create.side_effect = _fake_create
        yield m_store


# ---------------------------------------------------------------------------
# Sample messages
# ---------------------------------------------------------------------------


_UUID_DEFAULT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
_UUID_DISCOVERED = "44444444-4444-4444-4444-444444444444"
_UUID_FROM_RESULT = "55555555-5555-5555-5555-555555555555"
_UUID_FROM_STREAM = "66666666-6666-6666-6666-666666666666"
_UUID_FLOW = "77777777-7777-7777-7777-777777777777"
_UUID_FIRST = "88888888-8888-8888-8888-888888888888"
_UUID_SECOND = "99999999-9999-9999-9999-999999999999"


def _system_init(session_id: str = _UUID_DEFAULT) -> dict:
    return {"subtype": "init", "data": {"session_id": session_id}}


def _system_other() -> dict:
    return {"subtype": "heartbeat", "data": {}}


def _user_text(text: str = "Hello") -> dict:
    return {"content": text}


def _user_blocks(*blocks: dict) -> dict:
    return {"content": list(blocks)}


def _assistant(
    *blocks: dict,
    model: str = "claude-sonnet-4-20250514",
    error: str | None = None,
) -> dict:
    msg: dict[str, Any] = {"content": list(blocks), "model": model}
    if error is not None:
        msg["error"] = error
    return msg


def _result_message(session_id: str = _UUID_DEFAULT) -> dict:
    return {"subtype": "end", "session_id": session_id}


def _stream_event(session_id: str = _UUID_DEFAULT) -> dict:
    return {"uuid": "evt-1", "session_id": session_id, "event": "delta"}


# Blocks
TEXT = {"text": "Hello, world!"}
EMPTY_TEXT = {"text": ""}
THINKING = {"thinking": "Let me reason...", "signature": "sig123"}
EMPTY_THINKING = {"thinking": "", "signature": "sig456"}
TOOL_USE = {"id": "tu_1", "name": "calculator", "input": {"expr": "1+1"}}
TOOL_RESULT = {"tool_use_id": "tu_1", "content": "Result is 2"}
TOOL_RESULT_ARRAY = {
    "tool_use_id": "tu_2",
    "content": [{"text": "line1"}, {"text": "line2"}],
}
TOOL_RESULT_NULL = {"tool_use_id": "tu_3", "content": None}
TOOL_RESULT_ERROR = {
    "tool_use_id": "tu_4",
    "content": "error detail",
    "is_error": True,
}


# ===================================================================
# 1. Conversion helpers
# ===================================================================


class TestUserMessageConversion:
    """UserMessage → Anthropic blob conversion."""

    def test_string_content(self):
        blob = claude_user_message_to_anthropic_blob(_user_text("Hi"))
        assert blob == {"role": "user", "content": [{"type": "text", "text": "Hi"}]}

    def test_empty_string_returns_none(self):
        assert claude_user_message_to_anthropic_blob(_user_text("")) is None

    def test_text_block(self):
        blob = claude_user_message_to_anthropic_blob(_user_blocks(TEXT))
        assert blob == {
            "role": "user",
            "content": [{"type": "text", "text": "Hello, world!"}],
        }

    def test_empty_text_block_skipped(self):
        blob = claude_user_message_to_anthropic_blob(_user_blocks(EMPTY_TEXT))
        assert blob is None

    def test_tool_result_block(self):
        blob = claude_user_message_to_anthropic_blob(_user_blocks(TOOL_RESULT))
        assert blob is not None
        assert blob["content"][0] == {
            "type": "tool_result",
            "tool_use_id": "tu_1",
            "content": "Result is 2",
        }

    def test_tool_result_array_content(self):
        blob = claude_user_message_to_anthropic_blob(_user_blocks(TOOL_RESULT_ARRAY))
        assert blob is not None
        assert blob["content"][0]["content"] == [
            {"type": "text", "text": "line1"},
            {"type": "text", "text": "line2"},
        ]

    def test_tool_result_null_content_normalized(self):
        blob = claude_user_message_to_anthropic_blob(_user_blocks(TOOL_RESULT_NULL))
        assert blob is not None
        assert blob["content"][0]["content"] == ""

    def test_tool_result_with_is_error(self):
        blob = claude_user_message_to_anthropic_blob(_user_blocks(TOOL_RESULT_ERROR))
        assert blob is not None
        block = blob["content"][0]
        assert block["is_error"] is True
        assert block["content"] == "error detail"

    def test_tool_use_in_user_skipped(self):
        """ToolUseBlock in user messages must be skipped."""
        blob = claude_user_message_to_anthropic_blob(
            _user_blocks(TOOL_USE, TEXT)
        )
        assert blob is not None
        # Only the text block should survive
        assert len(blob["content"]) == 1
        assert blob["content"][0]["type"] == "text"

    def test_tool_use_only_in_user_returns_none(self):
        """If user content only has ToolUseBlock, result is empty → None."""
        blob = claude_user_message_to_anthropic_blob(_user_blocks(TOOL_USE))
        assert blob is None

    def test_mixed_blocks(self):
        blob = claude_user_message_to_anthropic_blob(
            _user_blocks(TEXT, TOOL_RESULT)
        )
        assert blob is not None
        assert len(blob["content"]) == 2
        assert blob["content"][0]["type"] == "text"
        assert blob["content"][1]["type"] == "tool_result"


class TestAssistantMessageConversion:
    """AssistantMessage → Anthropic blob conversion."""

    def test_text_block(self):
        blob, has_thinking = claude_assistant_message_to_anthropic_blob(
            _assistant(TEXT)
        )
        assert blob == {
            "role": "assistant",
            "content": [{"type": "text", "text": "Hello, world!"}],
        }
        assert has_thinking is False

    def test_empty_text_block_skipped(self):
        blob, _ = claude_assistant_message_to_anthropic_blob(
            _assistant(EMPTY_TEXT)
        )
        assert blob is None

    def test_thinking_omitted_by_default(self):
        blob, has_thinking = claude_assistant_message_to_anthropic_blob(
            _assistant(THINKING, TEXT)
        )
        assert blob is not None
        assert len(blob["content"]) == 1
        assert blob["content"][0]["type"] == "text"
        assert has_thinking is False

    def test_thinking_included_when_opted_in(self):
        blob, has_thinking = claude_assistant_message_to_anthropic_blob(
            _assistant(THINKING, TEXT), include_thinking=True
        )
        assert blob is not None
        assert len(blob["content"]) == 2
        # First block is native thinking block
        assert blob["content"][0] == {
            "type": "thinking",
            "thinking": "Let me reason...",
            "signature": "sig123",
        }
        assert has_thinking is True

    def test_empty_thinking_skipped_even_when_opted_in(self):
        blob, has_thinking = claude_assistant_message_to_anthropic_blob(
            _assistant(EMPTY_THINKING, TEXT), include_thinking=True
        )
        assert blob is not None
        assert len(blob["content"]) == 1
        assert blob["content"][0]["text"] == "Hello, world!"
        # Empty thinking was skipped, so no thinking was actually included
        assert has_thinking is False

    def test_only_thinking_no_include_returns_none(self):
        """All-thinking message with include_thinking=False → empty → None."""
        blob, _ = claude_assistant_message_to_anthropic_blob(
            _assistant(THINKING)
        )
        assert blob is None

    def test_tool_use_block(self):
        blob, _ = claude_assistant_message_to_anthropic_blob(
            _assistant(TOOL_USE)
        )
        assert blob is not None
        assert blob["content"][0] == {
            "type": "tool_use",
            "id": "tu_1",
            "name": "calculator",
            "input": {"expr": "1+1"},
        }

    def test_tool_result_in_assistant_skipped(self):
        """ToolResultBlock in assistant messages must be skipped."""
        blob, _ = claude_assistant_message_to_anthropic_blob(
            _assistant(TOOL_RESULT, TEXT)
        )
        assert blob is not None
        # Only the text block should survive
        assert len(blob["content"]) == 1
        assert blob["content"][0]["type"] == "text"

    def test_tool_result_only_in_assistant_returns_none(self):
        """If assistant content only has ToolResultBlock, result is empty → None."""
        blob, _ = claude_assistant_message_to_anthropic_blob(
            _assistant(TOOL_RESULT)
        )
        assert blob is None

    def test_full_assistant_message(self):
        blob, has_thinking = claude_assistant_message_to_anthropic_blob(
            _assistant(THINKING, TEXT, TOOL_USE), include_thinking=True
        )
        assert blob is not None
        assert len(blob["content"]) == 3
        types = [b["type"] for b in blob["content"]]
        assert types == ["thinking", "text", "tool_use"]
        assert has_thinking is True


# ===================================================================
# 2. Session id extraction
# ===================================================================


class TestSessionIdExtraction:
    def test_system_init(self):
        assert get_session_id_from_message(_system_init(_UUID_DEFAULT)) == _UUID_DEFAULT

    def test_system_init_missing_session_id(self):
        """data dict without session_id → None, no crash."""
        msg = {"subtype": "init", "data": {"other": "value"}}
        assert get_session_id_from_message(msg) is None

    def test_system_init_data_not_dict(self):
        msg = {"subtype": "init", "data": "string-data"}
        assert get_session_id_from_message(msg) is None

    def test_system_non_init(self):
        assert get_session_id_from_message(_system_other()) is None

    def test_result_message(self):
        assert get_session_id_from_message(_result_message(_UUID_FROM_RESULT)) == _UUID_FROM_RESULT

    def test_stream_event(self):
        assert get_session_id_from_message(_stream_event(_UUID_FROM_STREAM)) == _UUID_FROM_STREAM

    def test_user_message_returns_none(self):
        assert get_session_id_from_message(_user_text()) is None

    def test_assistant_message_returns_none(self):
        assert get_session_id_from_message(_assistant(TEXT)) is None

    def test_non_uuid_session_id_returns_none(self):
        """Non-UUID session_id from Claude stream → None with warning."""
        assert get_session_id_from_message(_system_init("not-a-uuid")) is None

    def test_non_uuid_result_session_id_returns_none(self):
        assert get_session_id_from_message(_result_message("invalid")) is None

    def test_non_uuid_stream_session_id_returns_none(self):
        assert get_session_id_from_message(_stream_event("invalid")) is None


# ===================================================================
# 3. ClaudeAgentStorage – integration
# ===================================================================


class TestClaudeAgentStorageBasic:
    """ClaudeAgentStorage: session_id provided upfront."""

    @pytest.mark.asyncio
    async def test_user_message_stored(self, async_client, mock_store):
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(_user_text("Hi"))

        mock_store.assert_awaited_once()
        _, kwargs = mock_store.call_args
        assert kwargs["format"] == "anthropic"
        assert kwargs["blob"]["role"] == "user"
        assert kwargs["blob"]["content"] == [{"type": "text", "text": "Hi"}]

    @pytest.mark.asyncio
    async def test_assistant_message_stored_with_meta(
        self, async_client, mock_store
    ):
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(_assistant(TEXT, model="claude-sonnet-4-20250514"))

        mock_store.assert_awaited_once()
        _, kwargs = mock_store.call_args
        assert kwargs["blob"]["role"] == "assistant"
        assert kwargs["meta"] == {"model": "claude-sonnet-4-20250514"}

    @pytest.mark.asyncio
    async def test_assistant_with_thinking_meta(
        self, async_client, mock_store
    ):
        storage = ClaudeAgentStorage(
            client=async_client,
            session_id="sess-1",
            include_thinking=True,
        )
        await storage.save_message(_assistant(THINKING, TEXT))

        mock_store.assert_awaited_once()
        _, kwargs = mock_store.call_args
        assert kwargs["meta"]["has_thinking"] is True
        assert kwargs["meta"]["model"] == "claude-sonnet-4-20250514"

    @pytest.mark.asyncio
    async def test_system_message_not_stored(self, async_client, mock_store):
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(_system_init())

        mock_store.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_result_message_not_stored(self, async_client, mock_store):
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(_result_message())

        mock_store.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_stream_event_not_stored(self, async_client, mock_store):
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(_stream_event())

        mock_store.assert_not_awaited()


class TestClaudeAgentStorageSessionDiscovery:
    """ClaudeAgentStorage: session_id discovered from stream."""

    @pytest.mark.asyncio
    async def test_session_id_from_system_init(
        self, async_client, mock_store
    ):
        storage = ClaudeAgentStorage(client=async_client)
        assert storage.session_id is None

        await storage.save_message(_system_init(_UUID_DISCOVERED))
        assert storage.session_id == _UUID_DISCOVERED

        # Now user message should be stored
        await storage.save_message(_user_text("After init"))
        mock_store.assert_awaited_once()
        args = mock_store.call_args
        assert args[0][0] == _UUID_DISCOVERED  # session_id positional arg

    @pytest.mark.asyncio
    async def test_session_id_from_result_message(
        self, async_client, mock_store
    ):
        storage = ClaudeAgentStorage(client=async_client)
        await storage.save_message(_result_message(_UUID_FROM_RESULT))
        assert storage.session_id == _UUID_FROM_RESULT

    @pytest.mark.asyncio
    async def test_session_id_from_stream_event(
        self, async_client, mock_store
    ):
        storage = ClaudeAgentStorage(client=async_client)
        await storage.save_message(_stream_event(_UUID_FROM_STREAM))
        assert storage.session_id == _UUID_FROM_STREAM

    @pytest.mark.asyncio
    async def test_user_before_session_id_creates_session(
        self, async_client, mock_store
    ):
        """No session_id yet → _ensure_session creates one, message stored."""
        storage = ClaudeAgentStorage(client=async_client)
        await storage.save_message(_user_text("Before init"))

        mock_store.assert_awaited_once()
        # session_id should now be set (auto-generated by Acontext)
        assert storage.session_id is not None

    @pytest.mark.asyncio
    async def test_assistant_before_session_id_creates_session(
        self, async_client, mock_store
    ):
        """No session_id yet → _ensure_session creates one, message stored."""
        storage = ClaudeAgentStorage(client=async_client)
        await storage.save_message(_assistant(TEXT))

        mock_store.assert_awaited_once()
        assert storage.session_id is not None


class TestClaudeAgentStorageErroredMessages:
    """AssistantMessage with error field set → stored with error in meta."""

    @pytest.mark.asyncio
    async def test_errored_assistant_with_content_stored(
        self, async_client, mock_store
    ):
        """Errored assistant message with valid content is stored; error in meta."""
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(_assistant(TEXT, error="rate_limit"))

        mock_store.assert_awaited_once()
        _, kwargs = mock_store.call_args
        assert kwargs["blob"]["role"] == "assistant"
        assert kwargs["meta"]["error"] == "rate_limit"

    @pytest.mark.asyncio
    async def test_errored_assistant_empty_content_not_stored(
        self, async_client, mock_store
    ):
        """Errored assistant message with empty content is naturally skipped."""
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(_assistant(EMPTY_TEXT, error="server_error"))

        mock_store.assert_not_awaited()


class TestClaudeAgentStorageEmptyContent:
    """Empty content after filtering → store skipped."""

    @pytest.mark.asyncio
    async def test_empty_user_string(self, async_client, mock_store):
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(_user_text(""))

        mock_store.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_user_with_only_empty_text_blocks(
        self, async_client, mock_store
    ):
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(_user_blocks(EMPTY_TEXT, EMPTY_TEXT))

        mock_store.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_assistant_all_thinking_no_include(
        self, async_client, mock_store
    ):
        """Only ThinkingBlock with include_thinking=False → zero blocks."""
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(_assistant(THINKING))

        mock_store.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_user_only_tool_use_blocks(
        self, async_client, mock_store
    ):
        """ToolUseBlock skipped in user role → zero blocks → no store."""
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(_user_blocks(TOOL_USE))

        mock_store.assert_not_awaited()


class TestClaudeAgentStorageErrorHandling:
    """API error in store_message → caught, on_error called."""

    @pytest.mark.asyncio
    async def test_default_error_logged(self, async_client, mock_store, caplog):
        mock_store.side_effect = RuntimeError("API down")
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )

        with caplog.at_level(logging.WARNING):
            await storage.save_message(_user_text("Hi"))

        # Should not raise
        assert "Failed to store message" in caplog.text

    @pytest.mark.asyncio
    async def test_on_error_callback_invoked(self, async_client, mock_store):
        mock_store.side_effect = RuntimeError("API down")
        errors: list[tuple[Exception, dict]] = []

        def collect_error(exc: Exception, msg: dict) -> None:
            errors.append((exc, msg))

        storage = ClaudeAgentStorage(
            client=async_client,
            session_id="sess-1",
            on_error=collect_error,
        )
        await storage.save_message(_user_text("Hi"))

        assert len(errors) == 1
        assert isinstance(errors[0][0], RuntimeError)
        assert errors[0][1]["role"] == "user"


class TestClaudeAgentStorageDataclass:
    """Dataclass messages are converted via asdict."""

    @dataclass
    class FakeUserMessage:
        content: str = "Dataclass hello"

    @dataclass
    class FakeAssistantMessage:
        content: list = field(default_factory=lambda: [{"text": "reply"}])
        model: str = "claude-sonnet-4-20250514"

    @pytest.mark.asyncio
    async def test_dataclass_user(self, async_client, mock_store):
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(self.FakeUserMessage())

        mock_store.assert_awaited_once()
        _, kwargs = mock_store.call_args
        assert kwargs["blob"]["role"] == "user"

    @pytest.mark.asyncio
    async def test_dataclass_assistant(self, async_client, mock_store):
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        await storage.save_message(self.FakeAssistantMessage())

        mock_store.assert_awaited_once()
        _, kwargs = mock_store.call_args
        assert kwargs["blob"]["role"] == "assistant"


class TestClaudeAgentStorageFullFlow:
    """End-to-end flow: init → user → assistant."""

    @pytest.mark.asyncio
    async def test_full_flow(self, async_client, mock_store):
        storage = ClaudeAgentStorage(client=async_client)

        # 1. System init → sets session_id, not stored
        await storage.save_message(_system_init(_UUID_FLOW))
        assert storage.session_id == _UUID_FLOW
        mock_store.assert_not_awaited()

        # 2. User message → stored
        await storage.save_message(_user_text("What is 1+1?"))
        assert mock_store.await_count == 1
        _, kwargs = mock_store.call_args
        assert kwargs["blob"]["role"] == "user"

        # 3. Stream events → not stored
        await storage.save_message(_stream_event(_UUID_FLOW))
        assert mock_store.await_count == 1  # unchanged

        # 4. Assistant reply → stored
        await storage.save_message(
            _assistant(THINKING, TEXT, TOOL_USE, model="claude-sonnet-4-20250514")
        )
        assert mock_store.await_count == 2
        _, kwargs = mock_store.call_args
        assert kwargs["blob"]["role"] == "assistant"
        # Thinking omitted by default
        assert len(kwargs["blob"]["content"]) == 2
        assert kwargs["meta"] == {"model": "claude-sonnet-4-20250514"}

        # 5. Result message → not stored
        await storage.save_message(_result_message(_UUID_FLOW))
        assert mock_store.await_count == 2  # unchanged

    @pytest.mark.asyncio
    async def test_full_flow_with_thinking(self, async_client, mock_store):
        storage = ClaudeAgentStorage(
            client=async_client, include_thinking=True
        )

        await storage.save_message(_system_init(_UUID_FLOW))
        await storage.save_message(
            _assistant(THINKING, TEXT, model="claude-sonnet-4-20250514")
        )

        assert mock_store.await_count == 1
        _, kwargs = mock_store.call_args
        assert len(kwargs["blob"]["content"]) == 2
        assert kwargs["meta"]["has_thinking"] is True
        assert kwargs["meta"]["model"] == "claude-sonnet-4-20250514"


class TestClaudeAgentStorageSessionIdNotOverwritten:
    """Once session_id is set, it is not overwritten by later messages."""

    @pytest.mark.asyncio
    async def test_session_id_not_overwritten_by_result(
        self, async_client, mock_store
    ):
        storage = ClaudeAgentStorage(client=async_client)
        await storage.save_message(_system_init(_UUID_FIRST))
        assert storage.session_id == _UUID_FIRST

        await storage.save_message(_result_message(_UUID_SECOND))
        assert storage.session_id == _UUID_FIRST  # not overwritten

    @pytest.mark.asyncio
    async def test_explicit_session_id_not_overwritten(
        self, async_client, mock_store
    ):
        storage = ClaudeAgentStorage(
            client=async_client, session_id="explicit"
        )
        await storage.save_message(_system_init(_UUID_FROM_STREAM))
        assert storage.session_id == "explicit"


class TestClaudeAgentStorageAssistantNoModel:
    """AssistantMessage meta when model is missing or empty."""

    @pytest.mark.asyncio
    async def test_no_model_in_meta(self, async_client, mock_store):
        storage = ClaudeAgentStorage(
            client=async_client, session_id="sess-1"
        )
        # Manually craft an assistant message with empty model
        msg = {"content": [TEXT], "model": ""}
        await storage.save_message(msg)

        mock_store.assert_awaited_once()
        _, kwargs = mock_store.call_args
        # Empty model → not included in meta
        assert kwargs["meta"] is None


class TestClaudeAgentStorageSessionCreation:
    """Session is auto-created via use_uuid before the first store_message."""

    @pytest.mark.asyncio
    async def test_session_created_on_first_store(self, async_client):
        """create(use_uuid=...) is called once before the first store_message."""
        with patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.store_message",
            new_callable=AsyncMock,
        ) as m_store, patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.create",
            new_callable=AsyncMock,
        ) as m_create:
            m_store.return_value = MagicMock(id="msg-id")
            m_create.return_value = MagicMock(id="sess-1")

            storage = ClaudeAgentStorage(
                client=async_client, session_id="sess-1"
            )
            await storage.save_message(_user_text("Hi"))

            m_create.assert_awaited_once()
            _, kwargs = m_create.call_args
            assert kwargs["use_uuid"] == "sess-1"
            m_store.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_session_created_only_once(self, async_client):
        """create() is called only once, even for multiple store_message calls."""
        with patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.store_message",
            new_callable=AsyncMock,
        ) as m_store, patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.create",
            new_callable=AsyncMock,
        ) as m_create:
            m_store.return_value = MagicMock(id="msg-id")
            m_create.return_value = MagicMock(id="sess-1")

            storage = ClaudeAgentStorage(
                client=async_client, session_id="sess-1"
            )
            await storage.save_message(_user_text("First"))
            await storage.save_message(_user_text("Second"))

            m_create.assert_awaited_once()
            assert m_store.await_count == 2

    @pytest.mark.asyncio
    async def test_session_409_conflict_ignored(self, async_client):
        """If session already exists (409), continue without error."""
        with patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.store_message",
            new_callable=AsyncMock,
        ) as m_store, patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.create",
            new_callable=AsyncMock,
        ) as m_create:
            m_create.side_effect = APIError(
                status_code=409, message="session already exists"
            )
            m_store.return_value = MagicMock(id="msg-id")

            storage = ClaudeAgentStorage(
                client=async_client, session_id="sess-1"
            )
            await storage.save_message(_user_text("Hi"))

            m_create.assert_awaited_once()
            m_store.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_session_create_non_409_error_propagates(self, async_client):
        """Non-409 APIError from create is handled by on_error / logged."""
        errors: list[tuple[Exception, dict]] = []

        with patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.store_message",
            new_callable=AsyncMock,
        ) as m_store, patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.create",
            new_callable=AsyncMock,
        ) as m_create:
            m_create.side_effect = APIError(
                status_code=500, message="internal server error"
            )

            storage = ClaudeAgentStorage(
                client=async_client,
                session_id="sess-1",
                on_error=lambda e, msg: errors.append((e, msg)),
            )
            await storage.save_message(_user_text("Hi"))

            # store_message should NOT be called since create failed
            m_store.assert_not_awaited()
            # on_error should be called
            assert len(errors) == 1
            assert isinstance(errors[0][0], APIError)

    @pytest.mark.asyncio
    async def test_session_created_with_discovered_id(self, async_client):
        """Session is created using the discovered session_id."""
        with patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.store_message",
            new_callable=AsyncMock,
        ) as m_store, patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.create",
            new_callable=AsyncMock,
        ) as m_create:
            m_store.return_value = MagicMock(id="msg-id")
            m_create.return_value = MagicMock(id=_UUID_DISCOVERED)

            storage = ClaudeAgentStorage(client=async_client)
            await storage.save_message(_system_init(_UUID_DISCOVERED))
            await storage.save_message(_user_text("Hi"))

            m_create.assert_awaited_once()
            _, kwargs = m_create.call_args
            assert kwargs["use_uuid"] == _UUID_DISCOVERED

    @pytest.mark.asyncio
    async def test_session_created_without_uuid_when_no_session_id(self, async_client):
        """No session_id at all → create() without use_uuid, Acontext generates id."""
        with patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.store_message",
            new_callable=AsyncMock,
        ) as m_store, patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.create",
            new_callable=AsyncMock,
        ) as m_create:
            m_store.return_value = MagicMock(id="msg-id")
            m_create.return_value = MagicMock(id="auto-generated-uuid")

            storage = ClaudeAgentStorage(client=async_client)
            await storage.save_message(_user_text("Hi"))

            m_create.assert_awaited_once()
            _, kwargs = m_create.call_args
            assert kwargs["use_uuid"] is None
            assert storage.session_id == "auto-generated-uuid"
            m_store.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_session_created_with_user(self, async_client):
        """user parameter is passed to create()."""
        with patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.store_message",
            new_callable=AsyncMock,
        ) as m_store, patch(
            "acontext.resources.async_sessions.AsyncSessionsAPI.create",
            new_callable=AsyncMock,
        ) as m_create:
            m_store.return_value = MagicMock(id="msg-id")
            m_create.return_value = MagicMock(id="sess-1")

            storage = ClaudeAgentStorage(
                client=async_client, session_id="sess-1", user="alice@example.com"
            )
            await storage.save_message(_user_text("Hi"))

            m_create.assert_awaited_once()
            _, kwargs = m_create.call_args
            assert kwargs["user"] == "alice@example.com"
            assert kwargs["use_uuid"] == "sess-1"
