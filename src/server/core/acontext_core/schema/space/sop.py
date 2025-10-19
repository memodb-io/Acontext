from pydantic import BaseModel
from typing import List, Any


class SingleToolCallingSOP(BaseModel):
    name: str
    arguments: dict[str, Any]


class ToolCallingSOPs(BaseModel):
    detailed_description: str
    tool_calling_sops: List[SingleToolCallingSOP]
