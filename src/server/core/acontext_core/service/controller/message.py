from ..data import message as MD
from ..data import learning_space as LS
from ...infra.db import DB_CLIENT
from ...schema.session.task import TaskStatus
from ...schema.session.message import MessageBlob
from ...schema.utils import asUUID
from ...schema.result import Result
from ...llm.agent import task as AT
from ...env import LOG
from ...schema.config import ProjectConfig
from ...telemetry.get_metrics import get_metrics
from ...constants import ExcessMetricTags


async def process_session_pending_message(
    project_config: ProjectConfig, project_id: asUUID, session_id: asUUID
) -> Result[None]:
    disabled = await get_metrics(project_id, ExcessMetricTags.new_task_created)

    pending_message_ids = None
    try:
        async with DB_CLIENT.get_session_context() as session:
            r = await MD.get_message_ids(
                session,
                session_id,
                limit=(
                    project_config.project_session_message_buffer_max_overflow
                    + project_config.project_session_message_buffer_max_turns
                ),
                asc=True,
            )
            pending_message_ids, eil = r.unpack()
            if eil:
                return r
            if not pending_message_ids:
                return Result.resolve(None)
            if disabled:
                LOG.warning(
                    f"Project {project_id} has disabled new task creation, skip"
                )
                await MD.update_message_status_to(
                    session, pending_message_ids, TaskStatus.FAILED
                )
                return Result.resolve(None)
            await MD.update_message_status_to(
                session, pending_message_ids, TaskStatus.RUNNING
            )
        LOG.info(f"Unpending {len(pending_message_ids)} session messages to process")

        async with DB_CLIENT.get_session_context() as session:
            r = await MD.fetch_messages_data_by_ids(session, pending_message_ids)
            messages, eil = r.unpack()
            if eil:
                return r

            r = await MD.fetch_previous_messages_by_datetime(
                session,
                session_id,
                messages[0].created_at,
                limit=project_config.project_session_message_use_previous_messages_turns,
            )
            messages_data = [
                MessageBlob(
                    message_id=m.id, role=m.role, parts=m.parts, task_id=m.task_id
                )
                for m in messages
            ]

        async with DB_CLIENT.get_session_context() as session:
            r = await LS.get_learning_space_for_session(session, session_id)
            ls_session, eil = r.unpack()
            if eil:
                ls_session = None

        r = await AT.task_agent_curd(
            project_id,
            session_id,
            messages_data,
            max_iterations=project_config.default_task_agent_max_iterations,
            previous_progress_num=project_config.default_task_agent_previous_progress_num,
            enable_skill_learning=(ls_session is not None),
        )

        after_status = TaskStatus.SUCCESS
        if not r.ok():
            after_status = TaskStatus.FAILED
        async with DB_CLIENT.get_session_context() as session:
            await MD.update_message_status_to(
                session, pending_message_ids, after_status
            )
        return r
    except Exception as e:
        if pending_message_ids is None:
            raise e
        LOG.error(
            f"Exception while processing session pending message: {e}, rollback {len(pending_message_ids)} message status to failed"
        )
        async with DB_CLIENT.get_session_context() as session:
            await MD.update_message_status_to(
                session, pending_message_ids, TaskStatus.FAILED
            )
        raise e
