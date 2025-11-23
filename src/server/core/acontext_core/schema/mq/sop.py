from pydantic import BaseModel
from ..utils import asUUID
from ..block.sop_block import SOPData


class SOPComplete(BaseModel):
    project_id: asUUID
    space_id: asUUID
    task_id: asUUID
    sop_data: SOPData
