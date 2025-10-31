"""
Support for constructing session messages.
"""

from collections.abc import Mapping, MutableMapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal

@dataclass(slots=True)
class MessagePart:
    """
    Represents a single message part for ``/session/{id}/messages``.

    Args:
        type: One of ``text``, ``image``, ``audio``, ``video``, ``file``, ``tool-call``,
            ``tool-result`` or ``data``.
        text: Optional textual payload for ``text`` parts.
        meta: Optional metadata dictionary accepted by the API.
        file_field: Optional field name to use in the multipart body. When omitted the
            client will auto-generate deterministic field names.
    """

    type: str
    text: str | None = None
    meta: Mapping[str, Any] | None = None
    file_field: str | None = None

    @classmethod
    def text_part(cls, text: str, *, meta: Mapping[str, Any] | None = None) -> "MessagePart":
        return cls(type="text", text=text, meta=meta)
    
    @classmethod
    def file_field_part(cls, file_field: str, *, meta: Mapping[str, Any] | None = None) -> "MessagePart":
        return cls(type="file", file_field=file_field, meta=meta)

@dataclass(slots=True)
class AcontextMessage:
    """
    Represents an Acontext-format message payload.
    """

    role: Literal["user", "assistant", "system"]
    parts: list[MessagePart]
    meta: MutableMapping[str, Any] | None = None


def build_acontext_message(
    *,
    role: Literal["user", "assistant", "system"],
    parts: Sequence[MessagePart | str | Mapping[str, Any]],
    meta: Mapping[str, Any] | None = None,
) -> AcontextMessage:
    """
    Construct an Acontext-format message blob and associated multipart files.
    """
    if role not in {"user", "assistant", "system"}:
        raise ValueError("role must be one of {'user', 'assistant', 'system'}")

    normalized_parts = [normalize_message_part(part) for part in parts]

    message = AcontextMessage(
        role=role,
        parts=normalized_parts,
        meta=dict(meta) if meta is not None else None,
    )
    return message


def normalize_message_part(part: MessagePart | str | Mapping[str, Any]) -> MessagePart:
    if isinstance(part, MessagePart):
        return part
    if isinstance(part, str):
        return MessagePart(type="text", text=part)
    if isinstance(part, Mapping):
        if "type" not in part:
            raise ValueError("mapping message parts must include a 'type'")
        return MessagePart(
            type=str(part["type"]),
            text=part.get("text"),
            meta=part.get("meta"),
            file_field=part.get("file_field"),
        )
    raise TypeError("unsupported message part type")
