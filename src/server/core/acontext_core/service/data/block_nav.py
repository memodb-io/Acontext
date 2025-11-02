from sqlalchemy import String
from typing import List, Optional
from sqlalchemy import select, delete, update, func
from sqlalchemy import select, delete, update
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.ext.asyncio import AsyncSession
from ...schema.orm.block import (
    BLOCK_TYPE_FOLDER,
    BLOCK_TYPE_PAGE,
    BLOCK_TYPE_SOP,
    BLOCK_TYPE_TEXT,
)
from ...schema.orm import Block, ToolReference, ToolSOP, Space
from ...schema.utils import asUUID
from ...schema.result import Result
from ...schema.block.sop_block import SOPData


async def find_block_by_path(
    db_session: AsyncSession,
    space_id: asUUID,
    path: str,
) -> Result[Block]:
    pass


async def list_paths_under_block(
    db_session: AsyncSession, space_id: asUUID, block_id: asUUID
):
    pass
