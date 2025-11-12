from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ...schema.orm.block import BLOCK_TYPE_SOP
from ...schema.orm import Block, ToolReference, ToolSOP, Space
from ...schema.utils import asUUID
from ...schema.result import Result
from ...schema.block.sop_block import SOPData
from ...schema.block.general import GeneralBlockData
from .block import (
    _find_block_sort,
    create_new_block_embedding,
    update_block_children_sort_by_delta,
)


async def write_sop_block_to_parent(
    db_session: AsyncSession,
    space_id: asUUID,
    par_block_id: asUUID,
    sop_data: SOPData,
    after_block_index: Optional[int] = None,
) -> Result[asUUID]:
    if not sop_data.tool_sops and not sop_data.preferences.strip():
        return Result.reject("SOP data is empty")
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
    if after_block_index is not None:
        if after_block_index < 0 or after_block_index > next_sort:
            return Result.reject(
                f"after_block_index out of range, it should be in [0, {next_sort}]"
            )
        next_sort = after_block_index
        r = await update_block_children_sort_by_delta(
            db_session, space_id, par_block_id, after_block_index - 1, delta=1
        )
        if not r.ok():
            return r
        await db_session.flush()

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
            return Result.reject("Tool name is empty")
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


WRITE_BLOCK_FACTORY = {
    BLOCK_TYPE_SOP: write_sop_block_to_parent,
}

BLOCK_DATA_FACTORY = {BLOCK_TYPE_SOP: SOPData}


async def write_block_to_page(
    db_session: AsyncSession,
    space_id: asUUID,
    par_block_id: asUUID,
    data: GeneralBlockData,
    after_block_index: Optional[int] = None,
):
    if data["type"] not in WRITE_BLOCK_FACTORY:
        return Result.reject(f"Block type {data['type']} is not supported")
    block_data = BLOCK_DATA_FACTORY[data["type"]].model_validate(data["data"])
    return await WRITE_BLOCK_FACTORY[data["type"]](
        db_session,
        space_id,
        par_block_id,
        block_data,
        after_block_index=after_block_index,
    )
