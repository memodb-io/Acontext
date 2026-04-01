import uuid as _uuid
from typing import List, Optional
from ...env import LOG
from ...telemetry.log import bound_logging_vars, get_wide_event
from ...infra.db import AsyncSession, DB_CLIENT
from ...infra.async_mq import publish_mq
from ...schema.result import Result
from ...schema.utils import asUUID
from ...schema.session.task import TaskSchema
from ...schema.session.message import MessageBlob
from ...schema.mq.learning import SkillLearnTask, SkillLearnDistilled
from ...service.data import task as TD
from ...service.data import session as SD
from ...service.constants import EX, RK
from ..complete import llm_complete, response_to_sendable_message
from ..prompt.task import TaskPrompt, TASK_TOOLS
from ..tool.task_lib.ctx import TaskCtx
from ..tool.task_lib.insert import _insert_task_tool
from ..tool.task_lib.update import _update_task_tool
from ..tool.task_lib.append import _append_messages_to_task_tool
from ..tool.task_lib.progress import _append_task_progress_tool

NEED_UPDATE_CTX = {
    _insert_task_tool.schema.function.name,
    _update_task_tool.schema.function.name,
    _append_messages_to_task_tool.schema.function.name,
    _append_task_progress_tool.schema.function.name,
}


def pack_task_section(tasks: List[TaskSchema]) -> str:
    section = "\n".join([f"- {t.to_string()}" for t in tasks])
    return section


def pack_previous_progress_section(
    tasks: list[TaskSchema],
    previous_progress_num: int = 5,
) -> str:
    progresses = []
    for task in tasks[::-1]:
        max_taken = max(0, previous_progress_num - len(progresses))
        if max_taken <= 0:
            break
        if task.data.progresses is not None:
            progresses.extend(
                [f"Task {task.order}: {p}" for p in task.data.progresses[-max_taken:]][
                    ::-1
                ]
            )

    return "\n".join(progresses[::-1])


def pack_previous_messages_section(
    planning_task: TaskSchema | None,
    tasks: list[TaskSchema],
    messages: list[MessageBlob],
) -> str:
    task_ids = [m.task_id for m in messages]
    mappings = {t.id: t for t in tasks}
    tool_mappings = {}
    task_descs = []
    for ti in task_ids:
        if ti is None:
            task_descs.append("(no task)")
            continue
        elif ti in mappings:
            task_descs.append(f"(append to task_{mappings[ti].order})")
        elif planning_task is not None and ti == planning_task.id:
            task_descs.append("(append to planning_section)")
        else:
            task_descs.append("(no task)")
    return "\n---\n".join(
        [
            f"{td}\n{m.to_string(tool_mappings, truncate_chars=256)}"
            for td, m in zip(task_descs, messages)
        ]
    )


def pack_current_message_with_ids(messages: list[MessageBlob]) -> str:
    tool_mappings = {}
    return "\n".join(
        [
            f"<message id={i}> {m.to_string(tool_mappings, truncate_chars=1024)} </message>"
            for i, m in enumerate(messages)
        ]
    )


async def build_task_ctx(
    db_session: AsyncSession,
    project_id: asUUID,
    session_id: asUUID,
    messages: list[MessageBlob],
    before_use_ctx: TaskCtx = None,
) -> TaskCtx:
    if before_use_ctx is not None:
        before_use_ctx.db_session = db_session
        return before_use_ctx

    r = await TD.fetch_current_tasks(db_session, session_id)
    current_tasks, eil = r.unpack()
    if eil:
        return r
    use_ctx = TaskCtx(
        db_session=db_session,
        project_id=project_id,
        session_id=session_id,
        task_ids_index=[t.id for t in current_tasks],
        task_index=current_tasks,
        message_ids_index=[m.message_id for m in messages],
    )
    return use_ctx


