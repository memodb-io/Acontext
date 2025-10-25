from pydantic import BaseModel, Field
from typing import List, Optional, Any
from ..utils import asUUID


class SOPStep(BaseModel):
    tool_name: str = Field(
        ...,
        description="exact corresponding tool name from history",
    )
    action: str = Field(
        ...,
        description="only describe necessary arguments' VALUEs to proceed the SOP. If not arguments are needed, an empty string is expected.",
    )


class SOPData(BaseModel):
    use_when: str = Field(
        ...,
        description="The scenario when this sop maybe used, e.g. 'Broswering xxx.com for items' infos', 'Query Lung disease from Database'",
    )
    notes: str = Field(
        ...,
        description="An brief guideline to instruct how to proceed this SOP, containing user requirements, tool-use annotations.",
    )
    tool_sops: List[SOPStep]


class SOPBlock(SOPData):
    id: asUUID
    space_id: asUUID
