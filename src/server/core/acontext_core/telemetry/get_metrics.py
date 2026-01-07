from sqlalchemy import select
from ..schema.utils import asUUID
from ..infra.db import DB_CLIENT, DatabaseClient
from ..schema.orm import Metric


async def get_metrics(
    project_id: asUUID, tag: str, db_client: DatabaseClient = DB_CLIENT
) -> int | None:
    async with db_client.get_session_context() as session:
        check_stmt = (
            select(Metric.increment)
            .where(Metric.project_id == project_id, Metric.tag == tag)
            .order_by(Metric.created_at.desc())
            .limit(1)
        )
        result = await session.scalars(check_stmt)
        return result.first()
