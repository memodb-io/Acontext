import re
from typing import Optional

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...schema.orm import AgentSkill
from ...schema.result import Result
from ...schema.utils import asUUID
from .disk import create_disk
from .artifact import upsert_artifact, upload_and_build_artifact_meta


def _parse_skill_md(content: str) -> tuple[str, str]:
    """Parse SKILL.md content to extract name and description from YAML front matter.

    Follows the same logic as the API's extractYAMLFrontMatter:
    - If `---` delimiters are found, extracts YAML between them.
    - If no delimiters, treats entire content as YAML.

    Returns:
        (name, description) tuple.

    Raises:
        ValueError: If content is empty, YAML is invalid, or name/description is missing.
    """
    if not content or not content.strip():
        raise ValueError("SKILL.md content is empty")

    lines = content.split("\n")

    # Find front matter delimiters
    first_delim = -1
    second_delim = -1
    for i, line in enumerate(lines):
        if line.strip() == "---":
            if first_delim == -1:
                first_delim = i
            else:
                second_delim = i
                break

    if first_delim != -1 and second_delim != -1:
        yaml_content = "\n".join(lines[first_delim + 1 : second_delim])
    else:
        yaml_content = content

    try:
        data = yaml.safe_load(yaml_content)
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML in SKILL.md: {e}") from e

    if not isinstance(data, dict):
        raise ValueError("SKILL.md YAML front matter must be a mapping")

    name = data.get("name")
    description = data.get("description")

    if not name:
        raise ValueError("SKILL.md is missing required field: name")
    if not description:
        raise ValueError("SKILL.md is missing required field: description")

    return str(name), str(description)


# Characters to sanitize in skill names (mirrors API's sanitizeS3Key)
_SANITIZE_RE = re.compile(r'[/\\:*?"<>|\s]')


def _sanitize_name(name: str) -> str:
    """Replace special characters and spaces with hyphens."""
    return _SANITIZE_RE.sub("-", name)


async def get_agent_skill(
    db_session: AsyncSession, project_id: asUUID, skill_id: asUUID
) -> Result[AgentSkill]:
    query = select(AgentSkill).where(
        AgentSkill.id == skill_id,
        AgentSkill.project_id == project_id,
    )
    result = await db_session.execute(query)
    skill = result.scalars().first()
    if skill is None:
        return Result.reject(f"AgentSkill {skill_id} not found")
    return Result.resolve(skill)


async def create_skill(
    db_session: AsyncSession,
    project_id: asUUID,
    content: str,
    *,
    user_id: Optional[asUUID] = None,
    meta: Optional[dict] = None,
) -> Result[AgentSkill]:
    """Create a skill from SKILL.md content string.

    Steps:
    1. Parse SKILL.md (YAML front matter -> name, description)
    2. Sanitize name
    3. Create Disk
    4. Upsert SKILL.md as Artifact on the disk
    5. Create AgentSkill record
    """
    # 1. Parse SKILL.md
    try:
        name, description = _parse_skill_md(content)
    except ValueError as e:
        return Result.reject(str(e))

    # 2. Sanitize name
    sanitized_name = _sanitize_name(name)

    # 3. Create Disk
    disk_result = await create_disk(db_session, project_id, user_id=user_id)
    disk, err = disk_result.unpack()
    if err is not None:
        return Result.reject(f"Failed to create disk: {err}")

    # 4. Upload to S3 and upsert SKILL.md artifact
    asset_meta, artifact_info_meta = await upload_and_build_artifact_meta(
        project_id, "/", "SKILL.md", content
    )
    artifact_result = await upsert_artifact(
        db_session, disk.id, "/", "SKILL.md", asset_meta, meta=artifact_info_meta
    )
    _, err = artifact_result.unpack()
    if err is not None:
        return Result.reject(f"Failed to create SKILL.md artifact: {err}")

    # 5. Create AgentSkill record
    skill = AgentSkill(
        project_id=project_id,
        user_id=user_id,
        name=sanitized_name,
        description=description,
        disk_id=disk.id,
        meta=meta,
    )
    db_session.add(skill)
    await db_session.flush()

    return Result.resolve(skill)
