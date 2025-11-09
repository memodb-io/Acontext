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
    CONTENT_BLOCK,
)
from ...schema.orm import Block, ToolReference, ToolSOP, Space
from ...schema.block.path_node import PathNode
from ...schema.utils import asUUID
from ...schema.result import Result
from ...schema.block.sop_block import SOPData


def _normalize_path_block_title(title: str) -> str:
    title = title.replace("/", "_")
    title = title.replace(" ", "_")
    return title


def path_to_parts(path: str) -> List[str]:
    path_parts = path.strip("/").split("/")
    path_parts = [
        _normalize_path_block_title(part.strip()) for part in path_parts if part.strip()
    ]
    return path_parts


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
        select(Block.id, Block.title, Block.type, Block.props)
        .where(Block.space_id == space_id)
        .where(
            Block.parent_id == block_id,
            Block.type.in_([BLOCK_TYPE_FOLDER, BLOCK_TYPE_PAGE]),
        )
    )
    result = await db_session.execute(query)
    blocks = result.mappings().all()
    blocks = [
        {
            "id": block["id"],
            "title": block["title"],
            "type": block["type"],
            "props": block["props"],
        }
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
                props=block["props"],
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
                props=block["props"],
                sub_page_num=r.data[1],
                sub_folder_num=r.data[2],
            )
        else:
            raise ValueError(f"Invalid block type: {block['type']}")

    return Result.resolve((path_dict, sub_page_num, sub_folder_num))


async def find_block_by_path(
    db_session: AsyncSession,
    space_id: asUUID,
    abs_path: str,
) -> Result[PathNode | None]:
    path_parts = path_to_parts(abs_path)
    if not len(path_parts):  # root
        return Result.resolve(None)

    parent_id = None
    for part in path_parts:
        query = (
            select(Block.id, Block.type, Block.title, Block.props)
            .where(Block.space_id == space_id, Block.parent_id == parent_id)
            .where(Block.title == part)
            .where(Block.type.in_([BLOCK_TYPE_FOLDER, BLOCK_TYPE_PAGE]))
        )
        result = await db_session.execute(query)
        block = result.mappings().one_or_none()
        if block is None:
            return Result.reject(f"Path {abs_path} not found")
        parent_id = block["id"]
    if block["type"] == BLOCK_TYPE_PAGE:
        return Result.resolve(
            PathNode(
                id=block["id"],
                title=block["title"],
                type=block["type"],
                props=block["props"],
            )
        )
    if block["type"] == BLOCK_TYPE_FOLDER:
        r = await list_paths_under_block(db_session, space_id, block["id"], depth=-1)
        if not r.ok():
            return r
        _, sub_page_num, sub_folder_num = r.data
        return Result.resolve(
            PathNode(
                id=block["id"],
                title=block["title"],
                type=block["type"],
                props=block["props"],
                sub_page_num=sub_page_num,
                sub_folder_num=sub_folder_num,
            )
        )
    # unknown branch
    raise ValueError(f"Invalid block type: {block['type']}")


async def recover_path_by_id(
    db_session: AsyncSession,
    space_id: asUUID,
    block_id: asUUID,
    add_folder_slash: bool = False,
) -> Result[str]:
    path_parts = []
    while block_id is not None:
        query = select(Block.id, Block.title, Block.parent_id).where(
            Block.space_id == space_id, Block.id == block_id
        )
        result = await db_session.execute(query)
        block = result.mappings().one_or_none()
        if block is None:
            return Result.reject(f"Unknown block {block_id}")
        path_parts.append(block["title"])
        block_id: Optional[asUUID] = block["parent_id"]
    base = "/" + "/".join(path_parts[::-1])
    if add_folder_slash:
        return Result.resolve(base.rstrip("/") + "/")
    return Result.resolve(base)


async def get_path_info_by_id(
    db_session: AsyncSession, space_id: asUUID, block_id: asUUID
) -> Result[tuple[str, PathNode]]:
    query = select(Block.id, Block.type, Block.title, Block.props).where(
        Block.space_id == space_id, Block.id == block_id
    )
    result = await db_session.execute(query)
    block = result.mappings().one_or_none()
    if block is None:
        return Result.reject(f"Block {block_id} not found")
    if block["type"] == BLOCK_TYPE_PAGE:
        pn = PathNode(
            id=block["id"],
            title=block["title"],
            type=block["type"],
            props=block["props"],
        )
        r = await recover_path_by_id(db_session, space_id, block["id"])
        if not r.ok():
            return r
        return Result.resolve((r.data, pn))
    elif block["type"] == BLOCK_TYPE_FOLDER:
        r = await list_paths_under_block(db_session, space_id, block["id"], depth=-1)
        if not r.ok():
            return r
        _, sub_page_num, sub_folder_num = r.data
        pn = PathNode(
            id=block["id"],
            title=block["title"],
            type=block["type"],
            props=block["props"],
            sub_page_num=sub_page_num,
            sub_folder_num=sub_folder_num,
        )
        r = await recover_path_by_id(
            db_session, space_id, block["id"], add_folder_slash=True
        )
        if not r.ok():
            return r
        return Result.resolve((r.data, pn))
    else:
        return Result.reject(f"Invalid path block type: {block['type']}")


async def read_blocks_from_par_id(
    db_session: AsyncSession,
    space_id: asUUID,
    block_id: asUUID,
    allowed_types: set[str] = CONTENT_BLOCK,
) -> Result[List[Block]]:
    query = (
        select(Block)
        .where(Block.space_id == space_id, Block.parent_id == block_id)
        .where(Block.type.in_(allowed_types))
        .order_by(Block.sort)
    )
    result = await db_session.execute(query)
    blocks = result.scalars().all()
    return Result.resolve(blocks)


async def get_block_by_sort(
    db_session: AsyncSession, space_id: asUUID, par_block_id: asUUID, sort: int
) -> Result[Block]:
    query = select(Block).where(
        Block.space_id == space_id, Block.parent_id == par_block_id, Block.sort == sort
    )
    result = await db_session.execute(query)
    block = result.scalar_one_or_none()
    if block is None:
        return Result.reject(f"Block not found")
    return Result.resolve(block)
