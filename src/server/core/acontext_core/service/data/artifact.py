from typing import List, Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from ...schema.orm import Artifact
from ...schema.result import Result
from ...schema.utils import asUUID


async def get_artifact_by_path(
    db_session: AsyncSession, disk_id: asUUID, path: str, filename: str
) -> Result[Artifact]:
    query = select(Artifact).where(
        Artifact.disk_id == disk_id,
        Artifact.path == path,
        Artifact.filename == filename,
    )
    result = await db_session.execute(query)
    artifact = result.scalars().first()
    if artifact is None:
        return Result.reject(
            f"Artifact not found: disk={disk_id}, path={path}, filename={filename}"
        )
    return Result.resolve(artifact)


async def list_artifacts_by_path(
    db_session: AsyncSession, disk_id: asUUID, path: str = ""
) -> Result[List[Artifact]]:
    query = select(Artifact).where(Artifact.disk_id == disk_id)
    if path:
        query = query.where(Artifact.path == path)
    result = await db_session.execute(query)
    artifacts = list(result.scalars().all())
    return Result.resolve(artifacts)


def _glob_to_like(pattern: str) -> str:
    """Convert a glob pattern to a SQL LIKE pattern.

    Mirrors the API's GlobArtifacts implementation:
    - Replace ** with % (recursive directory matching)
    - Replace * with % (any characters)
    - Replace ? with _ (single character)
    Note: ** must be replaced before * to avoid double replacement.
    """
    pattern = pattern.replace("**", "%")
    pattern = pattern.replace("*", "%")
    pattern = pattern.replace("?", "_")
    return pattern


async def glob_artifacts(
    db_session: AsyncSession, disk_id: asUUID, pattern: str
) -> Result[List[Artifact]]:
    sql_pattern = _glob_to_like(pattern)
    full_path = Artifact.path + Artifact.filename  # type: ignore[operator]
    query = select(Artifact).where(
        Artifact.disk_id == disk_id,
        full_path.like(sql_pattern),
    )
    result = await db_session.execute(query)
    artifacts = list(result.scalars().all())
    return Result.resolve(artifacts)


async def grep_artifacts(
    db_session: AsyncSession,
    disk_id: asUUID,
    query: str,
    *,
    case_sensitive: bool = False,
) -> Result[List[Artifact]]:
    """Search artifact text content using PostgreSQL regex matching.

    Mirrors the API's GrepArtifacts implementation:
    - Uses PostgreSQL regex operator ``~*`` (case-insensitive, default) or ``~`` (case-sensitive)
    - Filters by text-searchable MIME types (text/*, application/json, application/x-*)
    - Requires asset_meta->>'content' IS NOT NULL
    """
    content_col = Artifact.asset_meta["content"].astext  # type: ignore[index]
    mime_col = Artifact.asset_meta["mime"].astext  # type: ignore[index]

    stmt = select(Artifact).where(
        Artifact.disk_id == disk_id,
        content_col.isnot(None),
        or_(
            mime_col.like("text/%"),
            mime_col == "application/json",
            mime_col.like("application/x-%"),
        ),
    )
    if case_sensitive:
        stmt = stmt.where(content_col.op("~")(query))
    else:
        stmt = stmt.where(content_col.op("~*")(query))

    result = await db_session.execute(stmt)
    artifacts = list(result.scalars().all())
    return Result.resolve(artifacts)


async def upsert_artifact(
    db_session: AsyncSession,
    disk_id: asUUID,
    path: str,
    filename: str,
    asset_meta: dict,
    *,
    meta: Optional[dict] = None,
) -> Result[Artifact]:
    stmt = insert(Artifact).values(
        disk_id=disk_id,
        path=path,
        filename=filename,
        asset_meta=asset_meta,
        meta=meta,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["disk_id", "path", "filename"],
        set_={
            "asset_meta": asset_meta,
            "meta": meta,
            "updated_at": func.now(),
        },
    )
    await db_session.execute(stmt)
    await db_session.flush()

    # Re-fetch as a full ORM instance with populate_existing=True to bypass
    # the identity map cache (the ON CONFLICT DO UPDATE bypasses ORM tracking).
    # Do not use returning() — it gives a Row, not an ORM-mapped instance.
    query = (
        select(Artifact)
        .where(
            Artifact.disk_id == disk_id,
            Artifact.path == path,
            Artifact.filename == filename,
        )
        .execution_options(populate_existing=True)
    )
    result = await db_session.execute(query)
    artifact = result.scalars().first()
    if artifact is None:
        return Result.reject(
            f"Artifact not found after upsert: disk={disk_id}, path={path}, filename={filename}"
        )
    return Result.resolve(artifact)