async def task_agent_curd(
    project_id: asUUID,
    session_id: asUUID,
    messages: List[MessageBlob],
    max_iterations=3,
    previous_progress_num: int = 6,
    learning_space_id: Optional[asUUID] = None,
    task_success_criteria: Optional[str] = None,
    task_failure_criteria: Optional[str] = None,
) -> Result[None]:
    wide = get_wide_event()
    llm_calls = 0
    tools_called: list[str] = []
    task_count = 0

    async with DB_CLIENT.get_session_context() as db_session:
        # Get session configs to extract original_date
        r_sess = await SD.fetch_session(db_session, session_id)
        session, _ = r_sess.unpack()
        original_date = (
            session.configs.get("original_date")
            if session and session.configs
            else None
        )

        r = await TD.fetch_current_tasks(db_session, session_id)
        tasks, eil = r.unpack()
        if eil:
            return r
        r_plan = await TD.fetch_planning_task(db_session, session_id)
        planning_task, _ = r_plan.unpack()
        known_preferences = (
            (planning_task.data.user_preferences or [])
            if planning_task is not None
            else []
        )

    task_count = len(tasks)
    task_section = pack_task_section(tasks)
    previous_progress_section = pack_previous_progress_section(
        tasks, previous_progress_num
    )
    current_messages_section = pack_current_message_with_ids(messages)

    json_tools = [tool.model_dump() for tool in TaskPrompt.tool_schema()]
    already_iterations = 0
    _pending_learning_task_ids: list[asUUID] = []
    _pending_preferences: list[str] = []
    _messages = [
        {
            "role": "user",
            "content": TaskPrompt.pack_task_input(
                previous_progress_section,
                current_messages_section,
                task_section,
                known_preferences=known_preferences or None,
                task_success_criteria=task_success_criteria,
                task_failure_criteria=task_failure_criteria,
            ),
        }
    ]
    while already_iterations < max_iterations:
        r = await llm_complete(
            system_prompt=TaskPrompt.system_prompt(),
            history_messages=_messages,
            tools=json_tools,
            prompt_kwargs=TaskPrompt.prompt_kwargs(),
        )
        llm_return, eil = r.unpack()
        if eil:
            return r
        llm_calls += 1
        _messages.append(response_to_sendable_message(llm_return))
        if not llm_return.tool_calls:
            break
        use_tools = llm_return.tool_calls
        just_finish = False
        tool_response = []
        USE_CTX = None
        try:
            async with DB_CLIENT.get_session_context() as db_session:
                for tool_call in use_tools:
                    try:
                        tool_name = tool_call.function.name
                        tools_called.append(tool_name)
                        if tool_name == "finish":
                            just_finish = True
                            continue
                        tool_arguments = tool_call.function.arguments
                        tool = TASK_TOOLS[tool_name]
                        with bound_logging_vars(tool=tool_name):
                            USE_CTX = await build_task_ctx(
                                db_session,
                                project_id,
                                session_id,
                                messages,
                                before_use_ctx=USE_CTX,
                            )
                            r = await tool.handler(USE_CTX, tool_arguments)
                            t, eil = r.unpack()
                            if eil:
                                raise RuntimeError(
                                    f"Tool {tool_name} rejected: {r.error}"
                                )
                        tool_response.append(
                            {
                                "role": "tool",
                                "tool_call_id": tool_call.id,
                                "content": t,
                            }
                        )
                        if tool_name in NEED_UPDATE_CTX:
                            if USE_CTX and USE_CTX.learning_task_ids:
                                _pending_learning_task_ids.extend(
                                    USE_CTX.learning_task_ids
                                )
                                USE_CTX.learning_task_ids.clear()
                            if USE_CTX and USE_CTX.pending_preferences:
                                _pending_preferences.extend(USE_CTX.pending_preferences)
                                USE_CTX.pending_preferences.clear()
                            USE_CTX = None
                    except KeyError as e:
                        raise RuntimeError(
                            f"Tool {tool_name} not found: {str(e)}"
                        ) from e
                    except RuntimeError:
                        raise
                    except Exception as e:
                        raise RuntimeError(f"Tool {tool_name} error: {str(e)}") from e
        except RuntimeError as e:
            _tool_error = e
            _pending_learning_task_ids.clear()
        else:
            _tool_error = None
        if USE_CTX and USE_CTX.learning_task_ids:
            _pending_learning_task_ids.extend(USE_CTX.learning_task_ids)
            USE_CTX.learning_task_ids.clear()
        if USE_CTX and USE_CTX.pending_preferences:
            _pending_preferences.extend(USE_CTX.pending_preferences)
            USE_CTX.pending_preferences.clear()
        if _pending_learning_task_ids and learning_space_id is not None:
            for tid in _pending_learning_task_ids:
                try:
                    await publish_mq(
                        EX.learning_skill,
                        RK.learning_skill_distill,
                        SkillLearnTask(
                            project_id=project_id,
                            session_id=session_id,
                            task_id=tid,
                        ).model_dump_json(),
                    )
                except Exception:
                    LOG.error(
                        "task_agent.publish_learning_failed",
                        task_id=str(tid),
                    )
            _pending_learning_task_ids.clear()
        if _pending_preferences and learning_space_id is not None:
            pref_lines = "\n".join(f"- {p}" for p in _pending_preferences)
            distilled_context = f"## User Preferences Observed\n{pref_lines}"
            try:
                await publish_mq(
                    EX.learning_skill,
                    RK.learning_skill_agent,
                    SkillLearnDistilled(
                        project_id=project_id,
                        session_id=session_id,
                        task_id=_uuid.UUID(int=0),
                        learning_space_id=learning_space_id,
                        distilled_context=distilled_context,
                        original_date=original_date,
                    ).model_dump_json(),
                )
            except Exception:
                LOG.error("task_agent.publish_preferences_failed")
            _pending_preferences.clear()
        if _tool_error is not None:
            return Result.reject(str(_tool_error))
        _messages.extend(tool_response)
        if just_finish:
            break
        already_iterations += 1

    wide["agent_iterations"] = already_iterations
    wide["llm_calls"] = llm_calls
    wide["tools_called"] = tools_called
    wide["task_count"] = task_count

    return Result.resolve(None)
