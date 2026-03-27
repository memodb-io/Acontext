import asyncio
import base64
from ..env import LOG, DEFAULT_CORE_CONFIG
from ..infra.db import DB_CLIENT
from ..infra.async_mq import (
    register_consumer,
    publish_mq,
    Message,
    ConsumerConfigData,
    SpecialHandler,
)
from ..telemetry.log import get_wide_event, set_wide_event, clear_wide_event
from ..schema.mq.session import InsertNewMessage
from ..schema.utils import asUUID
from ..schema.result import Result
from ..schema.session.learning_space import SessionStatus
from .constants import EX, RK
from .data import learning_space as LS
from .data import message as MD
from .data import project as PD
from .controller import message as MC
from .utils import (
    check_redis_lock_or_set,
    release_redis_lock,
)


def _insert_message_lock_key(session_id: asUUID, message_id: asUUID) -> str:
    return f"session.message.insert.{session_id}.{message_id}"


async def _get_pending_session_message_ids(session_id: asUUID) -> Result[list[asUUID]]:
    async with DB_CLIENT.get_session_context() as session:
        return await MD.get_message_ids(session, session_id, limit=None, asc=True)


@register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.session_message,
        routing_key=RK.session_message_insert,
        queue_name="session.message.insert.entry",
        timeout=DEFAULT_CORE_CONFIG.session_message_consumer_timeout,
    )
)
async def insert_new_message(body: InsertNewMessage, message: Message):
    wide = get_wide_event()

    async with DB_CLIENT.get_session_context() as session:
        r = await MD.check_session_message_status(session, body.message_id)
        msg_status, eil = r.unpack()
        if eil or msg_status != "pending":
            wide["action"] = "skip_not_pending"
            wide["_log_level"] = "debug"
            return

        r = await PD.get_project_config(session, body.project_id)
        project_config, eil = r.unpack()
        if eil:
            return

        r = await MD.branch_pending_message_length(
            session, body.message_id, session_id=body.session_id
        )
        pending_count, eil = r.unpack()
        if eil:
            return

    wide["pending_branch_message_count"] = pending_count

    if (
        not body.process_rightnow
        and pending_count < project_config.project_session_message_buffer_max_turns
    ):
        wide["action"] = "buffer_wait"
        wide["_log_level"] = "debug"
        body.process_rightnow = True
        await publish_mq(
            exchange_name=EX.session_message,
            routing_key=RK.session_message_insert_delay,
            body=body.model_dump_json(),
        )
        return

    lock_key = _insert_message_lock_key(body.session_id, body.message_id)
    _l = await check_redis_lock_or_set(body.project_id, lock_key)
    if not _l:
        wide["lock_acquired"] = False
        wide["action"] = "retry_locked"
        wide["_log_level"] = "debug"
        body.lock_retry_count += 1
        await publish_mq(
            exchange_name=EX.session_message,
            routing_key=RK.session_message_insert_retry,
            body=body.model_dump_json(),
        )
        return

    wide["lock_acquired"] = True
    wide["lock_retries"] = body.lock_retry_count
    wide["process_rightnow"] = body.process_rightnow

    # Decode user KEK from base64 if present in the message.
    # Hard-fail on invalid KEK — continuing with None would silently store
    # plaintext, inconsistent with skill_learner.py's hard-fail pattern.
    user_kek_bytes = None
    if body.user_kek:
        try:
            user_kek_bytes = base64.b64decode(body.user_kek)
        except Exception:
            LOG.error("session_message.invalid_user_kek", session_id=str(body.session_id))
            async with DB_CLIENT.get_session_context() as db_session:
                await LS.update_session_status(db_session, body.session_id, SessionStatus.FAILED)
            return

    try:
        if pending_count > (
            project_config.project_session_message_buffer_max_overflow
            + project_config.project_session_message_buffer_max_turns
        ):
            wide["buffer_overflow"] = True
            wide["action"] = "overflow_truncate"
            await publish_mq(
                exchange_name=EX.session_message,
                routing_key=RK.session_message_insert_retry,
                body=body.model_dump_json(),
            )
        else:
            wide["action"] = "process"
        await MC.process_inserted_message(
            project_config,
            body.project_id,
            body.session_id,
            body.message_id,
            user_kek=user_kek_bytes,
        )
    finally:
        await release_redis_lock(body.project_id, lock_key)


