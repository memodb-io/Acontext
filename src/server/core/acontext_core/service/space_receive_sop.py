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
from ..schema.mq.sop import SOPComplete
from .constants import EX, RK
from .data import project as PD
from .data import task as TD
from .data import session as SD
from .controller import space_sop as SSC
from . import space_sop_buffer as SSB
from .utils import check_redis_lock_or_set, release_redis_lock

register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.space_task,
        routing_key=RK.space_task_sop_complete_retry,
        queue_name=RK.space_task_sop_complete_retry,
        message_ttl_seconds=DEFAULT_CORE_CONFIG.space_task_sop_lock_wait_seconds,
        need_dlx_queue=True,
        use_dlx_ex_rk=(EX.space_task, RK.space_task_sop_complete),
    )
)(SpecialHandler.NO_PROCESS)


@register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.space_task,
        routing_key=RK.space_task_sop_complete,
        queue_name=RK.space_task_sop_complete,
    )
)
async def space_sop_complete_task(body: SOPComplete, message: Message):
    """
    MQ Consumer for SOP completion - Process SOP data with construct agent
    """
    if body.task_id is None:
        LOG.error("Task ID is required for SOP complete")
        return

    buffered = await SSB.push_sop_buffer(body)
    if not buffered:
        LOG.warning(
            f"Failed to buffer SOPComplete for space {body.space_id} (task {body.task_id})"
        )

    _lock_key = f"{RK.space_task_sop_complete}.{body.space_id}"
    try:
        _l = await check_redis_lock_or_set(body.project_id, _lock_key)
    except Exception as e:
        LOG.error(
            f"Failed to acquire SOP space lock due to Redis error (space={body.space_id}, task={body.task_id}): {e}"
        )
        await MQ_CLIENT.publish(
            exchange_name=EX.space_task,
            routing_key=RK.space_task_sop_complete_retry,
            body=body.model_dump_json(),
        )
        return
    if not _l:
        LOG.debug(
            f"Current Space {body.space_id} is locked. "
            f"wait {DEFAULT_CORE_CONFIG.space_task_sop_lock_wait_seconds} seconds for next resend. "
        )
        await publish_mq(
            exchange_name=EX.space_task,
            routing_key=RK.space_task_sop_complete_retry,
            body=body.model_dump_json(),
        )
        return
    LOG.info(f"Lock Space {body.space_id} for SOP complete task")
    try:
        popped_entries: list[str] = []
        current_entry_json = body.model_dump_json()

        try:
            await SSB.remove_sop_buffer_entry(
                body.project_id, body.space_id, current_entry_json, count=0
            )
        except Exception as e:
            LOG.warning(
                f"Failed to remove current SOPComplete from buffer (space={body.space_id}, task={body.task_id}): {e}"
            )

        batch_wait_seconds = DEFAULT_CORE_CONFIG.space_task_sop_batch_wait_seconds
        if batch_wait_seconds > 0:
            await asyncio.sleep(batch_wait_seconds)

        max_batch_size = DEFAULT_CORE_CONFIG.space_task_sop_batch_max_size
        if max_batch_size <= 0:
            max_batch_size = 1
            LOG.warning(
                "Invalid space_task_sop_batch_max_size, using default batch size: 1"
            )
        pop_size = max(max_batch_size - 1, 0)
        if pop_size > 0:
            popped_entries = await SSB.pop_sop_buffer_batch(
                body.project_id, body.space_id, pop_size
            )

        skip_reasons: dict[str, int] = {}

        def _skip(reason: str):
            skip_reasons[reason] = skip_reasons.get(reason, 0) + 1

        parsed_items: list[tuple[str, SOPComplete]] = [(current_entry_json, body)]
        for entry_json in popped_entries:
            item = SSB.parse_sop_buffer_entry(entry_json)
            if item is None:
                _skip("invalid_payload")
                continue
            if item.project_id != body.project_id or item.space_id != body.space_id:
                _skip("project_or_space_mismatch")
                continue
            if item.task_id is None:
                _skip("missing_task_id")
                continue
            parsed_items.append((entry_json, item))

        if not parsed_items:
            LOG.info(
                f"SOPComplete batch empty after parsing/filtering "
                f"(space={body.space_id}, popped={len(popped_entries) + 1}, skip={sum(skip_reasons.values())}, "
                f"skip_reasons={skip_reasons})"
            )
            return

        seen_task_ids: set = set()
        unique_items: list[tuple[str, SOPComplete]] = []
        for entry_json, item in parsed_items:
            if item.task_id in seen_task_ids:
                _skip("duplicate_task_id")
                continue
            seen_task_ids.add(item.task_id)
            unique_items.append((entry_json, item))

        project_config = None
        processable_items: list[tuple[str, SOPComplete]] = []
        current_is_processable = False
        try:
            async with DB_CLIENT.get_session_context() as db_session:
                r = await PD.get_project_config(db_session, body.project_id)
                project_config, eil = r.unpack()
                if eil:
                    for _entry_json, _item in unique_items:
                        _skip("project_not_found")
                else:
                    for entry_json, item in unique_items:
                        r = await TD.fetch_task(db_session, item.task_id)
                        if not r.ok():
                            _skip("task_not_found")
                            continue
                        task_data, _ = r.unpack()
                        if task_data.space_digested:
                            _skip("task_already_space_digested")
                            continue
                        r = await SD.fetch_session(db_session, task_data.session_id)
                        if not r.ok():
                            _skip("session_not_found")
                            continue
                        session_data, _ = r.unpack()
                        if session_data.space_id is None:
                            _skip("session_has_no_space")
                            continue
                        if session_data.space_id != body.space_id:
                            _skip("task_space_mismatch")
                            continue
                        processable_items.append((entry_json, item))
                        if item.task_id == body.task_id:
                            current_is_processable = True
        except Exception as e:
            restored = await SSB.push_sop_buffer_entries_json(
                body.project_id,
                body.space_id,
                [entry_json for entry_json, _item in unique_items],
            )
            if restored:
                await MQ_CLIENT.publish(
                    exchange_name=EX.space_task,
                    routing_key=RK.space_task_sop_complete_retry,
                    body=body.model_dump_json(),
                )
            else:
                for _entry_json, item in unique_items:
                    await MQ_CLIENT.publish(
                        exchange_name=EX.space_task,
                        routing_key=RK.space_task_sop_complete_retry,
                        body=item.model_dump_json(),
                    )
            LOG.warning(
                f"SOPComplete batch DB failure, scheduled retry "
                f"(space={body.space_id}, retryable_failure={len(unique_items)}, popped={len(popped_entries) + 1}, "
                f"skip={sum(skip_reasons.values())}, skip_reasons={skip_reasons}): {e}"
            )
            return

        if not processable_items:
            try:
                await SSB.remove_sop_buffer_entry(
                    body.project_id, body.space_id, current_entry_json, count=0
                )
            except Exception:
                pass
            LOG.info(
                f"SOPComplete batch empty after filtering "
                f"(space={body.space_id}, popped={len(popped_entries) + 1}, skip={sum(skip_reasons.values())}, "
                f"skip_reasons={skip_reasons})"
            )
            return

        retry_trigger_item = processable_items[0][1]
        try:
            task_ids = [item.task_id for _entry_json, item in processable_items]
            sop_datas = [item.sop_data for _entry_json, item in processable_items]
            r = await SSC.process_sop_complete_batch(
                project_config,
                body.project_id,
                body.space_id,
                task_ids,
                sop_datas,
            )
        except Exception as e:
            if not current_is_processable:
                try:
                    await SSB.remove_sop_buffer_entry(
                        body.project_id, body.space_id, current_entry_json, count=0
                    )
                except Exception:
                    pass
            restored = await SSB.push_sop_buffer_entries_json(
                body.project_id,
                body.space_id,
                [entry_json for entry_json, _item in processable_items],
            )
            if restored:
                await MQ_CLIENT.publish(
                    exchange_name=EX.space_task,
                    routing_key=RK.space_task_sop_complete_retry,
                    body=retry_trigger_item.model_dump_json(),
                )
            else:
                for _entry_json, item in processable_items:
                    await MQ_CLIENT.publish(
                        exchange_name=EX.space_task,
                        routing_key=RK.space_task_sop_complete_retry,
                        body=item.model_dump_json(),
                    )
            LOG.warning(
                f"SOPComplete batch processing exception, scheduled retry "
                f"(space={body.space_id}, retryable_failure={len(processable_items)}, popped={len(popped_entries) + 1}, "
                f"skip={sum(skip_reasons.values())}, skip_reasons={skip_reasons}): {e}"
            )
            return

        if not r.ok():
            if not current_is_processable:
                try:
                    await SSB.remove_sop_buffer_entry(
                        body.project_id, body.space_id, current_entry_json, count=0
                    )
                except Exception:
                    pass
            restored = await SSB.push_sop_buffer_entries_json(
                body.project_id,
                body.space_id,
                [entry_json for entry_json, _item in processable_items],
            )
            if restored:
                await MQ_CLIENT.publish(
                    exchange_name=EX.space_task,
                    routing_key=RK.space_task_sop_complete_retry,
                    body=retry_trigger_item.model_dump_json(),
                )
            else:
                for _entry_json, item in processable_items:
                    await MQ_CLIENT.publish(
                        exchange_name=EX.space_task,
                        routing_key=RK.space_task_sop_complete_retry,
                        body=item.model_dump_json(),
                    )
            LOG.warning(
                f"SOPComplete batch retryable failure, scheduled retry "
                f"(space={body.space_id}, retryable_failure={len(processable_items)}, popped={len(popped_entries) + 1}, "
                f"skip={sum(skip_reasons.values())}, skip_reasons={skip_reasons})"
            )
            return

        try:
            await SSB.remove_sop_buffer_entry(
                body.project_id, body.space_id, current_entry_json, count=0
            )
        except Exception:
            pass
        LOG.info(
            f"SOPComplete batch processed successfully "
            f"(space={body.space_id}, success={len(processable_items)}, popped={len(popped_entries) + 1}, "
            f"skip={sum(skip_reasons.values())}, skip_reasons={skip_reasons})"
        )

    except Exception as e:
        await SSB.push_sop_buffer_entries_json(
            body.project_id,
            body.space_id,
            [body.model_dump_json(), *popped_entries],
        )
        await MQ_CLIENT.publish(
            exchange_name=EX.space_task,
            routing_key=RK.space_task_sop_complete_retry,
            body=body.model_dump_json(),
        )
        LOG.error(
            f"Error in space_sop_complete_task, scheduled retry (space={body.space_id}, task={body.task_id}): {e}"
        )
    finally:
        try:
            await release_redis_lock(body.project_id, _lock_key)
        except Exception as e:
            LOG.error(
                f"Failed to release SOP space lock (space={body.space_id}, task={body.task_id}): {e}"
            )
