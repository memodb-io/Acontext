from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ...schema.orm import Project
from ...schema.config import ProjectConfig, filter_value_from_json
from ...schema.result import Result
from ...schema.utils import asUUID
from ...env import DEFAULT_PROJECT_CONFIG


async def get_project_config(
    db_session: AsyncSession, project_id: asUUID
) -> Result[ProjectConfig]:
    query = select(Project).where(Project.id == project_id)
    result = await db_session.execute(query)
    project = result.scalars().first()
    if project is None:
        return Result.reject(f"Project not found: {project_id}")
    if not project.configs or "project_config" not in project.configs:
        return Result.resolve(DEFAULT_PROJECT_CONFIG)

    project_config = {
        **DEFAULT_PROJECT_CONFIG.model_dump(),
        **filter_value_from_json(project.configs["project_config"], ProjectConfig),
    }
    return Result.resolve(ProjectConfig(**project_config))
