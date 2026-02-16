from ...schema.orm import Session
from ...schema.utils import asUUID
from ...schema.result import Result
from ...infra.db import AsyncSession


async def fetch_session(
    db_session: AsyncSession, session_id: asUUID
) -> Result[Session]:
    session = await db_session.get(Session, session_id)
    if session is None:
        return Result.reject(f"Session {session_id} not found")
    return Result.resolve(session)


async def update_session_display_title(
    db_session: AsyncSession, session_id: asUUID, display_title: str
) -> Result[None]:
    session = await db_session.get(Session, session_id)
    if session is None:
        return Result.reject(f"Session {session_id} not found")
    session.display_title = display_title
    await db_session.flush()
    return Result.resolve(None)


async def should_generate_session_display_title(
    db_session: AsyncSession, session_id: asUUID
) -> Result[bool]:
    r = await fetch_session(db_session, session_id)
    session, eil = r.unpack()
    if eil:
        return Result.reject(eil.errmsg)
    return Result.resolve(
        session.display_title is None or session.display_title.strip() == ""
    )
