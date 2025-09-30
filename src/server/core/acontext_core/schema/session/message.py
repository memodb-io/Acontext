from pydantic import BaseModel
from typing import List, Optional
from ..orm import Part, ToolCallMeta
from ..utils import asUUID

STRING_TYPES = {"text", "tool-call", "tool-result"}

REPLACE_NAME = {
    "assistant": "agent",
    "tool": "agent_action",
    "tool-result": "agent_action_result",
    "function": "agent_action",
}


def pack_part_line(role: str, part: Part) -> str:
    role = REPLACE_NAME.get(role, role)
    if part.type not in STRING_TYPES:
        return f"<{role}> [{part.type} file: {part.filename}]"
    elif part.type == "text":
        return f"<{role}> {part.text}"
    elif part.type == "tool-call":
        tool_call_meta = ToolCallMeta(**part.meta)
        return f"<{role}> USE TOOL {tool_call_meta.tool_name}, WITH PARAMS {tool_call_meta.arguments}"
    else:
        raise TypeError(f"Unknown message part type: {part.type}")


class MessageBlob(BaseModel):
    message_id: asUUID
    role: str
    parts: List[Part]
    task_id: Optional[asUUID] = None

    def to_string(self, truncate_chars: int = None, **kwargs) -> str:
        lines = [pack_part_line(self.role, p, **kwargs) for p in self.parts]
        r = "\n".join(lines)
        if truncate_chars is None or len(r) < truncate_chars:
            return r
        return r[:truncate_chars] + "[...truncated]"
