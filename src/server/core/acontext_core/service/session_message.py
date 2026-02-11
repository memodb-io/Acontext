import asyncio
from ..env import LOG, DEFAULT_CORE_CONFIG
from ..infra.db import DB_CLIENT
from ..infra.async_mq import (
    register_consumer,
    publish_mq,
    Message,
    ConsumerConfigData,
    SpecialHandler,
)
from ..schema.mq.session import InsertNewMessage
from ..schema.utils import asUUID
from ..schema.result import Result
from .constants import EX, RK
from .data import message as MD
from .data import project as PD
from .controller import message as MC
from .utils import (
    check_redis_lock_or_set,
    release_redis_lock,
    check_buffer_timer_or_set,
)


async def waiting_for_message_notify(wait_for_seconds: int, body: InsertNewMessage):
    LOG.debug(
        f"Session message buffer is not full, wait {wait_for_seconds} seconds for next turn/idle notify"
    )
    await asyncio.sleep(wait_for_seconds)
    timer_body = InsertNewMessage(
        project_id=body.project_id,
        session_id=body.session_id,
        message_id=body.message_id,
        skip_latest_check=True,
    )
    await publish_mq(
        exchange_name=EX.session_message,
        routing_key=RK.session_message_buffer_process,
        body=timer_body.model_dump_json(),
    )


@register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.session_message,
        routing_key=RK.session_message_insert,
        queue_name="session.message.insert.entry",
    )
)
async def insert_new_message(body: InsertNewMessage, message: Message):
    LOG.debug(f"Insert new message {body.message_id}")
    async with DB_CLIENT.get_session_context() as read_session:
        r = await MD.get_message_ids(read_session, body.session_id)
        message_ids, eil = r.unpack()
        if eil:
            return
        if not len(message_ids):
            LOG.debug(f"No pending message found for session {body.session_id}, ignore")
            return
        latest_pending_message_id = message_ids[0]
        if not body.skip_latest_check and body.message_id != latest_pending_message_id:
            LOG.debug(
                f"Message {body.message_id} is not the latest pending message, ignore"
            )
            return

        r = await PD.get_project_config(read_session, body.project_id)
        project_config, eil = r.unpack()
        if eil:
            return

        r = await MD.session_message_length(read_session, body.session_id)
        pending_message_length, eil = r.unpack()
        if eil:
            return
        if (
            pending_message_length
            < project_config.project_session_message_buffer_max_turns
        ):
            should_create_timer = await check_buffer_timer_or_set(
                body.project_id,
                body.session_id,
                project_config.project_session_message_buffer_ttl_seconds,
            )
            if should_create_timer:
                asyncio.create_task(
                    waiting_for_message_notify(
                        project_config.project_session_message_buffer_ttl_seconds,
                        body,
                    )
                )
            else:
                LOG.debug(
                    f"Buffer timer already exists for session {body.session_id}, skip creating new timer"
                )
            return

    # Reset flag so retries always go through the normal dedup path
    body.skip_latest_check = False
    _l = await check_redis_lock_or_set(
        body.project_id, f"session.message.insert.{body.session_id}"
    )
    if not _l:
        LOG.debug(
            f"Current Session is locked. "
            f"wait {DEFAULT_CORE_CONFIG.session_message_session_lock_wait_seconds} seconds for next resend. "
            f"Message {body.message_id}"
        )
        await publish_mq(
            exchange_name=EX.session_message,
            routing_key=RK.session_message_insert_retry,
            body=body.model_dump_json(),
        )
        return

    try:
        LOG.info(
            f"Session message buffer is full (size: {pending_message_length}), start process"
        )
        if pending_message_length > (
            project_config.project_session_message_buffer_max_overflow
            + project_config.project_session_message_buffer_max_turns
        ):
            LOG.info(
                f"Session message buffer is overflow "
                f"(size: {pending_message_length} > {project_config.project_session_message_buffer_max_overflow} + {project_config.project_session_message_buffer_max_turns}), "
                f"Truncate the buffer, the rest will be re-inserted in {DEFAULT_CORE_CONFIG.session_message_session_lock_wait_seconds} seconds"
            )
            await publish_mq(
                exchange_name=EX.session_message,
                routing_key=RK.session_message_insert_retry,
                body=body.model_dump_json(),
            )
        await MC.process_session_pending_message(
            project_config, body.project_id, body.session_id
        )
    finally:
        await release_redis_lock(
            body.project_id, f"session.message.insert.{body.session_id}"
        )


