class BaseContext:
    pass


class BaseConverter:
    def to_openai_tool_schema(self) -> dict:
        raise NotImplementedError

    def to_anthropic_tool_schema(self) -> dict:
        raise NotImplementedError


class BaseTool(BaseConverter):
    @property
    def name(self) -> str:
        raise NotImplementedError

    @property
    def description(self) -> str:
        raise NotImplementedError

    @property
    def arguments(self) -> dict:
        raise NotImplementedError

    @property
    def required_arguments(self) -> list[str]:
        raise NotImplementedError

    def execute(self, ctx: BaseContext, llm_arguments: dict) -> str:
        raise NotImplementedError

    def to_openai_tool_schema(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": self.arguments,
                    "required": self.required_arguments,
                },
            },
        }

    def to_anthropic_tool_schema(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": {
                "type": "object",
                "properties": self.arguments,
                "required": self.required_arguments,
            },
        }


class BaseToolPool(BaseConverter):
    def __init__(self):
        self.tools: dict[str, BaseTool] = {}

    def add_tool(self, tool: BaseTool):
        self.tools[tool.name] = tool

    def remove_tool(self, tool_name: str):
        self.tools.pop(tool_name)

    def extent_tool_pool(self, pool: "BaseToolPool"):
        self.tools.update(pool.tools)

    def execute_tool(
        self, ctx: BaseContext, tool_name: str, llm_arguments: dict
    ) -> str:
        tool = self.tools[tool_name]
        r = tool.execute(ctx, llm_arguments)
        return r.strip()

    def tool_exists(self, tool_name: str) -> bool:
        return tool_name in self.tools

    def to_openai_tool_schema(self) -> list[dict]:
        return [tool.to_openai_tool_schema() for tool in self.tools.values()]

    def to_anthropic_tool_schema(self) -> list[dict]:
        return [tool.to_anthropic_tool_schema() for tool in self.tools.values()]

    def format_context(self, *args, **kwargs) -> BaseContext:
        raise NotImplementedError
