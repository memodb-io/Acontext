from ..data import message as MD
from ...infra.db import DB_CLIENT
from ...schema.session.task import TaskStatus
from ...schema.session.message import MessageBlob
from ...schema.utils import asUUID
from ...llm.agent import task as AT
from ...schema.result import ResultError
from ...env import LOG, DEFAULT_CORE_CONFIG
from ...schema.config import ProjectConfig
from ...schema.session.task import TaskSchema


async def process_space_task(
    project_config: ProjectConfig, space_id: asUUID, task: TaskSchema
):
    if task.task_status != TaskStatus.SUCCESS:
        LOG.info(f"Task {task.id} is not success, skipping")
        return

    async with DB_CLIENT.get_session_context() as db_session:
        # 1. fetch messages from task
        msg_ids = task.raw_message_ids
        r = await MD.fetch_messages_data_by_ids(db_session, msg_ids)
        if not r.ok():
            return
        messages, _ = r.unpack()
        messages_data = [
            MessageBlob(message_id=m.id, role=m.role, parts=m.parts, task_id=m.task_id)
            for m in messages
        ]
    # 2. call agent to digest raw messages to SOP
    ...

    # 3. Create block and trigger space_agent to save it
    ...
