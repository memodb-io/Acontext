from pydantic import BaseModel
from typing import Optional
from ..utils import asUUID
from ..block.sop_block import SOPData


class SOPComplete(BaseModel):
    project_id: asUUID
    space_id: asUUID
    sop_data: SOPData
    task_id: Optional[asUUID] = None
