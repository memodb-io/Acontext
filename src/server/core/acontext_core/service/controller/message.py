from ..data import message as MD
from ...infra.db import DB_CLIENT
from ...schema.session.task import TaskStatus
from ...schema.session.message import MessageBlob
from ...schema.utils import asUUID
from ...llm.agent import task as AT
from ...schema.result import ResultError
from ...env import LOG, DEFAULT_CORE_CONFIG
from ...schema.config import ProjectConfig


async def process_session_pending_message(
    project_config: ProjectConfig, project_id: asUUID, session_id: asUUID
):
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
                return
            await MD.update_message_status_to(
                session, pending_message_ids, TaskStatus.RUNNING
            )
        LOG.info(f"Unpending {len(pending_message_ids)} session messages to process")

        async with DB_CLIENT.get_session_context() as session:
            r = await MD.fetch_messages_data_by_ids(session, pending_message_ids)
            messages, eil = r.unpack()
            if eil:
                return

            r = await MD.fetch_previous_messages_by_datetime(
                session,
                session_id,
                messages[0].created_at,
                limit=project_config.project_session_message_use_previous_messages_turns,
            )
            previous_messages, eil = r.unpack()
            if eil:
                return
            messages_data = [
                MessageBlob(
                    message_id=m.id, role=m.role, parts=m.parts, task_id=m.task_id
                )
                for m in messages
            ]
            previous_messages_data = [
                MessageBlob(
                    message_id=m.id, role=m.role, parts=m.parts, task_id=m.task_id
                )
                for m in previous_messages
            ]

        r = await AT.task_agent_curd(
            project_id, session_id, previous_messages_data, messages_data
        )
        # r = await AT.task_agent_curd_debug(
        #     project_id, session_id, previous_messages_data, messages_data
        # )

        after_status = TaskStatus.SUCCESS
        if not r.ok():
            after_status = TaskStatus.FAILED
        async with DB_CLIENT.get_session_context() as session:
            await MD.update_message_status_to(
                session, pending_message_ids, after_status
            )
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
