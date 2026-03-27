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
from ...telemetry.log import get_wide_event
from ...telemetry.get_metrics import get_metrics
from ...constants import ExcessMetricTags


async def _try_rollback_to_failed(pending_message_ids: list) -> None:
    try:
        async with DB_CLIENT.get_session_context() as rollback_session:
            await MD.update_message_status_to(
                rollback_session, pending_message_ids, TaskStatus.FAILED
            )
    except BaseException:
        LOG.error(
            "session.pending_message_rollback_failed",
            pending_message_ids=[str(mid) for mid in pending_message_ids],
        )


async def process_inserted_message(
    project_config: ProjectConfig,
    project_id: asUUID,
    session_id: asUUID,
    message_id: asUUID,
) -> Result[None]:
    wide = get_wide_event()
    disabled = await get_metrics(project_id, ExcessMetricTags.new_task_created)
    target_message_ids = [message_id]

    try:
        async with DB_CLIENT.get_session_context() as session:
            if disabled:
                wide["project_disabled"] = True
                await MD.update_message_status_to(
                    session, target_message_ids, TaskStatus.LIMIT_EXCEED
                )
                return Result.resolve(None)

            wide["project_disabled"] = False
            await MD.update_message_status_to(
                session, target_message_ids, TaskStatus.RUNNING
            )

        async with DB_CLIENT.get_session_context() as session:
            r = await MD.fetch_message_branch_path_data(session, message_id, session_id)
            messages, eil = r.unpack()
            if eil:
                await _try_rollback_to_failed(target_message_ids)
                return r

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
            learning_space_id=(
                ls_session.learning_space_id if ls_session is not None else None
            ),
            task_success_criteria=project_config.task_success_criteria,
            task_failure_criteria=project_config.task_failure_criteria,
        )

        after_status = TaskStatus.SUCCESS
        if not r.ok():
            after_status = TaskStatus.FAILED
            wide["task_agent_outcome"] = "failed"
        else:
            wide["task_agent_outcome"] = "success"

        async with DB_CLIENT.get_session_context() as session:
            await MD.update_message_status_to(
                session, target_message_ids, after_status
            )
        return r
    except BaseException as e:
        LOG.error(
            "inserted_message_exception",
            error=str(e) or "(no message)",
            error_type=type(e).__name__,
            message_id=str(message_id),
        )
        wide["task_agent_outcome"] = "exception"
        await _try_rollback_to_failed(target_message_ids)
        raise


async def process_session_pending_message(
    project_config: ProjectConfig, project_id: asUUID, session_id: asUUID
) -> Result[None]:
    wide = get_wide_event()
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

            wide["pending_count"] = len(pending_message_ids)

            if disabled:
                wide["project_disabled"] = True
                await MD.update_message_status_to(
                    session, pending_message_ids, TaskStatus.LIMIT_EXCEED
                )
                return Result.resolve(None)

            wide["project_disabled"] = False

            await MD.update_message_status_to(
                session, pending_message_ids, TaskStatus.RUNNING
            )

        async with DB_CLIENT.get_session_context() as session:
            r = await MD.fetch_messages_data_by_ids(session, pending_message_ids)
            messages, eil = r.unpack()
            if eil:
                await _try_rollback_to_failed(pending_message_ids)
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
            learning_space_id=(
                ls_session.learning_space_id if ls_session is not None else None
            ),
            task_success_criteria=project_config.task_success_criteria,
            task_failure_criteria=project_config.task_failure_criteria,
        )

        after_status = TaskStatus.SUCCESS
        if not r.ok():
            after_status = TaskStatus.FAILED
            wide["task_agent_outcome"] = "failed"
        else:
            wide["task_agent_outcome"] = "success"

        async with DB_CLIENT.get_session_context() as session:
            await MD.update_message_status_to(
                session, pending_message_ids, after_status
            )
        return r
    except BaseException as e:
        if pending_message_ids is None:
            raise
        LOG.error(
            "session.pending_message_exception",
            error=str(e) or "(no message)",
            error_type=type(e).__name__,
            rollback_count=len(pending_message_ids),
        )
        wide["task_agent_outcome"] = "exception"
        await _try_rollback_to_failed(pending_message_ids)
        raise
