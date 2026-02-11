from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import Text, and_, asc, cast, desc, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ...env import DEFAULT_CORE_CONFIG, LOG
from ...llm.embeddings import get_embedding
from ...schema.orm import Tool
from ...schema.error_code import Code
from ...schema.result import Result
from ...schema.tool import ToolFormat, ToolOut, ToolSearchHit


_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def _datetime_to_unix_ns(dt: datetime) -> int:
    # Go's time.UnixNano is integer-based. Avoid float timestamp conversion here,
    # otherwise cursors can drift by microseconds and cause duplicates/skips.
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    delta = dt - _EPOCH
    return (
        (delta.days * 24 * 60 * 60 + delta.seconds) * 1_000_000_000
        + delta.microseconds * 1_000
    )


def _unix_ns_to_datetime(unix_ns: int) -> datetime:
    # Datetime has microsecond resolution. Preserve microseconds exactly and
    # ignore any sub-micro remainder.
    sec = unix_ns // 1_000_000_000
    micro = (unix_ns % 1_000_000_000) // 1_000
    return datetime.fromtimestamp(sec, tz=timezone.utc).replace(microsecond=int(micro))


def _encode_cursor(created_at: datetime, tool_id: UUID) -> str:
    # Match Go's paging.EncodeCursor: base64url(raw "unixnano|uuid") without padding.
    unix_ns = _datetime_to_unix_ns(created_at)
    raw = f"{unix_ns}|{tool_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8").rstrip("=")


def _decode_cursor(cursor: str) -> Result[tuple[datetime, UUID]]:
    if not cursor:
        return Result.reject("empty cursor", status=Code.BAD_REQUEST)
    try:
        # Restore padding for urlsafe base64 decoding.
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        parts = raw.split("|")
        if len(parts) != 2:
            return Result.reject("bad cursor", status=Code.BAD_REQUEST)
        unix_ns = int(parts[0])
        tool_id = UUID(parts[1])
        created_at = _unix_ns_to_datetime(unix_ns)
        return Result.resolve((created_at, tool_id))
    except Exception as e:
        return Result.reject(f"bad cursor: {e}", status=Code.BAD_REQUEST)


def _parse_openai_tool_schema(schema: dict[str, Any]) -> Result[tuple[str, str, dict]]:
    # Accept both:
    # 1) OpenAI tool schema: {"type":"function","function":{...}}
    # 2) OpenAI function schema: {"name":...,"parameters":{...}}
    try:
        if isinstance(schema.get("function"), dict):
            func = schema["function"]
        else:
            func = schema

        name = func.get("name")
        if not isinstance(name, str) or not name.strip():
            return Result.reject("openai_schema.name is required", status=Code.BAD_REQUEST)

        description = func.get("description") or ""
        if not isinstance(description, str):
            description = str(description)

        parameters = func.get("parameters")
        if not isinstance(parameters, dict):
            return Result.reject(
                "openai_schema.parameters must be an object", status=Code.BAD_REQUEST
            )

        return Result.resolve((name, description, parameters))
    except Exception as e:
        return Result.reject(f"invalid openai_schema: {e}", status=Code.BAD_REQUEST)


def _tool_document_text(name: str, description: str, parameters: dict) -> str:
    return "\n".join(
        [
            name,
            description,
            json.dumps(parameters, sort_keys=True, ensure_ascii=True),
        ]
    )


def _convert_schema(name: str, description: str, parameters: dict, fmt: ToolFormat) -> dict:
    if fmt == "openai":
        return {
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": parameters,
            },
        }
    if fmt == "anthropic":
        return {
            "name": name,
            "description": description,
            "input_schema": parameters,
        }
    if fmt == "gemini":
        return {
            "name": name,
            "description": description,
            "parameters": parameters,
        }
    raise ValueError(f"unsupported format: {fmt}")


def to_tool_out(tool: Tool, fmt: ToolFormat) -> ToolOut:
    return ToolOut(
        id=tool.id,
        project_id=tool.project_id,
        user_id=tool.user_id,
        name=tool.name,
        description=tool.description or "",
        config=tool.config,
        schema_=_convert_schema(tool.name, tool.description or "", tool.parameters, fmt),
        created_at=tool.created_at,
        updated_at=tool.updated_at,
    )


