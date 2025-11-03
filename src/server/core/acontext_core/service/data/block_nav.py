from pathlib import Path
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
from ...schema.block.path_node import PathNode
from ...schema.utils import asUUID
from ...schema.result import Result
from ...schema.block.sop_block import SOPData


async def assert_block_type(
    db_session: AsyncSession, space_id: asUUID, block_id: asUUID, block_type: str
) -> Result[None]:
    query = (
        select(Block.type).where(Block.space_id == space_id).where(Block.id == block_id)
    )
    result = await db_session.execute(query)
    par_type = result.mappings().one_or_none()
    if par_type is None:
        return Result.reject(f"Block {block_id} not found")
    if par_type["type"] != block_type:
        return Result.reject(
            f"Block {block_id}(type {par_type['type']}) is not a {block_type}"
        )
    return Result.resolve(None)


async def fetch_path_children_by_id(
    db_session: AsyncSession, space_id: asUUID, block_id: asUUID
) -> Result[List[dict]]:
    if block_id is not None:
        r = await assert_block_type(db_session, space_id, block_id, BLOCK_TYPE_FOLDER)
        if not r.ok():
            return r
    query = (
        select(Block.id, Block.title, Block.type)
        .where(Block.space_id == space_id)
        .where(
            Block.parent_id == block_id,
            Block.type.in_([BLOCK_TYPE_FOLDER, BLOCK_TYPE_PAGE]),
        )
    )
    result = await db_session.execute(query)
    blocks = result.mappings().all()
    blocks = [
        {"id": block["id"], "title": block["title"], "type": block["type"]}
        for block in blocks
    ]
    return Result.resolve(blocks)


async def list_paths_under_block(
    db_session: AsyncSession,
    space_id: asUUID,
    block_id: Optional[asUUID] = None,
    path_prefix: str = "",
    depth: int = 0,
) -> Result[tuple[dict[str, PathNode], int, int]]:
    if path_prefix and not path_prefix.endswith("/"):
        path_prefix += "/"
    # 2. list all page and folder block
    r = await fetch_path_children_by_id(db_session, space_id, block_id)
    if not r.ok():
        return r
    blocks = r.data

    path_dict: dict[str, asUUID] = {}
    sub_page_num = sum([1 for block in blocks if block["type"] == BLOCK_TYPE_PAGE])
    sub_folder_num = sum([1 for block in blocks if block["type"] == BLOCK_TYPE_FOLDER])
    if depth < 0:
        # don't list acutally path, only return some static information
        return Result.resolve((path_dict, sub_page_num, sub_folder_num))
    # 3. build path dictionary
    for block in blocks:
        if block["type"] == BLOCK_TYPE_PAGE:
            path_dict[f"{path_prefix}{block['title']}"] = PathNode(
                id=block["id"],
                title=block["title"],
                type=block["type"],
            )
        # Recursively fetch paths for folder blocks
        elif block["type"] == BLOCK_TYPE_FOLDER:
            r = await list_paths_under_block(
                db_session,
                space_id,
                block["id"],
                path_prefix=f"{path_prefix}{block['title']}/",
                depth=depth - 1,
            )
            if not r.ok():
                return r

            path_dict.update(r.data[0])
            path_dict[f"{path_prefix}{block['title']}/"] = PathNode(
                id=block["id"],
                title=block["title"],
                type=block["type"],
                sub_page_num=r.data[1],
                sub_folder_num=r.data[2],
            )
        else:
            raise ValueError(f"Invalid block type: {block['type']}")

    return Result.resolve((path_dict, sub_page_num, sub_folder_num))
