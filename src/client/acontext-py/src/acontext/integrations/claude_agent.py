"""Claude Agent SDK integration for Acontext.

Provides :class:`ClaudeAgentStorage` (async-only) that accepts messages
produced by the Claude Agent SDK ``receive_response()`` stream and persists
**only** ``UserMessage`` and ``AssistantMessage`` to Acontext in Anthropic
format via ``client.sessions.store_message(...)``.

Other message types (``SystemMessage``, ``ResultMessage``, ``StreamEvent``)
are used only for session-id resolution and are **never** stored.

Usage::

    from acontext import AcontextAsyncClient
    from acontext.integrations.claude_agent import ClaudeAgentStorage

    client = AcontextAsyncClient(api_key="sk_project_token")
    storage = ClaudeAgentStorage(client=client)

    async for message in claude_client.receive_response():
        await storage.save_message(message)
"""

from __future__ import annotations

import logging
import re
from dataclasses import asdict, is_dataclass
from typing import Any, Callable

from ..async_client import AcontextAsyncClient
from ..errors import APIError

__all__ = ["ClaudeAgentStorage"]

logger = logging.getLogger(__name__)

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _is_uuid(value: str) -> bool:
    """Return ``True`` if *value* looks like a UUID v4 (or any UUID)."""
    return bool(_UUID_RE.match(value))


# ---------------------------------------------------------------------------
# Helpers – coerce to dict
# ---------------------------------------------------------------------------


def _to_dict(msg: Any) -> dict:
    """Coerce *msg* to a plain dict.

    Supports:
    * ``dict`` – returned as-is.
    * dataclass instances – converted via ``dataclasses.asdict``.
    """
    if isinstance(msg, dict):
        return msg
    if is_dataclass(msg) and not isinstance(msg, type):
        return asdict(msg)
    # Pydantic or similar with model_dump
    if hasattr(msg, "model_dump"):
        return msg.model_dump()  # type: ignore[union-attr]
    raise TypeError(
        f"Cannot coerce message of type {type(msg).__name__} to dict. "
        "Pass a dict or a dataclass instance."
    )


# ---------------------------------------------------------------------------
# Helpers – message type detection
# ---------------------------------------------------------------------------


def _is_system_message(msg: dict) -> bool:
    """``SystemMessage`` has ``subtype`` and ``data`` keys, no ``content``."""
    return "subtype" in msg and "data" in msg and "content" not in msg


def _is_result_message(msg: dict) -> bool:
    """``ResultMessage`` has ``subtype`` and ``session_id``; no ``content``."""
    return "subtype" in msg and "session_id" in msg and "content" not in msg


def _is_stream_event(msg: dict) -> bool:
    """``StreamEvent`` has ``uuid``, ``session_id``, and ``event``."""
    return "uuid" in msg and "session_id" in msg and "event" in msg


def _is_user_message(msg: dict) -> bool:
    """``UserMessage`` has ``content`` but no ``model``."""
    return "content" in msg and "model" not in msg


def _is_assistant_message(msg: dict) -> bool:
    """``AssistantMessage`` has ``content`` **and** ``model``."""
    return "content" in msg and "model" in msg


# ---------------------------------------------------------------------------
# Helpers – session id extraction
# ---------------------------------------------------------------------------


def _validate_session_id(sid: str | None) -> str | None:
    """Return *sid* if it is a valid UUID, otherwise warn and return ``None``."""
    if sid is None:
        return None
    if not isinstance(sid, str):
        return None
    if not _is_uuid(sid):
        logger.warning(
            "Ignoring non-UUID session_id from Claude stream: %r", sid
        )
        return None
    return sid


def get_session_id_from_message(msg: dict) -> str | None:
    """Try to extract a Claude session id from *msg*.

    Priority:
    1. ``SystemMessage`` with ``subtype == "init"`` → ``data.get("session_id")``.
    2. ``ResultMessage`` / ``StreamEvent`` → ``.get("session_id")``.

    Returns ``None`` when the message does not carry a session id or
    when the extracted value is not a valid UUID format.
    """
    # SystemMessage init
    if _is_system_message(msg):
        if msg.get("subtype") == "init":
            data = msg.get("data")
            if isinstance(data, dict):
                return _validate_session_id(data.get("session_id"))
        return None

    # ResultMessage / StreamEvent
    if _is_result_message(msg) or _is_stream_event(msg):
        sid = msg.get("session_id")
        if not isinstance(sid, str):
            return None
        return _validate_session_id(sid)

    return None


# ---------------------------------------------------------------------------
# Helpers – block conversion (Claude SDK → Anthropic blob)
# ---------------------------------------------------------------------------


def _is_thinking_block(block: dict) -> bool:
    return "thinking" in block and "signature" in block


def _is_tool_use_block(block: dict) -> bool:
    return "id" in block and "name" in block and "input" in block


