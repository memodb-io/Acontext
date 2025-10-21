from pydantic import BaseModel
from typing import List, Optional, Any
from ..utils import asUUID


class SOPStep(BaseModel):
    tool_name: str
    goal: str
    action: str


class SOPData(BaseModel):
    use_when: str
    notes: str
    tool_sops: List[SOPStep]


class SOPBlock(SOPData):
    id: asUUID
    space_id: asUUID
