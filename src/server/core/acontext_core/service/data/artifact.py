import base64
import hashlib
import os
import struct
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from ...infra.crypto import encrypt_data, decrypt_data
from ...infra.s3 import S3_CLIENT
from ...schema.orm import Artifact
from ...schema.result import Result
from ...schema.utils import asUUID

# Content framing prefix byte — matches Go cache/content framing pattern.
_CONTENT_PREFIX_ENCRYPTED = 0x01


def encode_content(content: str, user_kek: bytes | None = None) -> str:
    """Encode content for storage in asset_meta["content"].

    When user_kek is None, returns plaintext unchanged.
    When user_kek is provided, encrypts and returns
    base64(0x01 | wrappedDEK_len [2B BE] | wrappedDEK | ciphertext).
    """
    if user_kek is None:
        return content

    ciphertext, enc_meta = encrypt_data(user_kek, content.encode("utf-8"))
    wrapped_dek = enc_meta["enc-dek-user"].encode("utf-8")

    # Frame: 0x01 | wrappedDEK_len (2 bytes BE) | wrappedDEK | ciphertext
    frame = (
        bytes([_CONTENT_PREFIX_ENCRYPTED])
        + struct.pack(">H", len(wrapped_dek))
        + wrapped_dek
        + ciphertext
    )
    return base64.b64encode(frame).decode("utf-8")


def decode_content(stored: str, user_kek: bytes | None = None) -> str:
    """Decode content from asset_meta["content"].

    Detects whether content is encrypted (base64 with 0x01 prefix) or legacy plaintext.
    When content is encrypted, user_kek must be provided.
    """
    if not stored:
        return ""

    # Try base64 decode to check for encrypted envelope
    try:
        raw = base64.b64decode(stored)
    except Exception:
        # Not valid base64 — legacy plaintext
        return stored

    if not raw or raw[0] != _CONTENT_PREFIX_ENCRYPTED:
        # Valid base64 but no encrypted prefix — legacy plaintext
        return stored

    # Encrypted envelope: 0x01 | wrappedDEK_len (2B BE) | wrappedDEK | ciphertext
    if user_kek is None:
        raise ValueError("Encrypted content but no user KEK provided")

    if len(raw) < 3:
        raise ValueError("Malformed encrypted content: too short")

    wrapped_dek_len = struct.unpack(">H", raw[1:3])[0]
    if len(raw) < 3 + wrapped_dek_len:
        raise ValueError("Malformed encrypted content: wrappedDEK length exceeds data")

    wrapped_dek = raw[3 : 3 + wrapped_dek_len].decode("utf-8")
    ciphertext = raw[3 + wrapped_dek_len :]

    enc_meta = {
        "enc-algo": "AES-256-GCM",
        "enc-dek-user": wrapped_dek,
    }
    plaintext = decrypt_data(user_kek, ciphertext, enc_meta)
    return plaintext.decode("utf-8")

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
    user_kek: bytes | None = None,
) -> tuple[dict, dict]:
    """Upload content to S3 and build asset_meta + meta dicts matching API behavior.

    Args:
        project_id: Project UUID, used for S3 key prefix.
        path: Artifact path (e.g., "/" or "/scripts/").
        filename: Artifact filename (e.g., "SKILL.md" or "main.py").
        content: Text content of the file.
        user_kek: Optional user KEK for encrypting the upload.

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

    response = await S3_CLIENT.upload_object(
        s3_key, content_bytes, content_type=mime, user_kek=user_kek
    )
    etag = response.get("ETag", "").strip('"')

    asset_meta = {
        "bucket": S3_CLIENT.bucket,
        "s3_key": s3_key,
        "etag": etag,
        "sha256": sha256_hex,
        "mime": mime,
        "size_b": len(content_bytes),
    }
    # Store content for grep/glob and skill file read/edit.
    # For encrypted projects, content is stored encrypted using cache framing format.
    asset_meta["content"] = encode_content(content, user_kek)
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
