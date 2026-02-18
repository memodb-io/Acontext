from enum import StrEnum
from pydantic import BaseModel
from typing import Optional
from ..utils import asUUID


class TaskStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class TaskData(BaseModel):
    task_description: str
    progresses: Optional[list[str]] = None
    user_preferences: Optional[list[str]] = None


class TaskSchema(BaseModel):
    id: asUUID
    session_id: asUUID

    order: int
    status: TaskStatus
    data: TaskData
    raw_message_ids: list[asUUID]

    def to_string(self) -> str:
        base = f"Task {self.order}: {self.data.task_description} (Status: {self.status})"
        if self.data.user_preferences and len(self.data.user_preferences) > 0:
            prefs = " | ".join(self.data.user_preferences)
            base += f' | User Prefs: "{prefs}"'
        return base
