from typing import Any
from ....infra.db import AsyncSession
from ..base import Tool, ToolPool
from ....schema.llm import ToolSchema
from ....schema.utils import asUUID
from ....schema.result import Result
from ....schema.orm import Task
from ....service.data import task as TD
from ....env import LOG


_finish_tool = Tool().use_schema(
    ToolSchema(
        function={
            "name": "finish",
            "description": "Call it when you have completed everything you need to do in this workspace.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        }
    )
)