async def upsert_tool(
    db_session: AsyncSession,
    *,
    project_id: UUID,
    user_id: Optional[UUID],
    openai_schema: dict[str, Any],
    config: Optional[dict[str, Any]] = None,
) -> Result[Tool]:
    parsed = _parse_openai_tool_schema(openai_schema)
    name_desc_params, eil = parsed.unpack()
    if eil:
        return Result.reject(eil.errmsg, status=eil.status)
    name, description, parameters = name_desc_params

    doc_text = _tool_document_text(name, description, parameters)
    embedding: Optional[list[float]] = None
    try:
        r = await get_embedding([doc_text], phase="document")
        if r.ok():
            embedding = r.data.embedding[0].tolist()
        else:
            LOG.warning(
                f"tool embedding failed (continuing without embedding): {r.error.errmsg}"
            )
    except Exception as e:
        LOG.warning(f"tool embedding failed (continuing without embedding): {e}")

    q = select(Tool).where(Tool.project_id == project_id, Tool.name == name)
    if user_id is None:
        q = q.where(Tool.user_id.is_(None))
    else:
        q = q.where(Tool.user_id == user_id)
    existing = (await db_session.execute(q)).scalars().first()
    if existing is not None:
        existing.description = description
        existing.parameters = parameters
        if config is not None:
            existing.config = config
        if embedding is not None:
            existing.embedding = embedding
        await db_session.flush()
        # updated_at is generated via onupdate/server function; refresh to avoid
        # accessing expired attributes outside of an async IO context.
        await db_session.refresh(existing)
        return Result.resolve(existing)

    tool = Tool(
        project_id=project_id,
        user_id=user_id,
        name=name,
        description=description,
        parameters=parameters,
        config=config,
        embedding=embedding,
    )
    try:
        # Use a savepoint so a unique conflict only rolls back the failed insert,
        # not the caller's whole transaction.
        async with db_session.begin_nested():
            db_session.add(tool)
            await db_session.flush()
    except IntegrityError:
        # Another concurrent transaction inserted the same scoped name.
        # Retry as an update against the now-existing row.
        retry_q = select(Tool).where(Tool.project_id == project_id, Tool.name == name)
        if user_id is None:
            retry_q = retry_q.where(Tool.user_id.is_(None))
        else:
            retry_q = retry_q.where(Tool.user_id == user_id)
        existing_after_conflict = (await db_session.execute(retry_q)).scalars().first()
        if existing_after_conflict is None:
            return Result.reject(
                "tool upsert conflict, please retry",
                status=Code.SERVICE_UNAVAILABLE,
            )

        existing_after_conflict.description = description
        existing_after_conflict.parameters = parameters
        if config is not None:
            existing_after_conflict.config = config
        if embedding is not None:
            existing_after_conflict.embedding = embedding
        await db_session.flush()
        await db_session.refresh(existing_after_conflict)
        return Result.resolve(existing_after_conflict)

    # created_at/updated_at may be server-generated; refresh to ensure they're loaded.
    await db_session.refresh(tool)
    return Result.resolve(tool)


async def delete_tool(
    db_session: AsyncSession,
    *,
    project_id: UUID,
    user_id: Optional[UUID],
    name: str,
) -> Result[bool]:
    q = select(Tool).where(Tool.project_id == project_id, Tool.name == name)
    if user_id is None:
        q = q.where(Tool.user_id.is_(None))
    else:
        q = q.where(Tool.user_id == user_id)
    tool = (await db_session.execute(q)).scalars().first()
    if tool is None:
        return Result.reject(f"tool {name} not found", status=Code.NOT_FOUND)

    await db_session.delete(tool)
    await db_session.flush()
    return Result.resolve(True)


