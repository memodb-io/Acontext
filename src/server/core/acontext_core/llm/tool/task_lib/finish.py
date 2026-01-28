from ..base import Tool
from ....schema.llm import ToolSchema


_finish_tool = Tool().use_schema(
    ToolSchema(
        function={
            "name": "finish",
            "description": "Call it when you have completed the actions for task management.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        }
    )
)
