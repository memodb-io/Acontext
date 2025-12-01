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

    def execute(self, ctx: BaseContext, llm_arguments: dict) -> str:
        raise NotImplementedError


class BaseToolPool(BaseConverter):
    def __init__(self):
        self.tools: dict[str, BaseTool] = {}

    def add_tool(self, tool: BaseTool):
        self.tools[tool.name] = tool

    def extent_tool_pool(self, pool: "BaseToolPool"):
        self.tools.update(pool.tools)

    def execute_tool(
        self, ctx: BaseContext, tool_name: str, llm_arguments: dict
    ) -> str:
        tool = self.tools[tool_name]
        return tool.execute(ctx, llm_arguments)

    def tool_exists(self, tool_name: str) -> bool:
        return tool_name in self.tools

    def to_openai_tool_schema(self) -> list[dict]:
        return [tool.to_openai_tool_schema() for tool in self.tools.values()]

    def to_anthropic_tool_schema(self) -> list[dict]:
        return [tool.to_anthropic_tool_schema() for tool in self.tools.values()]

    def form_context(self, *args, **kwargs) -> BaseContext:
        raise NotImplementedError
