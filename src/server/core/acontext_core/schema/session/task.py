from enum import StrEnum
from pydantic import BaseModel
from ..utils import asUUID


class TaskStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class TaskSchema(BaseModel):
    session_id: asUUID

    task_order: int
    task_name: str
    task_description: str
    task_status: TaskStatus
    raw_message_ids: list[asUUID]
