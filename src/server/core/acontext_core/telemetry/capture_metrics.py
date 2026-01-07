from datetime import datetime, timezone
import hashlib

from sqlalchemy import select, update, func, text

from ..schema.utils import asUUID
from ..infra.db import DatabaseClient, DB_CLIENT
from ..schema.orm import Metric


async def capture_increment(
    project_id: asUUID,
    tag: str,
    increment: int = 1,
    db_client: DatabaseClient = DB_CLIENT,
) -> None:
    """
    Fetch the latest metric row for the given project and tag.
    - If no row exists for today, create a new one.
    - Then increment the `increment` field on that row atomically on the DB server side.

    Uses PostgreSQL advisory locks to prevent race conditions when multiple
    concurrent calls try to create the same row.
    """
    async with db_client.get_session_context() as session:
        # Always compare dates in a consistent timezone (UTC)
        today_utc = datetime.now(timezone.utc).date()

        # Generate a unique lock key from project_id, tag, and date
        # PostgreSQL advisory locks use bigint, so we hash the combination
        lock_key_str = f"{project_id}:{tag}:{today_utc}"
        lock_key = int(hashlib.md5(lock_key_str.encode()).hexdigest()[:15], 16)

        # Acquire an advisory lock for this specific (project_id, tag, date) combination
        # This ensures only one transaction can check/create at a time
        await session.execute(
            text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": lock_key}
        )

        # Now check if any row exists for today (we hold the lock, so safe)
        check_stmt = (
            select(Metric)
            .where(
                Metric.project_id == project_id,
                Metric.tag == tag,
                func.date(Metric.created_at) == today_utc,
            )
            .order_by(Metric.created_at.desc())
            .limit(1)
        )
        result = await session.scalars(check_stmt)
        metric = result.first()

        # If there is no metric yet for today, create a new row
        if metric is None:
            metric = Metric(project_id=project_id, tag=tag, increment=0)
            session.add(metric)
            # Flush so that metric.id is available for the UPDATE statement
            await session.flush()

        # Atomically increment the counter on the database server side to avoid data races
        await session.execute(
            update(Metric)
            .where(Metric.id == metric.id)
            .values(increment=Metric.increment + increment)
        )
