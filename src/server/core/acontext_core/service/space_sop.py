import asyncio
from ..env import LOG, DEFAULT_CORE_CONFIG
from ..telemetry.log import bound_logging_vars
from ..infra.redis import REDIS_CLIENT
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
    LOG.info(f"Received SOP complete for task {body.task_id}")
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
        print(f"Space SOP Complete Task Error: {e}")
