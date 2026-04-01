import asyncio
import json
from typing import List, Any
from sqlalchemy import select, func, text
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


async def _fetch_message_parts(
    parts_meta: dict, user_kek: bytes | None = None
) -> Result[List[Part]]:
    """
    Helper function to fetch parts for a single message from S3.

    Args:
        parts_meta: Dict containing S3 key information for parts
        user_kek: Optional user KEK for decrypting encrypted S3 objects

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
        parts_json_bytes = await S3_CLIENT.download_object(s3_key, user_kek=user_kek)
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
    db_session: AsyncSession,
    message_ids: List[asUUID],
    user_kek: bytes | None = None,
) -> Result[List[Message]]:
    """
    Fetch messages by their IDs with parts loaded from S3, maintaining the order of message_ids.

    Args:
        db_session: Database session
        message_ids: List of message UUIDs to fetch
        user_kek: Optional user KEK for decrypting encrypted S3 objects

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

        return await hydrate_message_parts(ordered_messages, user_kek=user_kek)

    except Exception as e:
        return Result.reject(f"Error fetching messages by IDs {message_ids}: {e}")


async def hydrate_message_parts(
    messages: List[Message],
    user_kek: bytes | None = None,
) -> Result[List[Message]]:
    """
    Load parts from S3 for already-fetched message rows.

    Mutates each message in place by setting `message.parts`.
    """
    try:
        if not messages:
            return Result.resolve([])

        parts_tasks = [
            _fetch_message_parts(message.parts_asset_meta, user_kek=user_kek)
            for message in messages
        ]
        parts_results = await asyncio.gather(*parts_tasks)

        for message, parts_result in zip(messages, parts_results):
            d, eil = parts_result.unpack()
            if eil:
                message.parts = None
                continue
            message.parts = d

        return Result.resolve(messages)
    except Exception as e:
        return Result.reject(f"Error hydrating message parts: {e}")


async def fetch_message_branch_path_rows(
    db_session: AsyncSession,
    message_id: asUUID,
    session_id: asUUID | None = None,
) -> Result[list[dict[str, Any]]]:
    """
    Fetch one message's branch path from root to the target message.

    Uses a recursive CTE to walk parent_id upward in one query.

    Args:
        db_session: Database session
        message_id: Leaf or intermediate message UUID to start from
        session_id: Optional session UUID to verify the full path belongs to

    Returns:
        Result containing branch path rows ordered from root to target message
    """
    try:
        query = text(
            """
            WITH RECURSIVE message_path AS (
                SELECT id, parent_id, session_id, session_task_process_status, 0 AS depth
                FROM messages
                WHERE id = :message_id

                UNION ALL

                SELECT
                    parent.id,
                    parent.parent_id,
                    parent.session_id,
                    parent.session_task_process_status,
                    child.depth + 1 AS depth
                FROM messages AS parent
                JOIN message_path AS child
                  ON parent.id = child.parent_id
            )
            SELECT id, parent_id, session_id, session_task_process_status, depth
            FROM message_path
            ORDER BY depth DESC, id ASC
            """
        )
        result = await db_session.execute(query, {"message_id": message_id})
        rows = [dict(row) for row in result.mappings().all()]

        if not rows:
            return Result.reject(f"Message {message_id} doesn't exist")

        path_session_ids = {row["session_id"] for row in rows}

        if session_id is not None and path_session_ids != {session_id}:
            return Result.reject(
                f"Message {message_id} does not belong to session {session_id}"
            )

        if len(path_session_ids) != 1:
            return Result.reject(
                f"Message {message_id} has an invalid cross-session parent chain"
            )

        return Result.resolve(rows)
    except Exception as e:
        return Result.reject(
            f"Error fetching branch path for message {message_id}: {e}"
        )


async def fetch_message_branch_path_messages(
    db_session: AsyncSession,
    message_id: asUUID,
    session_id: asUUID | None = None,
) -> Result[List[Message]]:
    """
    Fetch one message's branch path as ordered Message rows.

    Uses a recursive CTE to walk parent_id upward in one query.
    """
    try:
        query = text(
            """
            WITH RECURSIVE message_path AS (
                SELECT id, parent_id, session_id, 0 AS depth
                FROM messages
                WHERE id = :message_id

                UNION ALL

                SELECT
                    parent.id,
                    parent.parent_id,
                    parent.session_id,
                    child.depth + 1 AS depth
                FROM messages AS parent
                JOIN message_path AS child
                  ON parent.id = child.parent_id
            )
            SELECT m.*
            FROM message_path AS mp
            JOIN messages AS m ON m.id = mp.id
            ORDER BY mp.depth DESC, m.id ASC
            """
        )
        result = await db_session.execute(
            select(Message).from_statement(query),
            {"message_id": message_id},
        )
        messages = list(result.scalars().all())

        if not messages:
            return Result.reject(f"Message {message_id} doesn't exist")

        path_session_ids = {message.session_id for message in messages}

        if session_id is not None and path_session_ids != {session_id}:
            return Result.reject(
                f"Message {message_id} does not belong to session {session_id}"
            )

        if len(path_session_ids) != 1:
            return Result.reject(
                f"Message {message_id} has an invalid cross-session parent chain"
            )

        return Result.resolve(messages)
    except Exception as e:
        return Result.reject(
            f"Error fetching branch path messages for message {message_id}: {e}"
        )


async def branch_pending_message_length(
    db_session: AsyncSession,
    message_id: asUUID,
    status: str = "pending",
    session_id: asUUID | None = None,
) -> Result[int]:
    """
    Count pending messages on one message's branch path from root to target.

    Args:
        db_session: Database session
        message_id: Target message UUID
        status: Status filter for messages on the branch
        session_id: Optional session UUID to verify the full path belongs to

    Returns:
        Result containing the count of matching messages on the branch path
    """
    try:
        r = await fetch_message_branch_path_rows(db_session, message_id, session_id)
        rows, eil = r.unpack()
        if eil:
            return Result.reject(str(eil))

        count = sum(1 for row in rows if row["session_task_process_status"] == status)
        return Result.resolve(count)
    except Exception as e:
        return Result.reject(
            f"Error counting branch messages for message {message_id}: {e}"
        )


async def fetch_session_messages(
    db_session: AsyncSession,
    session_id: asUUID,
    status: str = "pending",
    user_kek: bytes | None = None,
) -> Result[List[Message]]:
    """
    Fetch all pending messages for a given session with concurrent S3 parts loading.

    Args:
        db_session: Database session
        session_id: UUID of the session to fetch messages from
        status: Status filter for messages (default: "pending")
        user_kek: Optional user KEK for decrypting encrypted S3 objects

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

    LOG.info("messages.fetched", count=len(message_ids), status=status)

    if not message_ids:
        return Result.resolve([])
    return await fetch_messages_data_by_ids(db_session, message_ids, user_kek=user_kek)


async def get_message_ids(
    db_session: AsyncSession,
    session_id: asUUID,
    status: str = "pending",
    limit: int | None = 1,
    asc: bool = False,
) -> Result[List[asUUID]]:
    query = (
        select(Message.id)
        .where(
            Message.session_id == session_id,
            Message.session_task_process_status == status,
        )
        .order_by(Message.created_at.asc() if asc else Message.created_at.desc())
    )
    if limit is not None:
        query = query.limit(limit)

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
    db_session: AsyncSession,
    session_id: asUUID,
    date_time: datetime,
    limit: int = 10,
    user_kek: bytes | None = None,
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

    return await fetch_messages_data_by_ids(db_session, message_ids, user_kek=user_kek)


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
