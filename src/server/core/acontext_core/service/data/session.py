from ...schema.orm import Session
from ...schema.utils import asUUID
from ...schema.result import Result
from ...infra.db import AsyncSession


async def fetch_session(
    db_session: AsyncSession, session_id: asUUID
) -> Result[Session]:
    session_record = await db_session.get(Session, session_id)
    if session_record is None:
        return Result.reject(f"Session {session_id} not found")
    return Result.resolve(session_record)


async def update_session_display_title(
    db_session: AsyncSession, session_id: asUUID, display_title: str
) -> Result[None]:
    # Force-write helper used by callers that intentionally want to replace a
    # previously generated title.
    session_record = await db_session.get(Session, session_id)
    if session_record is None:
        return Result.reject(f"Session {session_id} not found")
    session_record.display_title = display_title
    await db_session.flush()
    return Result.resolve(None)


# Keep a separate write-once helper so callers can opt into "set if empty"
# behavior without changing the existing force-update helper.
async def update_session_display_title_once(
    db_session: AsyncSession, session_id: asUUID, display_title: str
) -> Result[bool]:
    session_record, eil = (await fetch_session(db_session, session_id)).unpack()
    if eil:
        return Result.reject(eil.errmsg)
    # Preserve the first non-empty title we have already stored.
    if (session_record.display_title or "").strip():
        return Result.resolve(False)
    session_record.display_title = display_title
    await db_session.flush()
    return Result.resolve(True)


async def should_generate_session_display_title(
    db_session: AsyncSession, session_id: asUUID
) -> Result[bool]:
    r = await fetch_session(db_session, session_id)
    session_record, eil = r.unpack()
    if eil:
        return Result.reject(eil.errmsg)
    # Empty strings are treated the same as NULL so we can regenerate blanks.
    return Result.resolve(
        session_record.display_title is None
        or session_record.display_title.strip() == ""
    )
