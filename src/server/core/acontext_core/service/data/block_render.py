import json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ...schema.orm import Block, ToolSOP, ToolReference
from ...schema.orm.block import (
    BLOCK_TYPE_SOP,
    BLOCK_TYPE_TEXT,
)
from ...schema.block.general import LLMRenderBlock
from .block import delete_block_recursively
from ...schema.utils import asUUID
from ...schema.result import Result
from ...env import LOG


async def render_sop_block(
    db_session: AsyncSession, space_id: asUUID, block: Block
) -> Result[LLMRenderBlock]:
    loaded_tools = await db_session.execute(
        select(ToolSOP).where(ToolSOP.sop_block_id == block.id).order_by(ToolSOP.order)
    )
    tool_sops = loaded_tools.scalars().all()
    props = {
        "use_when": block.title,
        "preferences": block.props.get("preferences", ""),
        "steps": [],
    }
    for step in tool_sops:
        tool_reference = await db_session.get(ToolReference, step.tool_reference_id)
        if tool_reference is None:
            # FIXME maybe delete the block if the tool reference is not found
            LOG.warning(
                f"Tool reference {step.tool_reference_id} not found for step {step.id}"
            )
            props = None
            break
        step_data = {
            "order": step.order,
            "tool_name": tool_reference.name,
            "action": step.action,
        }
        props["steps"].append(step_data)

    return Result.resolve(
        LLMRenderBlock(
            order=block.sort,
            block_id=block.id,
            type=block.type,
            props=props,
            parent_id=block.parent_id,
        )
    )


async def render_text_block(
    db_session: AsyncSession, space_id: asUUID, block: Block
) -> Result[LLMRenderBlock]:
    props = {
        "use_when": block.title,
        "notes": block.props.get("notes", ""),
    }
    return Result.resolve(
        LLMRenderBlock(
            order=block.sort,
            block_id=block.id,
            type=block.type,
            props=props,
            parent_id=block.parent_id,
        )
    )


RENDER_BLOCK_HANDLERS = {
    BLOCK_TYPE_SOP: render_sop_block,
    BLOCK_TYPE_TEXT: render_text_block,
}


async def render_content_block(
    db_session: AsyncSession, space_id: asUUID, block: Block
) -> Result[LLMRenderBlock]:
    if block.type not in RENDER_BLOCK_HANDLERS:
        return Result.reject(f"Block type {block.type} is not supported to render")
    return await RENDER_BLOCK_HANDLERS[block.type](db_session, space_id, block)
