from ..data import message as MD
from ...infra.db import DB_CLIENT
from ...schema.session.task import TaskStatus
from ...schema.session.message import MessageBlob
from ...schema.utils import asUUID
from ...llm.agent import task_sop as TSOP
from ...env import LOG
from ...schema.config import ProjectConfig
from ...schema.result import Result
from ...schema.session.task import TaskSchema
from ..data import task as TD
from ...telemetry.get_metrics import get_metrics
from ...constants import ExcessMetricTags


async def process_space_task(
    project_config: ProjectConfig,
    project_id: asUUID,
    space_id: asUUID,
    session_id: asUUID,
    task: TaskSchema,
) -> Result[None]:
    disabled = await get_metrics(project_id, ExcessMetricTags.new_skill_learned)
    if disabled:
        LOG.warning(f"Project {project_id} has disabled new skill learned, skip")
        return Result.resolve(None)
    if task.status != TaskStatus.SUCCESS:
        LOG.info(f"Task {task.id} is not success, skipping")
        return Result.resolve(None)

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
    async with DB_CLIENT.get_session_context() as db_session:
        r = await TD.fetch_previous_tasks_without_message_ids(
            db_session,
            task.session_id,
            st_order=task.order,
            limit=project_config.default_space_construct_agent_previous_tasks_limit,
        )
        if not r.ok():
            return
        PREVIOUS_TASKS = r.data

    r = await TSOP.sop_agent_curd(
        project_id,
        space_id,
        task,
        PREVIOUS_TASKS,
        messages_data,
        max_iterations=project_config.default_sop_agent_max_iterations,
        project_config=project_config,
    )
    return r
