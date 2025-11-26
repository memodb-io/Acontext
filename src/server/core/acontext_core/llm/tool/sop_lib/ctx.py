from dataclasses import dataclass
from ....schema.utils import asUUID
from ....schema.session.task import TaskSchema


@dataclass
class SOPCtx:
    project_id: asUUID
    enable_user_confirmation_on_new_experiences: bool
    space_id: asUUID
    task: TaskSchema
