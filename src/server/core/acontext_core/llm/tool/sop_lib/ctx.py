from dataclasses import dataclass
from ....infra.db import AsyncSession
from ....schema.utils import asUUID
from ....schema.session.task import TaskSchema


@dataclass
class SOPCtx:
    project_id: asUUID
    space_id: asUUID
    task: TaskSchema
