import hashlib
import os
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from ...infra.s3 import S3_CLIENT
from ...schema.orm import Artifact
from ...schema.result import Result
from ...schema.utils import asUUID

_EXT_MIME_MAP = {
    ".md": "text/markdown", ".markdown": "text/markdown",
    ".yaml": "text/yaml", ".yml": "text/yaml",
    ".csv": "text/csv", ".json": "application/json",
    ".xml": "application/xml", ".html": "text/html", ".htm": "text/html",
    ".css": "text/css", ".js": "text/javascript", ".ts": "text/typescript",
    ".go": "text/x-go", ".py": "text/x-python",
    ".rs": "text/x-rust", ".rb": "text/x-ruby",
    ".java": "text/x-java", ".c": "text/x-c", ".cpp": "text/x-c++",
    ".h": "text/x-c", ".hpp": "text/x-c++",
    ".sh": "text/x-shellscript", ".bash": "text/x-shellscript",
    ".sql": "text/x-sql", ".toml": "text/x-toml",
    ".ini": "text/x-ini", ".cfg": "text/x-ini", ".conf": "text/x-ini",
}


def detect_mime_type(filename: str) -> str:
    """Detect MIME type from filename extension, mirroring the API's extMimeMap."""
    ext = os.path.splitext(filename)[1].lower()
    return _EXT_MIME_MAP.get(ext, "text/plain")


async def upload_and_build_artifact_meta(
    project_id: asUUID,
    path: str,
    filename: str,
    content: str,
) -> tuple[dict, dict]:
    """Upload content to S3 and build asset_meta + meta dicts matching API behavior.

    Args:
        project_id: Project UUID, used for S3 key prefix.
        path: Artifact path (e.g., "/" or "/scripts/").
        filename: Artifact filename (e.g., "SKILL.md" or "main.py").
        content: Text content of the file.

    Returns:
        (asset_meta, artifact_info_meta) tuple:
        - asset_meta: dict for the artifact's asset_meta column
        - artifact_info_meta: dict for the artifact's meta column (contains __artifact_info__)
    """
    content_bytes = content.encode("utf-8")
    sha256_hex = hashlib.sha256(content_bytes).hexdigest()
    mime = detect_mime_type(filename)
    ext = os.path.splitext(filename)[1].lower()
    date_prefix = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    s3_key = f"disks/{project_id}/{date_prefix}/{sha256_hex}{ext}"

    response = await S3_CLIENT.upload_object(s3_key, content_bytes, content_type=mime)
    etag = response.get("ETag", "").strip('"')

    asset_meta = {
        "bucket": S3_CLIENT.bucket,
        "s3_key": s3_key,
        "etag": etag,
        "sha256": sha256_hex,
        "mime": mime,
        "size_b": len(content_bytes),
        "content": content,
    }
    artifact_info_meta = {
        "__artifact_info__": {
            "path": path,
            "filename": filename,
            "mime": mime,
            "size": len(content_bytes),
        }
    }
    return asset_meta, artifact_info_meta


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


async def artifact_exists(
    db_session: AsyncSession, disk_id: asUUID, path: str, filename: str
) -> bool:
    query = select(func.count()).select_from(Artifact).where(
        Artifact.disk_id == disk_id,
        Artifact.path == path,
        Artifact.filename == filename,
    )
    result = await db_session.execute(query)
    return result.scalar_one() > 0


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


async def delete_artifact_by_path(
    db_session: AsyncSession, disk_id: asUUID, path: str, filename: str
) -> Result[None]:
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
    await db_session.delete(artifact)
    await db_session.flush()
    return Result.resolve(None)