def _is_tool_result_block(block: dict) -> bool:
    return "tool_use_id" in block


def _is_text_block(block: dict) -> bool:
    return "text" in block


def _normalize_tool_result_content(content: Any) -> str | list[dict]:
    """Normalize ``ToolResultBlock.content`` to a shape accepted by the API.

    * ``None`` → ``""``
    * ``str`` → as-is
    * ``list`` → ``[{"type": "text", "text": item["text"]}]``
    """
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return [{"type": "text", "text": item.get("text", "")} for item in content]
    return str(content)


def _convert_block(block: dict, *, role: str, include_thinking: bool) -> dict | None:
    """Convert a single Claude SDK content block to an Anthropic content block.

    Returns ``None`` when the block should be skipped.
    """
    # Order: ThinkingBlock → ToolUseBlock → ToolResultBlock → TextBlock

    if _is_thinking_block(block):
        if not include_thinking:
            return None
        thinking_text = block.get("thinking", "")
        if not thinking_text:
            return None  # empty thinking text rejected by API
        return {
            "type": "thinking",
            "thinking": thinking_text,
            "signature": block.get("signature", ""),
        }

    if _is_tool_use_block(block):
        if role != "assistant":
            return None  # tool_use only valid in assistant messages
        input_val = block["input"]
        if isinstance(input_val, str):
            import json as _json

            try:
                input_val = _json.loads(input_val)
            except (ValueError, TypeError):
                input_val = {"raw": input_val}
        return {
            "type": "tool_use",
            "id": block["id"],
            "name": block["name"],
            "input": input_val,
        }

    if _is_tool_result_block(block):
        if role != "user":
            return None  # tool_result only valid in user messages
        result: dict[str, Any] = {
            "type": "tool_result",
            "tool_use_id": block["tool_use_id"],
            "content": _normalize_tool_result_content(block.get("content")),
        }
        if block.get("is_error"):
            result["is_error"] = True
        return result

    if _is_text_block(block):
        text = block.get("text", "")
        if not text:
            return None  # empty text rejected by API
        return {"type": "text", "text": text}

    # Unknown block type – skip silently
    return None


def _convert_content_blocks(
    content: str | list, *, role: str, include_thinking: bool
) -> tuple[list[dict], bool]:
    """Convert Claude SDK content to Anthropic content block array.

    Returns ``(blocks, has_thinking)`` where *has_thinking* is ``True``
    when at least one thinking block was included in the output.
    """
    has_thinking = False

    if isinstance(content, str):
        if not content:
            return [], False
        return [{"type": "text", "text": content}], False

    blocks: list[dict] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        converted = _convert_block(block, role=role, include_thinking=include_thinking)
        if converted is not None:
            blocks.append(converted)
            # Track whether a thinking block was included
            if _is_thinking_block(block) and include_thinking:
                has_thinking = True

    return blocks, has_thinking


# ---------------------------------------------------------------------------
# Public conversion helpers
# ---------------------------------------------------------------------------


def claude_user_message_to_anthropic_blob(msg: dict) -> dict | None:
    """Convert a Claude SDK ``UserMessage`` dict to an Anthropic blob.

    Returns ``None`` when the resulting content would be empty (no storable
    blocks).
    """
    content = msg.get("content", "")
    blocks, _ = _convert_content_blocks(content, role="user", include_thinking=False)
    if not blocks:
        return None
    return {"role": "user", "content": blocks}


def claude_assistant_message_to_anthropic_blob(
    msg: dict, *, include_thinking: bool = False
) -> tuple[dict | None, bool]:
    """Convert a Claude SDK ``AssistantMessage`` dict to an Anthropic blob.

    Returns ``(blob_or_none, has_thinking)``.
    *blob_or_none* is ``None`` when the resulting content would be empty.
    *has_thinking* is ``True`` when thinking blocks were included.
    """
    content = msg.get("content", [])
    blocks, has_thinking = _convert_content_blocks(
        content, role="assistant", include_thinking=include_thinking
    )
    if not blocks:
        return None, has_thinking
    return {"role": "assistant", "content": blocks}, has_thinking


# ---------------------------------------------------------------------------
# ClaudeAgentStorage
# ---------------------------------------------------------------------------


