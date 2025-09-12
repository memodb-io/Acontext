import asyncio
import json
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import ValidationError
from ...schema.orm import Message, Part, Asset
from ...schema.result import Result
from ...schema.utils import asUUID
from ...infra.s3 import S3_CLIENT
from ...env import LOG


async def _fetch_message_parts(parts_meta: dict) -> Result[List[Part]]:
    """
    Helper function to fetch parts for a single message from S3.

    Args:
        message: Message object with parts_meta containing S3 information

    Returns:
        List of Part objects
    """
    try:
        # Extract S3 key from parts_meta
        try:
            asset = Asset(**parts_meta)
        except ValidationError as e:
            return Result.reject(f"Failed to validate parts asset {parts_meta}: {e}")
        s3_key = asset.s3_key
        # Download parts JSON from S3
        parts_json_bytes = await S3_CLIENT.download_object(s3_key)
        parts_json = json.loads(parts_json_bytes.decode("utf-8"))
        assert isinstance(parts_json, list), "Parts Json must be a list"
        try:
            parts = [Part(**pj) for pj in parts_json]
        except ValidationError as e:
            return Result.reject(f"Failed to validate parts {parts_json}: {e}")

        return Result.resolve(parts)
    except Exception as e:
        return Result.reject(f"Failed to fetch parts {parts_meta}: {e}")


async def fetch_messages(
    db_session: AsyncSession, session_id: asUUID, status: str = "pending"
) -> Result[List[Message]]:
    """
    Fetch all pending messages for a given session with concurrent S3 parts loading.

    Args:
        session_id: UUID of the session to fetch messages from

    Returns:
        List of Message objects with parts loaded from S3
    """
    # Query for pending messages in the session
    query = (
        select(Message)
        .where(
            Message.session_id == session_id,
            Message.session_task_process_status == status,
        )
        .order_by(Message.created_at.asc())
    )

    result = await db_session.execute(query)
    messages = list(result.scalars().all())

    LOG.info(f"Found {len(messages)} {status} messages")

    if not messages:
        return Result.resolve([])

    # Fetch parts concurrently for all messages
    parts_tasks = [_fetch_message_parts(message.parts_meta) for message in messages]
    parts_results = await asyncio.gather(*parts_tasks, return_exceptions=True)

    # Assign parts to messages
    for message, parts_result in zip(messages, parts_results):
        d, eil = parts_result.unpack()
        if eil:
            LOG.error(f"Exception while fetching parts for message {eil}")
            message.parts = None
            continue
        message.parts = d
    return Result.resolve(messages)


if __name__ == "__main__":
    import asyncio
    from ...infra.db import DB_CLIENT

    async def main():
        await DB_CLIENT.create_tables()
        async with DB_CLIENT.get_session_context() as session:
            r = await fetch_messages(session, "16e43a3d-f409-4ccb-830b-852d4107c3db")
            d, eil = r.unpack()
            print([dd.created_at for dd in d])
        await S3_CLIENT.close()

    asyncio.run(main())
