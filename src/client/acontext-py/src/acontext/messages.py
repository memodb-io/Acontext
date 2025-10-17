"""
Support for constructing session messages.
"""

from dataclasses import dataclass
from typing import Any, BinaryIO, Mapping, MutableMapping, Sequence, Tuple

from .uploads import FileUpload, normalize_file_upload


@dataclass(slots=True)
class MessagePart:
    """
    Represents a single message part for ``/session/{id}/messages``.

    Args:
        type: One of ``text``, ``image``, ``audio``, ``video``, ``file``, ``tool-call``,
            ``tool-result`` or ``data``.
        text: Optional textual payload for ``text`` parts.
        meta: Optional metadata dictionary accepted by the API.
        file: Optional file attachment; required for binary part types.
        file_field: Optional field name to use in the multipart body. When omitted the
            client will auto-generate deterministic field names.
    """

    type: str
    text: str | None = None
    meta: Mapping[str, Any] | None = None
    file: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None] | None = None
    file_field: str | None = None

    @classmethod
    def text_part(cls, text: str, *, meta: Mapping[str, Any] | None = None) -> "MessagePart":
        return cls(type="text", text=text, meta=meta)

    @classmethod
    def file_part(
        cls,
        upload: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None],
        *,
        meta: Mapping[str, Any] | None = None,
        type: str = "file",
    ) -> "MessagePart":
        return cls(type=type, file=upload, meta=meta)


def normalize_message_part(part: MessagePart | str | Mapping[str, Any]) -> MessagePart:
    if isinstance(part, MessagePart):
        return part
    if isinstance(part, str):
        return MessagePart(type="text", text=part)
    if isinstance(part, Mapping):
        if "type" not in part:
            raise ValueError("mapping message parts must include a 'type'")
        file = part.get("file")
        normalized_file: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None] | None
        if file is None:
            normalized_file = None
        else:
            normalized_file = file  # type: ignore[assignment]
        return MessagePart(
            type=str(part["type"]),
            text=part.get("text"),
            meta=part.get("meta"),
            file=normalized_file,
            file_field=part.get("file_field"),
        )
    raise TypeError("unsupported message part type")


def build_message_payload(
    parts: Sequence[MessagePart | str | Mapping[str, Any]],
) -> tuple[list[MutableMapping[str, Any]], dict[str, Tuple[str, BinaryIO, str | None]]]:
    payload_parts: list[MutableMapping[str, Any]] = []
    files: dict[str, Tuple[str, BinaryIO, str | None]] = {}

    for idx, raw_part in enumerate(parts):
        part = normalize_message_part(raw_part)
        payload: MutableMapping[str, Any] = {"type": part.type}

        if part.meta is not None:
            payload["meta"] = dict(part.meta)
        if part.text is not None:
            payload["text"] = part.text

        if part.file is not None:
            upload = normalize_file_upload(part.file)
            field_name = part.file_field or f"file_{idx}"
            payload["file_field"] = field_name
            files[field_name] = upload.as_httpx()

        payload_parts.append(payload)

    return payload_parts, files