async def list_tools(
    db_session: AsyncSession,
    *,
    project_id: UUID,
    user_id: Optional[UUID],
    limit: int,
    cursor: Optional[str],
    time_desc: bool,
    filter_config: Optional[dict[str, Any]] = None,
    fmt: ToolFormat = "openai",
) -> Result[dict[str, Any]]:
    after_created_at: Optional[datetime] = None
    after_id: Optional[UUID] = None
    if cursor:
        decoded = _decode_cursor(cursor)
        dp, eil = decoded.unpack()
        if eil:
            return Result.reject(eil.errmsg, status=eil.status)
        after_created_at, after_id = dp

    q = select(Tool).where(Tool.project_id == project_id)
    if user_id is None:
        q = q.where(Tool.user_id.is_(None))
    else:
        q = q.where(Tool.user_id == user_id)

    if filter_config is not None:
        if not isinstance(filter_config, dict):
            return Result.reject(
                "filter_config must be an object",
                status=Code.BAD_REQUEST,
            )
        if len(filter_config) > 0:
            q = q.where(Tool.config.contains(filter_config))  # type: ignore[no-untyped-call]

    if after_created_at is not None and after_id is not None:
        if time_desc:
            q = q.where(
                or_(
                    Tool.created_at < after_created_at,
                    and_(Tool.created_at == after_created_at, Tool.id < after_id),
                )
            )
        else:
            q = q.where(
                or_(
                    Tool.created_at > after_created_at,
                    and_(Tool.created_at == after_created_at, Tool.id > after_id),
                )
            )

    order_by = [asc(Tool.created_at), asc(Tool.id)]
    if time_desc:
        order_by = [desc(Tool.created_at), desc(Tool.id)]
    q = q.order_by(*order_by).limit(limit + 1)

    tools = (await db_session.execute(q)).scalars().all()

    has_more = len(tools) > limit
    items = tools[:limit]
    next_cursor = None
    if has_more and items:
        last = items[-1]
        next_cursor = _encode_cursor(last.created_at, last.id)

    return Result.resolve(
        {
            "items": [to_tool_out(t, fmt) for t in items],
            "next_cursor": next_cursor,
            "has_more": has_more,
        }
    )


async def search_tools(
    db_session: AsyncSession,
    *,
    project_id: UUID,
    user_id: Optional[UUID],
    query: str,
    limit: int,
    fmt: ToolFormat = "openai",
) -> Result[list[ToolSearchHit]]:
    query = (query or "").strip()
    if not query:
        return Result.reject("query is required", status=Code.BAD_REQUEST)

    # Try semantic search first.
    query_embedding: Optional[list[float]] = None
    try:
        r = await get_embedding([query], phase="query")
        if r.ok():
            query_embedding = r.data.embedding[0].tolist()
        else:
            LOG.warning(f"tool query embedding failed: {r.error.errmsg}")
    except Exception as e:
        LOG.warning(f"tool query embedding failed: {e}")

    if query_embedding is not None:
        distance = Tool.embedding.cosine_distance(query_embedding)  # type: ignore[attr-defined]

        q = (
            select(Tool, distance.label("distance"))
            .where(
                Tool.project_id == project_id,
                Tool.embedding.is_not(None),
            )
            .order_by(distance.asc())
            .limit(limit)
        )
        if user_id is None:
            q = q.where(Tool.user_id.is_(None))
        else:
            q = q.where(Tool.user_id == user_id)

        # Optional threshold guardrail (keeps results sane for low-quality embeddings).
        threshold = DEFAULT_CORE_CONFIG.block_embedding_search_cosine_distance_threshold
        if threshold is not None:
            q = q.where(distance <= threshold)

        rows = (await db_session.execute(q)).all()
        if rows:
            hits: list[ToolSearchHit] = []
            for tool, dist in rows:
                hits.append(ToolSearchHit(tool=to_tool_out(tool, fmt), distance=float(dist)))
            return Result.resolve(hits)

    # Fallback: basic substring search (still scoped, but not semantic).
    pattern = f"%{query}%"
    q = (
        select(Tool)
        .where(
            Tool.project_id == project_id,
            or_(
                Tool.name.ilike(pattern),
                Tool.description.ilike(pattern),
                cast(Tool.parameters, Text).ilike(pattern),
            ),
        )
        .order_by(Tool.created_at.desc(), Tool.id.desc())
        .limit(limit)
    )
    if user_id is None:
        q = q.where(Tool.user_id.is_(None))
    else:
        q = q.where(Tool.user_id == user_id)
    tools = (await db_session.execute(q)).scalars().all()
    denominator = max(len(tools), 1)
    hits = [
        ToolSearchHit(
            tool=to_tool_out(t, fmt),
            distance=float(i) / float(denominator),
        )
        for i, t in enumerate(tools)
    ]
    return Result.resolve(hits)
