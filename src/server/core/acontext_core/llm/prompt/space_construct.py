from sqlalchemy.sql.functions import user
from .base import BasePrompt, ToolSchema
from ..tool.space_tools import SPACE_TOOLS


class SpaceConstructPrompt(BasePrompt):
    @classmethod
    def system_prompt(cls) -> str:
        return """You're a Notion Manager Agent that manages pages/folders and blocks for user to organize its knowledge.
"""

    @classmethod
    def pack_task_input(cls) -> str:
        return ""

    @classmethod
    def prompt_kwargs(cls) -> str:
        return {"prompt_id": "agent.space.construct"}

    @classmethod
    def tool_schema(cls) -> list[ToolSchema]:
        return [
            SPACE_TOOLS["ls"].schema,
            SPACE_TOOLS["create_page"].schema,
            SPACE_TOOLS["create_folder"].schema,
            SPACE_TOOLS["report_thinking"].schema,
        ]
