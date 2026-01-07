"""
MQ consumer entrypoint for "SOP complete" events.

This module intentionally stays thin:
- MQ wiring (consumer registration)
- dependency wiring (injecting module globals into the processor)

All batching logic lives in `space_sop_batch_processor.py` to keep this file readable
and to make the batching behavior testable in isolation.
"""

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
from . import space_sop_buffer as SSB
from .space_sop_batch_processor import (
    SOPBatchDependencies,
    SOPBatchProcessor,
    SOPBatchSettings,
)

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
    MQ Consumer for SOP completion - batch SOP data and trigger construct agent.

    The heavy lifting is delegated to `SOPBatchProcessor` to keep this handler easy
    to read and safe to modify.
    """
    settings = SOPBatchSettings(
        lock_wait_seconds=DEFAULT_CORE_CONFIG.space_task_sop_lock_wait_seconds,
        batch_wait_seconds=DEFAULT_CORE_CONFIG.space_task_sop_batch_wait_seconds,
        batch_max_size=DEFAULT_CORE_CONFIG.space_task_sop_batch_max_size,
    )
    deps = SOPBatchDependencies(
        mq_client=MQ_CLIENT,
        exchange_name=EX.space_task,
        retry_routing_key=RK.space_task_sop_complete_retry,
        lock_acquire=check_redis_lock_or_set,
        lock_release=release_redis_lock,
        lock_key_prefix=RK.space_task_sop_complete,
        buffer=SSB,
        db_client=DB_CLIENT,
        project_data=PD,
        task_data=TD,
        session_data=SD,
        controller=SSC,
    )
    try:
        await SOPBatchProcessor(settings, deps).process(body)
    except Exception as e:
        LOG.error(f"space_sop_complete_task failed: {e}", exc_info=True)