class ClaudeAgentStorage:
    """Async-only storage adapter for the Claude Agent SDK.

    Accepts messages from ``claude_client.receive_response()`` and persists
    **only** ``UserMessage`` and ``AssistantMessage`` to Acontext in Anthropic
    format.

    Parameters
    ----------
    client:
        An :class:`AcontextAsyncClient` instance.
    session_id:
        Acontext session UUID. If ``None``, the session id will be discovered
        from the first ``SystemMessage`` with ``subtype == "init"``, or a new
        Acontext session will be created automatically.
    user:
        Optional user identifier string passed to ``sessions.create()``.
        Associates the Acontext session with this user.
    include_thinking:
        Whether to store ``ThinkingBlock`` content as native thinking blocks.
        Default ``False`` (omit thinking).
    on_error:
        Optional callback ``(exception, msg_dict) -> None`` invoked when
        ``store_message`` raises. If not provided, exceptions are logged
        and swallowed.
    """

    def __init__(
        self,
        client: AcontextAsyncClient,
        session_id: str | None = None,
        user: str | None = None,
        include_thinking: bool = False,
        on_error: Callable[[Exception, dict], None] | None = None,
    ) -> None:
        self._client = client
        self._session_id = session_id
        self._user = user
        self._include_thinking = include_thinking
        self._on_error = on_error
        self._session_ensured = False

    # -- properties ----------------------------------------------------------

    @property
    def session_id(self) -> str | None:
        """The current Acontext session id (may be ``None`` until resolved)."""
        return self._session_id

    # -- internal helpers ----------------------------------------------------

    def _try_update_session_id(self, msg: dict) -> None:
        """Update ``_session_id`` from *msg* if not already set."""
        if self._session_id is not None:
            return
        sid = get_session_id_from_message(msg)
        if sid:
            self._session_id = sid
            logger.debug("Resolved session_id=%s from message", sid)

    # -- public API ----------------------------------------------------------

    async def save_message(self, msg: Any) -> None:
        """Persist a single Claude Agent SDK message to Acontext.

        * ``UserMessage`` and ``AssistantMessage`` are stored.
          Errored ``AssistantMessage`` messages are stored when they
          have valid content; the ``error`` value is included in
          message ``meta`` for observability.
        * ``SystemMessage``, ``ResultMessage``, and ``StreamEvent`` are used
          only for session-id resolution and are **not** stored.
        * If ``session_id`` is unknown when a storable message arrives, the
          message is **skipped with a warning** (no exception raised).
        * API errors are caught and either forwarded to ``on_error`` or
          logged, so the caller's ``async for`` loop is never interrupted.
        """
        msg_dict = _to_dict(msg)

        # -- non-storable message types: update session_id only --------------
        if (
            _is_system_message(msg_dict)
            or _is_result_message(msg_dict)
            or _is_stream_event(msg_dict)
        ):
            self._try_update_session_id(msg_dict)
            return

        # -- storable: user or assistant -------------------------------------
        if _is_assistant_message(msg_dict):
            return await self._store_assistant(msg_dict)

        if _is_user_message(msg_dict):
            return await self._store_user(msg_dict)

        # Unknown message shape – ignore
        logger.debug("Ignoring unknown message shape: %s", list(msg_dict.keys()))

    # -- private store methods -----------------------------------------------

    async def _store_user(self, msg: dict) -> None:
        blob = claude_user_message_to_anthropic_blob(msg)
        if blob is None:
            logger.debug(
                "UserMessage produced empty content after conversion – skipping."
            )
            return

        await self._call_store(blob, meta=None)

    async def _store_assistant(self, msg: dict) -> None:
        blob, has_thinking = claude_assistant_message_to_anthropic_blob(
            msg, include_thinking=self._include_thinking
        )
        if blob is None:
            logger.debug(
                "AssistantMessage produced empty content after conversion – skipping."
            )
            return

        meta: dict[str, Any] = {}
        model = msg.get("model")
        if model:
            meta["model"] = model
        if has_thinking:
            meta["has_thinking"] = True
        error = msg.get("error")
        if error:
            meta["error"] = error

        await self._call_store(blob, meta=meta or None)

    async def _ensure_session(self) -> None:
        """Create the Acontext session if it hasn't been created yet.

        If ``_session_id`` is set, uses ``use_uuid`` so the Acontext session
        matches that id and ignores 409 Conflict (already exists).
        If ``_session_id`` is ``None``, lets Acontext generate the id and
        stores it back into ``_session_id``.
        """
        if self._session_ensured:
            return
        try:
            session = await self._client.sessions.create(
                use_uuid=self._session_id if self._session_id else None,
                user=self._user,
            )
            self._session_id = session.id
            logger.debug("Created Acontext session %s", self._session_id)
        except APIError as exc:
            if exc.status_code == 409:
                logger.debug(
                    "Session %s already exists (409) – continuing.",
                    self._session_id,
                )
            else:
                raise
        self._session_ensured = True

    async def _call_store(self, blob: dict, *, meta: dict[str, Any] | None) -> None:
        """Create session if needed, then call ``store_message`` with error resilience."""
        try:
            await self._ensure_session()
            await self._client.sessions.store_message(
                self._session_id,  # type: ignore[arg-type]
                blob=blob,
                format="anthropic",
                meta=meta,
            )
        except Exception as exc:
            if self._on_error is not None:
                self._on_error(exc, blob)
            else:
                logger.warning(
                    "Failed to store message (session=%s): %s",
                    self._session_id,
                    exc,
                    exc_info=True,
                )
