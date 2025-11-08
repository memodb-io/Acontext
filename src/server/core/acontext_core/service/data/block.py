import numpy as np
from sqlalchemy import String
from typing import List, Optional
from sqlalchemy import select, delete, update, func
from sqlalchemy import select, delete, update
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.ext.asyncio import AsyncSession
from ...llm.embeddings import get_embedding
from ...schema.orm.block import (
    BLOCK_TYPE_FOLDER,
    BLOCK_TYPE_ROOT,
    BLOCK_TYPE_PAGE,
    BLOCK_TYPE_SOP,
    BLOCK_PARENT_ALLOW,
)
from ...schema.orm import Block, BlockEmbedding, ToolReference, ToolSOP, Space
from ...schema.utils import asUUID
from ...schema.result import Result
from ...schema.block.sop_block import SOPData
from .block_nav import assert_block_type, _normalize_path_block_title


async def _find_block_sort(
    db_session: AsyncSession,
    space_id: asUUID,
    par_block_id: Optional[asUUID],
    block_type: str,
) -> Result[int]:
    if par_block_id is not None:
        query = select(Block.type).where(Block.id == par_block_id)
        result = await db_session.execute(query)
        par_block = result.mappings().one_or_none()
        if par_block is None:
            return Result.reject(f"Parent block {par_block_id} not found")
        parent_type = par_block["type"]
    else:
        parent_type = BLOCK_TYPE_ROOT

    if block_type not in BLOCK_PARENT_ALLOW:
        return Result.reject(f"Block type {block_type} is not supported")
    if parent_type not in BLOCK_PARENT_ALLOW[block_type]:
        return Result.reject(
            f"Parent block {par_block_id}(type {parent_type}) is not allowed to have children of type {block_type}"
        )
    next_sort_query = (
        select(func.coalesce(func.max(Block.sort), -1) + 1)
        .where(Block.space_id == space_id)
        .where(Block.parent_id == par_block_id)
    )
    result = await db_session.execute(next_sort_query)
    next_sort = result.scalar()
    if next_sort is None:
        return Result.reject(f"Failed to find next sort for block {par_block_id}")
    return Result.resolve(next_sort)


async def decrease_block_children_sort_by_1(
    db_session: AsyncSession,
    space_id: asUUID,
    block_id: Optional[asUUID],
    gt_sort: int,
) -> Result[None]:
    query = (
        update(Block)
        .where(Block.space_id == space_id)
        .where(Block.parent_id == block_id)
        .where(Block.sort > gt_sort)
        .values(sort=Block.sort - 1)
    )
    result = await db_session.execute(query)
    return Result.resolve(None)


async def create_new_block_embedding(
    db_session: AsyncSession,
    block: Block,
    content_to_embed: str,
    configs: Optional[dict] = None,
) -> Result[BlockEmbedding]:
    r = await get_embedding([content_to_embed])
    if not r.ok():
        return r
    embedding = r.data.embedding
    new_embedding = BlockEmbedding(
        block_id=block.id,
        space_id=block.space_id,
        block_type=block.type,
        embedding=embedding[0],
        configs=configs,
    )
    db_session.add(new_embedding)
    await db_session.flush()
    flag_modified(block, "embeddings")
    return Result.resolve(new_embedding)


async def create_new_path_block(
    db_session: AsyncSession,
    space_id: asUUID,
    title: str,
    props: dict | None = None,
    par_block_id: Optional[asUUID] = None,
    type: str = BLOCK_TYPE_PAGE,
) -> Result[Block]:
    r = await _find_block_sort(db_session, space_id, par_block_id, block_type=type)
    if not r.ok():
        return r
    next_sort = r.unpack()[0]
    title = _normalize_path_block_title(title)
    new_block = Block(
        space_id=space_id,
        type=type,
        parent_id=par_block_id,
        title=title,
        props=props or {},
        sort=next_sort,
    )
    r = new_block.validate_for_creation()
    if not r.ok():
        return r
    db_session.add(new_block)
    await db_session.flush()

    # add embedding for path block
    index_content = title
    if props and "view_when" in props:
        index_content += " " + props["view_when"]
    r = await create_new_block_embedding(db_session, new_block, index_content)
    if not r.ok():
        return r
    return Result.resolve(new_block)


async def find_all_parent_ids(
    db_session: AsyncSession, space_id: asUUID, block_id: asUUID | None
) -> Result[List[asUUID]]:
    if block_id is None:
        return Result.resolve([])
    parent_ids: List[asUUID] = [block_id]
    while block_id is not None:
        query = select(Block.parent_id).where(
            Block.space_id == space_id, Block.id == block_id
        )
        result = await db_session.execute(query)
        block = result.mappings().one_or_none()
        parent_ids.append(block["parent_id"])
        block_id = block["parent_id"]
    return Result.resolve(parent_ids)


