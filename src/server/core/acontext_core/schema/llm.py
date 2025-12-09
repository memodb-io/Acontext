from pydantic import BaseModel
from typing import Literal, Optional, Any


class FunctionSchema(BaseModel):
    name: str
    description: str
    parameters: dict


class ToolSchema(BaseModel):
    function: FunctionSchema
    type: Literal["function"] = "function"


class LLMFunction(BaseModel):
    name: str
    arguments: dict[str, Any]


class LLMToolCall(BaseModel):
    id: str
    function: Optional[LLMFunction] = None
    type: Literal["function"]


class LLMResponse(BaseModel):
    role: Literal["user", "assistant", "tool"]
    raw_response: BaseModel

    content: Optional[str] = None
    json_content: Optional[dict] = None
    tool_calls: Optional[list[LLMToolCall]] = None
