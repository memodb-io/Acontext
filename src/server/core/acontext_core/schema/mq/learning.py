import re
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, field_validator
from ..utils import asUUID
from ...env import LOG


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

    @field_validator("original_date")
    @classmethod
    def validate_original_date(cls, v, info):
        if v is None:
            return v

        session_id = info.data.get("session_id")

        # ISO format: YYYY-MM-DD
        try:
            date.fromisoformat(v)
            return v
        except ValueError:
            pass

        # Slash format: YYYY/MM/DD (Weekday) HH:MM
        if re.match(r"^\d{4}/\d{2}/\d{2} \(\w+\) \d{2}:\d{2}$", v):
            try:
                datetime.strptime(v[:10], "%Y/%m/%d")
                return v
            except ValueError:
                pass

        # Validation failed - log warning before raising error
        LOG.warning(
            "skill_learner.original_date_validation_failed",
            session_id=str(session_id) if session_id else None,
            original_date=v,
        )

        raise ValueError(
            "original_date must be 'YYYY-MM-DD' or 'YYYY/MM/DD (Day) HH:MM', "
            f"got: {v!r}"
        )
