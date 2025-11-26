from ..env import LOG
from ..infra.db import DB_CLIENT
from ..infra.async_mq import register_consumer, MQ_CLIENT, Message, ConsumerConfigData
from ..schema.mq.space import NewTaskComplete
from .constants import EX, RK
from .data import project as PD
from .data import task as TD
from .data import session as SD
from .controller import space_task as STC


@register_consumer(
    mq_client=MQ_CLIENT,
    config=ConsumerConfigData(
        exchange_name=EX.space_task,
        routing_key=RK.space_task_new_complete,
        queue_name=RK.space_task_new_complete,
    ),
)
async def space_complete_new_task(body: NewTaskComplete, message: Message):
    async with DB_CLIENT.get_session_context() as db_session:
        r = await SD.fetch_session(db_session, body.session_id)
        if not r.ok():
            return
        session_data, _ = r.unpack()
        if session_data.space_id is None:
            LOG.info(f"Session {body.session_id} has no linked space")
            return
        SPACE_ID = session_data.space_id
        r = await TD.fetch_task(db_session, body.task_id)
        if not r.ok():
            return
        TASK_DATA, _ = r.unpack()
        if TASK_DATA.space_digested:
            LOG.info(f"Task {body.task_id} is already digested")
            return

        r = await PD.get_project_config(db_session, body.project_id)
        project_config, eil = r.unpack()
        if eil:
            return

    await STC.process_space_task(
        project_config, body.project_id, SPACE_ID, body.session_id, TASK_DATA
    )