register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.session_message,
        routing_key=RK.session_message_insert_retry,
        queue_name="session.message.insert.retry",
        message_ttl_seconds=DEFAULT_CORE_CONFIG.session_message_session_lock_wait_seconds,
        need_dlx_queue=True,
        use_dlx_ex_rk=(EX.session_message, RK.session_message_insert),
    )
)(SpecialHandler.NO_PROCESS)


@register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.session_message,
        routing_key=RK.session_message_buffer_process,
        queue_name="session.message.buffer.process",
    )
)
async def buffer_new_message(body: InsertNewMessage, message: Message):
    async with DB_CLIENT.get_session_context() as session:
        r = await MD.get_message_ids(session, body.session_id)
        message_ids, eil = r.unpack()
        if eil:
            return
        if not len(message_ids):
            LOG.debug(f"No pending message found for session {body.session_id}, ignore")
            return
        latest_pending_message_id = message_ids[0]
        if not body.skip_latest_check and body.message_id != latest_pending_message_id:
            LOG.debug(
                f"Message {body.message_id} is not the latest pending message, ignore"
            )
            return
        r = await PD.get_project_config(session, body.project_id)
        project_config, eil = r.unpack()
        if eil:
            return
    LOG.info(f"Message {body.message_id} IDLE, process it now")

    body.skip_latest_check = False
    _l = await check_redis_lock_or_set(
        body.project_id, f"session.message.insert.{body.session_id}"
    )
    if not _l:
        LOG.info(
            f"Current Session is locked, resend Message {body.message_id} to insert queue."
        )
        # Reset flag so retries always go through the normal dedup path
        await publish_mq(
            exchange_name=EX.session_message,
            routing_key=RK.session_message_insert_retry,
            body=body.model_dump_json(),
        )
        return
    try:
        await MC.process_session_pending_message(
            project_config, body.project_id, body.session_id
        )
    finally:
        await release_redis_lock(
            body.project_id, f"session.message.insert.{body.session_id}"
        )


async def flush_session_message_blocking(
    project_id: asUUID, session_id: asUUID
) -> Result[None]:
    max_retries = DEFAULT_CORE_CONFIG.session_message_flush_max_retries
    for _attempt in range(max_retries):
        _l = await check_redis_lock_or_set(
            project_id, f"session.message.insert.{session_id}"
        )
        if _l:
            break
        LOG.debug(
            f"Current Session is locked (attempt {_attempt + 1}/{max_retries}). "
            f"wait {DEFAULT_CORE_CONFIG.session_message_session_lock_wait_seconds} seconds for next resend. "
        )
        await asyncio.sleep(
            DEFAULT_CORE_CONFIG.session_message_session_lock_wait_seconds
        )
    else:
        LOG.warning(
            f"flush_session_message_blocking exhausted {max_retries} retries for session {session_id}"
        )
        return Result.reject(
            f"Failed to acquire session lock after {max_retries} retries"
        )

    try:
        async with DB_CLIENT.get_session_context() as read_session:
            r = await PD.get_project_config(read_session, project_id)
            project_config, eil = r.unpack()
            if eil:
                return r
        r = await MC.process_session_pending_message(
            project_config, project_id, session_id
        )
        return r
    finally:
        await release_redis_lock(project_id, f"session.message.insert.{session_id}")