# Delay queue: holds messages for buffer_ttl seconds, then DLX back to entry.
# Replaces the asyncio.create_task timer — survives restarts, no fire-and-forget.
register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.session_message,
        routing_key=RK.session_message_insert_delay,
        queue_name="session.message.insert.delay",
        message_ttl_seconds=DEFAULT_CORE_CONFIG.session_message_buffer_default_ttl_seconds,
        need_dlx_queue=True,
        use_dlx_ex_rk=(EX.session_message, RK.session_message_insert),
    )
)(SpecialHandler.NO_PROCESS)


# Retry queue: holds messages for lock_wait seconds, then DLX back to entry.
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


async def flush_session_message_blocking(
    project_id: asUUID, session_id: asUUID
) -> Result[None]:
    from time import perf_counter

    wide_event: dict = {
        "handler": "flush_session_message_blocking",
        "session_id": str(session_id),
        "project_id": str(project_id),
    }
    set_wide_event(wide_event)
    _start = perf_counter()

    max_retries = DEFAULT_CORE_CONFIG.session_message_flush_max_retries
    try:
        async with DB_CLIENT.get_session_context() as read_session:
            r = await PD.get_project_config(read_session, project_id)
            project_config, eil = r.unpack()
            if eil:
                wide_event["outcome"] = "error"
                wide_event["error"] = str(eil)
                return r

        retry_count = 0
        processed_count = 0
        while retry_count < max_retries:
            r = await _get_pending_session_message_ids(session_id)
            pending_message_ids, eil = r.unpack()
            if eil:
                wide_event["outcome"] = "error"
                wide_event["error"] = str(eil)
                return r
            if not pending_message_ids:
                wide_event["outcome"] = "success"
                wide_event["processed_count"] = processed_count
                wide_event["lock_retries"] = retry_count
                return Result.resolve(None)

            wide_event["pending_count"] = len(pending_message_ids)
            processed_this_round = False
            busy_lock_count = 0

            for message_id in pending_message_ids:
                async with DB_CLIENT.get_session_context() as read_session:
                    r = await MD.check_session_message_status(read_session, message_id)
                    msg_status, eil = r.unpack()
                    if eil:
                        wide_event["outcome"] = "error"
                        wide_event["error"] = str(eil)
                        return r
                    if msg_status != "pending":
                        continue

                lock_key = _insert_message_lock_key(session_id, message_id)
                _l = await check_redis_lock_or_set(project_id, lock_key)
                if not _l:
                    busy_lock_count += 1
                    continue

                try:
                    r = await MC.process_inserted_message(
                        project_config, project_id, session_id, message_id
                    )
                    if not r.ok():
                        wide_event["outcome"] = "failed"
                        wide_event["processed_count"] = processed_count
                        wide_event["lock_retries"] = retry_count
                        return r
                    processed_this_round = True
                    processed_count += 1
                finally:
                    await release_redis_lock(project_id, lock_key)

            wide_event["busy_lock_count"] = busy_lock_count
            wide_event["processed_count"] = processed_count

            if processed_this_round:
                retry_count = 0
                continue

            retry_count += 1
            wide_event["lock_retries"] = retry_count
            await asyncio.sleep(
                DEFAULT_CORE_CONFIG.session_message_session_lock_wait_seconds
            )

        wide_event["outcome"] = "retries_exhausted"
        wide_event["lock_retries"] = max_retries
        return Result.reject(
            f"Failed to flush pending session messages after {max_retries} retries"
        )
    finally:
        wide_event["duration_ms"] = round((perf_counter() - _start) * 1000, 2)
        LOG.info("flush.message.processed", **wide_event)
        clear_wide_event()
