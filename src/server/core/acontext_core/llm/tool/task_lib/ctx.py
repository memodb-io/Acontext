from dataclasses import dataclass, field
from ....infra.db import AsyncSession
from ....schema.utils import asUUID
from ....schema.session.task import TaskSchema


@dataclass
class TaskCtx:
    db_session: AsyncSession
    project_id: asUUID
    session_id: asUUID
    task_ids_index: list[asUUID]
    task_index: list[TaskSchema]
    message_ids_index: list[asUUID]
    message_parent_ids_index: list[asUUID | None] = field(default_factory=list)
    branch_root_message_id: asUUID | None = None
    branch_leaf_message_id: asUUID | None = None
    learning_task_ids: list[asUUID] = field(default_factory=list)
    pending_preferences: list[str] = field(default_factory=list)
