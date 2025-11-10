import asyncio
import json
from typing import List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import ValidationError
from datetime import datetime
from sqlalchemy import update
from ...schema.session.task import TaskStatus
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
        return Result.reject(f"Unknown error to fetch parts {parts_meta}: {e}")


async def session_message_length(
    db_session: AsyncSession, session_id: asUUID, status: str = "pending"
) -> Result[int]:
    """
    Get the count of messages for a given session with a specific status.

    Args:
        db_session: Database session
        session_id: UUID of the session to count messages from
        status: Status filter for messages (default: "pending")

    Returns:
        Result containing the count of messages
    """
    try:
        query = select(func.count(Message.id)).where(
            Message.session_id == session_id,
            Message.session_task_process_status == status,
        )

        result = await db_session.execute(query)
        count = result.scalar()

        return Result.resolve(count)

    except Exception as e:
        return Result.reject(f"Error counting messages for session {session_id}: {e}")


async def fetch_messages_data_by_ids(
    db_session: AsyncSession, message_ids: List[asUUID]
) -> Result[List[Message]]:
    """
    Fetch messages by their IDs with parts loaded from S3, maintaining the order of message_ids.

    Args:
        db_session: Database session
        message_ids: List of message UUIDs to fetch

    Returns:
        Result containing list of Message objects with parts loaded, in the same order as message_ids
    """
    try:
        if not message_ids:
            return Result.resolve([])

        # Query messages by IDs
        query = select(Message).where(Message.id.in_(message_ids))
        result = await db_session.execute(query)
        messages_dict = {msg.id: msg for msg in result.scalars().all()}

        # Maintain the order of message_ids by creating ordered list
        try:
            ordered_messages = [messages_dict[msg_id] for msg_id in message_ids]
        except KeyError as e:
            return Result.reject(
                f"Some messages({message_ids}) not found in database: {e}"
            )

        if not ordered_messages:
            return Result.resolve([])

        # Fetch parts concurrently for all messages
        parts_tasks = [
            _fetch_message_parts(message.parts_asset_meta) for message in ordered_messages
        ]
        parts_results = await asyncio.gather(*parts_tasks)

        # Assign parts to messages
        for message, parts_result in zip(ordered_messages, parts_results):
            d, eil = parts_result.unpack()
            if eil:
                message.parts = None
                continue
            message.parts = d

        return Result.resolve(ordered_messages)

    except Exception as e:
        return Result.reject(f"Error fetching messages by IDs {message_ids}: {e}")


async def fetch_session_messages(
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
        select(Message.id)
        .where(
            Message.session_id == session_id,
            Message.session_task_process_status == status,
        )
        .order_by(Message.created_at.asc())
    )

    result = await db_session.execute(query)
    message_ids = list(result.scalars().all())

    LOG.info(f"Found {len(message_ids)} {status} messages")

    if not message_ids:
        return Result.resolve([])
    return await fetch_messages_data_by_ids(db_session, message_ids)


async def get_message_ids(
    db_session: AsyncSession,
    session_id: asUUID,
    status: str = "pending",
    limit: int = 1,
    asc: bool = False,
) -> Result[List[asUUID]]:
    query = (
        select(Message.id)
        .where(
            Message.session_id == session_id,
            Message.session_task_process_status == status,
        )
        .order_by(Message.created_at.asc() if asc else Message.created_at.desc())
        .limit(limit)
    )

    result = await db_session.execute(query)
    message_ids = list(result.scalars().all())
    return Result.resolve(message_ids)


async def unpending_session_messages_to_running(
    db_session: AsyncSession, session_id: asUUID, limit: int
) -> Result[List[asUUID]]:
    query = (
        update(Message)
        .where(
            Message.session_id == session_id,
            Message.session_task_process_status == TaskStatus.PENDING.value,
        )
        .values(session_task_process_status=TaskStatus.RUNNING.value)
        .returning(Message.id, Message.created_at)
    )
    result = await db_session.execute(query)
    rdp = sorted(result.mappings().all(), key=lambda x: x["created_at"])
    message_ids = [rdp["id"] for rdp in rdp]
    await db_session.flush()
    return Result.resolve(message_ids)


async def check_session_message_status(
    db_session: AsyncSession, message_id: asUUID
) -> Result[str]:
    query = (
        select(Message.session_task_process_status)
        .where(
            Message.id == message_id,
        )
        .order_by(Message.created_at.asc())
    )
    result = await db_session.execute(query)
    status = result.scalars().first()
    if status is None:
        return Result.reject(f"Message {message_id} doesn't exist")
    return Result.resolve(status)


async def fetch_previous_messages_by_datetime(
    db_session: AsyncSession, session_id: asUUID, date_time: datetime, limit: int = 10
) -> Result[List[Message]]:
    query = (
        select(Message.id, Message.created_at)
        .where(Message.created_at < date_time, Message.session_id == session_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    result = await db_session.execute(query)
    _dp = sorted(result.all(), key=lambda x: x[1])
    message_ids = [dp[0] for dp in _dp]

    return await fetch_messages_data_by_ids(db_session, message_ids)


async def update_message_status_to(
    db_session: AsyncSession, message_ids: List[asUUID], status: TaskStatus
) -> Result[bool]:
    """
    Rollback message status from 'running' to 'pending' for retry.

    Args:
        db_session: Database session
        message_ids: List of message IDs to rollback

    Returns:
        Result indicating success or failure
    """

    # Update all messages in one query
    stmt = (
        update(Message)
        .where(Message.id.in_(message_ids))
        .values(session_task_process_status=status.value)
    )

    await db_session.execute(stmt)
    await db_session.flush()

    return Result.resolve(True)
