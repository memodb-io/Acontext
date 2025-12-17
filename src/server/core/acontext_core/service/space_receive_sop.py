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
    _l = await check_redis_lock_or_set(body.project_id, _lock_key)
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
        popped_entries = await SSB.pop_sop_buffer_batch(
            body.project_id, body.space_id, pop_size
        )

        invalid_count = 0
        mismatch_count = 0
        missing_task_id_count = 0
        duplicate_count = 0

        candidate_items: list[SOPComplete] = [body]
        for entry_json in popped_entries:
            item = SSB.parse_sop_buffer_entry(entry_json)
            if item is None:
                invalid_count += 1
                continue
            candidate_items.append(item)

        task_ids: list = []
        sop_datas: list = []
        seen_task_ids: set = set()
        for item in candidate_items:
            if item.project_id != body.project_id or item.space_id != body.space_id:
                mismatch_count += 1
                continue
            if item.task_id is None:
                missing_task_id_count += 1
                continue
            if item.task_id in seen_task_ids:
                duplicate_count += 1
                continue
            seen_task_ids.add(item.task_id)
            task_ids.append(item.task_id)
            sop_datas.append(item.sop_data)

        if not task_ids:
            LOG.info(
                f"SOPComplete batch is empty after filtering "
                f"(space={body.space_id}, popped={len(popped_entries)}, "
                f"invalid={invalid_count}, mismatch={mismatch_count}, "
                f"missing_task_id={missing_task_id_count}, duplicate={duplicate_count})"
            )
            return

        async with DB_CLIENT.get_session_context() as db_session:
            r = await PD.get_project_config(db_session, body.project_id)
            project_config, eil = r.unpack()
            if eil:
                LOG.error(f"Project config not found for project {body.project_id}")
                return

            filtered_task_ids = []
            filtered_sop_datas = []
            task_not_found_count = 0
            session_not_found_count = 0
            no_space_count = 0
            task_space_mismatch_count = 0
            for task_id, sop_data in zip(task_ids, sop_datas):
                r = await TD.fetch_task(db_session, task_id)
                if not r.ok():
                    task_not_found_count += 1
                    continue
                task_data, _ = r.unpack()
                r = await SD.fetch_session(db_session, task_data.session_id)
                if not r.ok():
                    session_not_found_count += 1
                    continue
                session_data, _ = r.unpack()
                if session_data.space_id is None:
                    no_space_count += 1
                    continue
                if session_data.space_id != body.space_id:
                    task_space_mismatch_count += 1
                    continue
                filtered_task_ids.append(task_id)
                filtered_sop_datas.append(sop_data)

        if not filtered_task_ids:
            LOG.info(
                f"SOPComplete batch is empty after DB validation "
                f"(space={body.space_id}, popped={len(popped_entries)}, "
                f"task_not_found={task_not_found_count}, "
                f"session_not_found={session_not_found_count}, "
                f"no_space={no_space_count}, "
                f"task_space_mismatch={task_space_mismatch_count})"
            )
            return

        LOG.info(
            f"Processing SOPComplete batch "
            f"(space={body.space_id}, size={len(filtered_task_ids)}, popped={len(popped_entries)}, "
            f"invalid={invalid_count}, mismatch={mismatch_count}, "
            f"missing_task_id={missing_task_id_count}, duplicate={duplicate_count}, "
            f"task_not_found={task_not_found_count}, session_not_found={session_not_found_count}, "
            f"no_space={no_space_count}, task_space_mismatch={task_space_mismatch_count})"
        )

        r = await SSC.process_sop_complete_batch(
            project_config,
            body.project_id,
            body.space_id,
            filtered_task_ids,
            filtered_sop_datas,
        )
        if r.ok():
            await SSB.remove_sop_buffer_entry(
                body.project_id, body.space_id, body.model_dump_json(), count=0
            )

    except Exception as e:
        LOG.error(f"Error in space_sop_complete_task: {e}")
    finally:
        await release_redis_lock(body.project_id, _lock_key)
