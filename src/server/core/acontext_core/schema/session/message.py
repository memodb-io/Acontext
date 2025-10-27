import json
from pydantic import BaseModel
from typing import List, Optional
from ..orm import Part, ToolCallMeta
from ..utils import asUUID

STRING_TYPES = {"text", "tool-call", "tool-result"}

ROLE_REPLACE_NAME = {"assistant": "agent"}


def pack_part_line(role: str, part: Part, truncate_chars: int = None) -> str:
    role = ROLE_REPLACE_NAME.get(role, role)
    header = f"<{role}>({part.type})"
    if part.type not in STRING_TYPES:
        r = f"{header} [file: {part.filename}]"
    elif part.type == "text":
        r = f"{header} {part.text}"
    elif part.type == "tool-call":
        tool_call_meta = ToolCallMeta(**part.meta)
        tool_data = json.dumps(
            {
                "tool_name": tool_call_meta.tool_name,
                "arguments": tool_call_meta.arguments,
            }
        )
        r = f"{header} {tool_data}"
    else:
        raise TypeError(f"Unknown message part type: {part.type}")
    if truncate_chars is None or len(r) < truncate_chars:
        return r
    return r[:truncate_chars] + "[...truncated]"


class MessageBlob(BaseModel):
    message_id: asUUID
    role: str
    parts: List[Part]
    task_id: Optional[asUUID] = None

    def to_string(self, truncate_chars: int = None, **kwargs) -> str:
        lines = [
            pack_part_line(self.role, p, truncate_chars=truncate_chars, **kwargs)
            for p in self.parts
        ]
        return "\n".join(lines)
