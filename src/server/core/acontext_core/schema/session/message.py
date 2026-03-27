import json
from pydantic import BaseModel
from typing import List, Optional
from ..orm import Part, ToolCallMeta, ToolResultMeta
from ...env import LOG
from ..utils import asUUID

STRING_TYPES = {"text", "tool-call", "tool-result"}

ROLE_REPLACE_NAME = {"assistant": "agent"}


def pack_part_line(
    role: str,
    part: Part,
    tool_mapping: dict[str, ToolCallMeta],
    truncate_chars: int = None,
) -> str:
    role = ROLE_REPLACE_NAME.get(role, role)
    header = f"<{role}>({part.type})"
    if part.type not in STRING_TYPES:
        r = f"{header} [file: {part.filename}]"
    elif part.type == "text":
        r = f"{header} {part.text}"
    elif part.type == "tool-call":
        tool_call_meta = ToolCallMeta(**part.meta)
        if (
            isinstance(tool_call_meta.arguments, str)
            and tool_call_meta.arguments.strip() != ""
        ):
            arguments = json.loads(tool_call_meta.arguments)
        else:
            arguments = tool_call_meta.arguments

        tool_data = json.dumps(
            {
                "tool_name": tool_call_meta.name,
                "arguments": arguments,
            }
        )
        if tool_call_meta.id is not None:
            tool_mapping[tool_call_meta.id] = tool_call_meta
        r = f"{header} {tool_data}"
    elif part.type == "tool-result":
        tool_result_meta = ToolResultMeta(**part.meta)
        if tool_result_meta.tool_call_id not in tool_mapping:
            tool_data = json.dumps(
                {
                    "result": part.text,
                }
            )
        else:
            tool_data = tool_mapping[tool_result_meta.tool_call_id]
            tool_data = json.dumps(
                {
                    "tool_name": tool_data.name,
                    "result": part.text,
                }
            )
        r = f"{header} {tool_data}"
    else:
        LOG.warning(f"Unknown message part type: {part.type}")
        r = f"{header} {part.text} {part.meta}"
    if truncate_chars is None or len(r) < truncate_chars:
        return r
    return r[:truncate_chars] + "[...truncated]"


class MessageBlob(BaseModel):
    message_id: asUUID
    parent_id: Optional[asUUID] = None
    role: str
    parts: List[Part]
    task_id: Optional[asUUID] = None

    def to_string(
        self,
        tool_mapping: dict[str, ToolCallMeta],
        truncate_chars: int = None,
        **kwargs,
    ) -> str:
        lines = [
            pack_part_line(
                self.role, p, tool_mapping, truncate_chars=truncate_chars, **kwargs
            )
            for p in self.parts
        ]
        return "\n".join(lines)
