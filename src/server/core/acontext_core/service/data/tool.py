from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from ...env import LOG
from ...schema.orm import ToolReference
from ...schema.utils import asUUID
from ...schema.result import Result
from ...schema.tool.tool_reference import ToolReferenceData


async def rename_tool(
    db_session: AsyncSession, project_id: asUUID, rename_list: list[tuple[str, str]]
) -> Result[None]:
    for old_name, new_name in rename_list:
        tool_ref_query = (
            select(ToolReference)
            .where(ToolReference.project_id == project_id)
            .where(ToolReference.name == old_name)
        )
        result = await db_session.execute(tool_ref_query)
        tool_reference = result.scalars().first()
        if tool_reference is None:
            LOG.warning(f"Tool {old_name} not found")
            continue
        tool_reference.name = new_name
        await db_session.flush()
    return Result.resolve(None)


async def get_tool_names(
    db_session: AsyncSession, project_id: asUUID
) -> Result[List[ToolReferenceData]]:
    # Query to get tool references
    tool_ref_query = (
        select(ToolReference.name)
        .where(ToolReference.project_id == project_id)
    )

    result = await db_session.execute(tool_ref_query)
    tool_data = result.all()

    return Result.resolve(
        [
            ToolReferenceData(name=row.name)
            for row in tool_data
        ]
    )
