from dataclasses import dataclass
from ....schema.block.path_node import PathNode
from ....infra.db import AsyncSession
from ....schema.utils import asUUID


@dataclass
class SpaceCtx:
    db_session: AsyncSession
    project_id: asUUID
    space_id: asUUID
    candidate_data: list[dict]
    path_2_block_ids: dict[str, PathNode | None]
