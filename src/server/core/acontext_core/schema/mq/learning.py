from pydantic import BaseModel
from ..utils import asUUID


class SkillLearnTask(BaseModel):
    project_id: asUUID
    session_id: asUUID
    task_id: asUUID


class SkillLearnDistilled(BaseModel):
    """Published by distillation consumer, consumed by skill agent consumer."""

    project_id: asUUID
    session_id: asUUID
    task_id: asUUID
    learning_space_id: asUUID
    distilled_context: str
