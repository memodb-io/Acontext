from dataclasses import dataclass


@dataclass
class BaseContext:
    pass


class BaseTool:

    def to_openai_json_schema(self) -> dict:
        raise NotImplementedError

    def to_anthropic_json_schema(self) -> dict:
        raise NotImplementedError

    def execute(self, ctx: BaseContext, llm_arguments: dict) -> str:
        raise NotImplementedError


class BaseToolPool:
    def add_tool(self, tool: BaseTool):
        raise NotImplementedError

    def extent_tool_pook(self, pool: "BaseToolPool"):
        raise NotImplementedError

    def execute_tool(self, tool_name: str, llm_arguments: dict) -> str:
        raise NotImplementedError

    def tool_exists(self, tool_name: str) -> bool:
        raise NotImplementedError
