from dataclasses import dataclass
from typing import Callable, Any, Awaitable
from ...schema.llm import ToolSchema
from ...schema.result import Result


@dataclass
class Tool:
    schema: ToolSchema = None
    handler: Callable[..., Awaitable[Result[str]]] = None

    def use_schema(self, schema: ToolSchema) -> "Tool":
        self.schema = schema
        return self

    def use_handler(self, handler: Callable[..., Awaitable[Result[str]]]) -> "Tool":
        return self


ToolPool = dict[str, Tool]