async def move_path_block_to_new_parent(
    db_session: AsyncSession,
    space_id: asUUID,
    path_block_id: asUUID,
    new_par_block_id: asUUID,
) -> Result[Block]:

    path_block = await db_session.get(Block, path_block_id)
    if path_block is None:
        return Result.reject(f"Path block {path_block_id} not found")
    if path_block.type != BLOCK_TYPE_FOLDER and path_block.type != BLOCK_TYPE_PAGE:
        return Result.reject(f"Path block {path_block_id} is not a folder or page")
    r = await assert_block_type(
        db_session, space_id, new_par_block_id, BLOCK_TYPE_FOLDER
    )
    if not r.ok():
        return r

    r = await find_all_parent_ids(db_session, space_id, new_par_block_id)
    if not r.ok():
        return r
    maybe_cycle_all_parent_ids = r.data
    if path_block_id in maybe_cycle_all_parent_ids:
        return Result.reject(
            f"Cycle detected, can't move a parent block to its child block"
        )

    r = await _find_block_sort(
        db_session, space_id, new_par_block_id, block_type=BLOCK_TYPE_FOLDER
    )
    if not r.ok():
        return r

    before_par_block_id = path_block.parent_id
    before_sort = path_block.sort
    next_sort = r.data
    path_block.parent_id = new_par_block_id
    path_block.sort = next_sort
    flag_modified(path_block, "parent_id")
    flag_modified(path_block, "sort")
    await db_session.flush()
    # update the before parent block's children sort
    r = await decrease_block_children_sort_by_1(
        db_session, space_id, before_par_block_id, before_sort - 1
    )
    if not r.ok():
        return r
    await db_session.flush()
    return Result.resolve(path_block)


async def write_sop_block_to_parent(
    db_session: AsyncSession, space_id: asUUID, par_block_id: asUUID, sop_data: SOPData
) -> Result[asUUID]:
    if not sop_data.tool_sops and not sop_data.preferences.strip():
        return Result.reject(f"SOP data is empty")
    space = await db_session.get(Space, space_id)
    if space is None:
        raise ValueError(f"Space {space_id} not found")

    project_id = space.project_id
    # 1. add block to table
    r = await _find_block_sort(
        db_session, space_id, par_block_id, block_type=BLOCK_TYPE_SOP
    )
    if not r.ok():
        return r
    next_sort = r.unpack()[0]
    new_block = Block(
        space_id=space_id,
        type=BLOCK_TYPE_SOP,
        parent_id=par_block_id,
        title=sop_data.use_when,
        props={
            "preferences": sop_data.preferences.strip(),
        },
        sort=next_sort,
    )
    r = new_block.validate_for_creation()
    if not r.ok():
        return r
    db_session.add(new_block)
    await db_session.flush()

    for i, sop_step in enumerate(sop_data.tool_sops):
        tool_name = sop_step.tool_name.strip()
        if not tool_name:
            return Result.reject(f"Tool name is empty")
        tool_name = tool_name.lower()
        # Try to find existing ToolReference
        tool_ref_query = (
            select(ToolReference)
            .where(ToolReference.project_id == project_id)
            .where(ToolReference.name == tool_name)
        )
        result = await db_session.execute(tool_ref_query)
        tool_reference = result.scalars().first()

        # If ToolReference doesn't exist, create it
        if tool_reference is None:
            tool_reference = ToolReference(
                name=tool_name,
                project_id=project_id,
            )
            db_session.add(tool_reference)
            await db_session.flush()  # Flush to get the tool_reference ID

        # Create ToolSOP entry linking tool to the SOP block
        tool_sop = ToolSOP(
            order=i,
            action=sop_step.action,  # The action describes what to do with the tool
            tool_reference_id=tool_reference.id,
            sop_block_id=new_block.id,
            props=None,  # Or store additional metadata if needed
        )
        db_session.add(tool_sop)

    await db_session.flush()
    r = await create_new_block_embedding(db_session, new_block, sop_data.use_when)
    if not r.ok():
        return r
    return Result.resolve(new_block.id)


async def update_block(
    db_session: AsyncSession,
    space_id: asUUID,
    block_id: asUUID,
    title: str | None = None,
    patch_props: dict | None = None,
) -> Result[Block]:
    block = await db_session.get(Block, block_id)

    if block is None:
        return Result.reject(f"Block {block_id} not found")
    if block.space_id != space_id:
        return Result.reject(f"Block {block_id} is not in space {space_id}")

    if title is not None:
        title = _normalize_path_block_title(title)
        block.title = title
        flag_modified(block, "title")
    if patch_props is not None:
        block.props.update(patch_props)
        flag_modified(block, "props")
    await db_session.flush()
    return Result.resolve(block)


async def delete_block_recursively(
    db_session: AsyncSession,
    space_id: asUUID,
    block_id: asUUID,
) -> Result[None]:
    """
    Recursively delete a block and all its children.
    This function will:
    1. Verify the block exists and belongs to the space
    2. Recursively delete all children blocks
    3. Delete the block itself (cascading to embeddings and tool_sops)
    4. Adjust the sort order of sibling blocks
    """
    # Fetch the block with its children eagerly loaded
    query = (
        select(Block)
        .where(Block.id == block_id)
        .where(Block.space_id == space_id)
        .options(selectinload(Block.children))
    )
    result = await db_session.execute(query)
    block = result.scalar_one_or_none()

    if block is None:
        return Result.reject(f"Block {block_id} not found in space {space_id}")

    # Store parent_id and sort for later sibling adjustment
    parent_id = block.parent_id
    block_sort = block.sort

    # Recursively delete all children
    # We need to collect child IDs first to avoid issues with the children collection being modified
    # Note: We must delete sequentially because all operations share the same db session
    child_ids = [child.id for child in block.children]
    for child_id in child_ids:
        r = await delete_block_recursively(db_session, space_id, child_id)
        if not r.ok():
            return r

    # Clear the children collection to prevent cascade from trying to delete already-deleted children
    block.children = []

    # Delete the block itself
    # This will cascade delete:
    # - BlockEmbeddings (cascade="all, delete-orphan")
    # - ToolSOP entries (cascade="all, delete-orphan")
    await db_session.delete(block)
    await db_session.flush()

    # Adjust the sort order of sibling blocks that come after this one
    r = await decrease_block_children_sort_by_1(
        db_session, space_id, parent_id, block_sort - 1
    )
    if not r.ok():
        return r

    return Result.resolve(None)
