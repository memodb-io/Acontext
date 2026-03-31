from typing import Optional
from pydantic import BaseModel
from ..utils import asUUID


class SkillLearnTask(BaseModel):
    project_id: asUUID
    session_id: asUUID
    task_id: asUUID
    user_kek: Optional[str] = None  # base64-encoded user KEK


class SkillLearnDistilled(BaseModel):
    """Published by distillation consumer, consumed by skill agent consumer."""

    project_id: asUUID
    session_id: asUUID
    task_id: asUUID
    learning_space_id: asUUID
    distilled_context: str
    user_kek: Optional[str] = None  # base64-encoded user KEK (pass through)
    original_date: Optional[str] = None  # ISO date string from session.configs
