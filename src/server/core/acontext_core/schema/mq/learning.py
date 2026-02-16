from pydantic import BaseModel
from ..utils import asUUID


class SkillLearnTask(BaseModel):
    project_id: asUUID
    session_id: asUUID
    task_id: asUUID
