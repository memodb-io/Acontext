from dataclasses import dataclass
from ....infra.db import AsyncSession
from ....schema.utils import asUUID


@dataclass
class SOPCtx:
    db_session: AsyncSession
    project_id: asUUID
    session_id: asUUID
