from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ...schema.orm import Disk
from ...schema.result import Result
from ...schema.utils import asUUID


async def get_disk(
    db_session: AsyncSession, project_id: asUUID, disk_id: asUUID
) -> Result[Disk]:
    query = select(Disk).where(Disk.id == disk_id, Disk.project_id == project_id)
    result = await db_session.execute(query)
    disk = result.scalars().first()
    if disk is None:
        return Result.reject(f"Disk {disk_id} not found")
    return Result.resolve(disk)


async def create_disk(
    db_session: AsyncSession,
    project_id: asUUID,
    *,
    user_id: Optional[asUUID] = None,
) -> Result[Disk]:
    disk = Disk(project_id=project_id, user_id=user_id)
    db_session.add(disk)
    await db_session.flush()
    return Result.resolve(disk)
