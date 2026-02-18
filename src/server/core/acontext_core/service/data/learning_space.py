from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ...schema.orm import LearningSpace, LearningSpaceSession, LearningSpaceSkill, AgentSkill, Artifact
from ...schema.result import Result
from ...schema.utils import asUUID
from dataclasses import dataclass


def join_artifact_path(path: str, filename: str) -> str:
    """Join artifact (path, filename) into a display file path."""
    if path == "/":
        return filename
    return f"{path}{filename}".lstrip("/")


@dataclass
class SkillInfo:
    id: asUUID
    disk_id: asUUID
    name: str
    description: str
    file_paths: list[str]


async def get_learning_space_for_session(
    db_session: AsyncSession, session_id: asUUID
) -> Result[Optional[LearningSpaceSession]]:
    query = select(LearningSpaceSession).where(
        LearningSpaceSession.session_id == session_id,
    )
    result = await db_session.execute(query)
    ls_session = result.scalars().first()
    return Result.resolve(ls_session)


async def get_learning_space(
    db_session: AsyncSession, learning_space_id: asUUID
) -> Result[LearningSpace]:
    query = select(LearningSpace).where(
        LearningSpace.id == learning_space_id,
    )
    result = await db_session.execute(query)
    ls = result.scalars().first()
    if ls is None:
        return Result.reject(f"LearningSpace {learning_space_id} not found")
    return Result.resolve(ls)


async def get_learning_space_skill_ids(
    db_session: AsyncSession, learning_space_id: asUUID
) -> Result[List[asUUID]]:
    query = select(LearningSpaceSkill.skill_id).where(
        LearningSpaceSkill.learning_space_id == learning_space_id,
    )
    result = await db_session.execute(query)
    skill_ids = list(result.scalars().all())
    return Result.resolve(skill_ids)


async def get_skills_info(
    db_session: AsyncSession, skill_ids: List[asUUID]
) -> Result[List[SkillInfo]]:
    if not skill_ids:
        return Result.resolve([])

    # Fetch skills
    query = select(AgentSkill).where(AgentSkill.id.in_(skill_ids))
    result = await db_session.execute(query)
    skills = list(result.scalars().all())

    # Batch fetch all artifacts for all skill disks in a single query
    disk_ids = [skill.disk_id for skill in skills]
    artifact_query = select(Artifact.disk_id, Artifact.path, Artifact.filename).where(
        Artifact.disk_id.in_(disk_ids),
    )
    artifact_result = await db_session.execute(artifact_query)
    # Group file paths by disk_id
    disk_files: dict = {}
    for row in artifact_result.all():
        fp = join_artifact_path(row.path, row.filename)
        disk_files.setdefault(row.disk_id, []).append(fp)

    skill_infos = [
        SkillInfo(
            id=skill.id,
            disk_id=skill.disk_id,
            name=skill.name,
            description=skill.description,
            file_paths=disk_files.get(skill.disk_id, []),
        )
        for skill in skills
    ]

    return Result.resolve(skill_infos)


async def update_session_status(
    db_session: AsyncSession, session_id: asUUID, status: str
) -> Result[Optional[LearningSpaceSession]]:
    query = select(LearningSpaceSession).where(
        LearningSpaceSession.session_id == session_id,
    )
    result = await db_session.execute(query)
    ls_session = result.scalars().first()
    if ls_session is None:
        return Result.reject(f"LearningSpaceSession for session {session_id} not found")
    ls_session.status = status
    await db_session.flush()
    return Result.resolve(ls_session)


async def add_skill_to_learning_space(
    db_session: AsyncSession, learning_space_id: asUUID, skill_id: asUUID
) -> Result[LearningSpaceSkill]:
    ls_skill = LearningSpaceSkill(
        learning_space_id=learning_space_id,
        skill_id=skill_id,
    )
    db_session.add(ls_skill)
    await db_session.flush()
    return Result.resolve(ls_skill)
