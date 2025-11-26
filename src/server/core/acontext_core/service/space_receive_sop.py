from ..env import LOG, DEFAULT_CORE_CONFIG
from ..infra.db import DB_CLIENT
from ..infra.async_mq import (
    register_consumer,
    MQ_CLIENT,
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
from .utils import check_redis_lock_or_set, release_redis_lock

register_consumer(
    MQ_CLIENT,
    config=ConsumerConfigData(
        exchange_name=EX.space_task,
        routing_key=RK.space_task_sop_complete_retry,
        queue_name=RK.space_task_sop_complete_retry,
        message_ttl_seconds=DEFAULT_CORE_CONFIG.space_task_sop_lock_wait_seconds,
        need_dlx_queue=True,
        use_dlx_ex_rk=(EX.space_task, RK.space_task_sop_complete),
    ),
)(SpecialHandler.NO_PROCESS)


@register_consumer(
    mq_client=MQ_CLIENT,
    config=ConsumerConfigData(
        exchange_name=EX.space_task,
        routing_key=RK.space_task_sop_complete,
        queue_name=RK.space_task_sop_complete,
    ),
)
async def space_sop_complete_task(body: SOPComplete, message: Message):
    """
    MQ Consumer for SOP completion - Process SOP data with construct agent
    """
    if body.task_id is None:
        LOG.error("Task ID is required for SOP complete")
        return
    _lock_key = f"{RK.space_task_sop_complete}.{body.space_id}"
    _l = await check_redis_lock_or_set(body.project_id, _lock_key)
    if not _l:
        LOG.debug(
            f"Current Space {body.space_id} is locked. "
            f"wait {DEFAULT_CORE_CONFIG.space_task_sop_lock_wait_seconds} seconds for next resend. "
        )
        await MQ_CLIENT.publish(
            exchange_name=EX.space_task,
            routing_key=RK.space_task_sop_complete_retry,
            body=body.model_dump_json(),
        )
        return
    LOG.info(f"Lock Space {body.space_id} for SOP complete task")
    try:
        async with DB_CLIENT.get_session_context() as db_session:
            # First get the task to find its session_id
            r = await TD.fetch_task(db_session, body.task_id)
            if not r.ok():
                LOG.error(f"Task not found: {body.task_id}")
                return
            task_data, _ = r.unpack()

            # Verify session exists and has space
            r = await SD.fetch_session(db_session, task_data.session_id)
            if not r.ok():
                LOG.error(f"Session not found for task {body.task_id}")
                return
            session_data, _ = r.unpack()
            if session_data.space_id is None:
                LOG.info(f"Session {task_data.session_id} has no linked space")
                return

            # Get project config
            r = await PD.get_project_config(db_session, body.project_id)
            project_config, eil = r.unpack()
            if eil:
                LOG.error(f"Project config not found for project {body.project_id}")
                return

        # Call controller to process SOP completion
        await SSC.process_sop_complete(
            project_config, body.project_id, body.space_id, body.task_id, body.sop_data
        )

    except Exception as e:
        LOG.error(f"Error in space_sop_complete_task: {e}")
    finally:
        await release_redis_lock(body.project_id, _lock_key)
