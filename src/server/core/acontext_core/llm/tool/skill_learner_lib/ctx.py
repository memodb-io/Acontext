from dataclasses import dataclass, field
from typing import Optional
from ....infra.db import AsyncSession
from ....schema.utils import asUUID
from ....service.data.learning_space import SkillInfo


@dataclass
class SkillLearnerCtx:
    db_session: AsyncSession
    project_id: asUUID
    learning_space_id: asUUID
    user_id: Optional[asUUID]
    skills: dict[str, SkillInfo] = field(default_factory=dict)
    has_reported_thinking: bool = False
