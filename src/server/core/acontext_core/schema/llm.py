from pydantic import BaseModel, field_validator
from typing import Literal, Optional, Any
from copy import deepcopy


def _flatten_json_schema(schema: dict) -> dict:
    """
    Recursively expand all $ref references in a JSON Schema.

    This ensures compatibility with LLM providers that don't support $ref/$defs
    (e.g., Gemini). The inlined format is semantically equivalent and universally
    compatible across all providers.
    """
    schema = deepcopy(schema)
    defs = schema.pop("$defs", {})

    def resolve_refs(obj):
        if isinstance(obj, dict):
            if "$ref" in obj:
                ref_name = obj["$ref"].split("/")[-1]
                return resolve_refs(deepcopy(defs.get(ref_name, {})))
            return {k: resolve_refs(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [resolve_refs(item) for item in obj]
        return obj

    return resolve_refs(schema)


class FunctionSchema(BaseModel):
    name: str
    description: str
    parameters: dict

    @field_validator("parameters", mode="before")
    @classmethod
    def flatten_parameters(cls, v: dict) -> dict:
        """Flatten $ref/$defs in parameters to ensure LLM provider compatibility."""
        return _flatten_json_schema(v)


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
