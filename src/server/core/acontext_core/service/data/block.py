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


def _normalize_path_block_title(title: str) -> str:
    title = title.replace("/", "_")
    title = title.replace(" ", "_")
    return title


async def _find_block_sort(
    db_session: AsyncSession,
    space_id: asUUID,
    par_block_id: Optional[asUUID],
    block_type: str,
) -> Result[int]:
    if par_block_id is not None:
        parent_block = await db_session.get(Block, par_block_id)
        if parent_block is None:
            return Result.reject(f"Parent block {par_block_id} not found")
        parent_type = parent_block.type
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
    props: Optional[dict] = None,
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
        props=props,
        sort=next_sort,
    )
    r = new_block.validate_for_creation()
    if not r.ok():
        return r
    db_session.add(new_block)
    await db_session.flush()

    # add embedding for path block
    r = await create_new_block_embedding(db_session, new_block, title)
    if not r.ok():
        return r
    return Result.resolve(new_block)


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

    for sop_step in sop_data.tool_sops:
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
            action=sop_step.action,  # The action describes what to do with the tool
            tool_reference_id=tool_reference.id,
            sop_block_id=new_block.id,
            props=None,  # Or store additional metadata if needed
        )
        db_session.add(tool_sop)

    await db_session.flush()

    return Result.resolve(new_block.id)
