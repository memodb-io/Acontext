from dataclasses import dataclass
from ....schema.block.path_node import PathNode
from ....schema.result import Result
from ....infra.db import AsyncSession
from ....schema.utils import asUUID
from ....service.data import block_nav as BN


@dataclass
class SpaceCtx:
    db_session: AsyncSession
    project_id: asUUID
    space_id: asUUID
    candidate_data: list[dict]
    already_inserted_candidate_data: list[int]
    path_2_block_ids: dict[str, PathNode | None]

    async def find_block(self, path: str) -> Result[PathNode]:
        if path in self.path_2_block_ids:
            return Result.resolve(self.path_2_block_ids[path])
        r = await BN.find_block_by_path(self.db_session, self.space_id, path)
        if not r.ok():
            return r
        self.path_2_block_ids[path] = r.data
        return Result.resolve(r.data)

    async def find_path_by_id(self, block_id: asUUID) -> Result[tuple[str, PathNode]]:
        r = await BN.get_path_info_by_id(self.db_session, self.space_id, block_id)
        if not r.ok():
            return r
        path, path_node = r.data
        # update path cache
        self.path_2_block_ids[path] = path_node
        return Result.resolve((path, path_node))
