from typing import List
from ...env import LOG
from ...telemetry.log import bound_logging_vars
from ...infra.db import AsyncSession, DB_CLIENT
from ...infra.async_mq import publish_mq
from ...schema.result import Result
from ...schema.utils import asUUID
from ...schema.session.task import TaskSchema
from ...schema.session.message import MessageBlob
from ...schema.mq.learning import SkillLearnTask
from ...service.data import task as TD
from ...service.constants import EX, RK
from ..complete import llm_complete, response_to_sendable_message
from ..prompt.task import TaskPrompt, TASK_TOOLS
from ...util.generate_ids import track_process
from ..tool.task_lib.ctx import TaskCtx
from ..tool.task_lib.insert import _insert_task_tool
from ..tool.task_lib.update import _update_task_tool
from ..tool.task_lib.append import _append_messages_to_task_tool
from ..tool.task_lib.progress import _append_task_progress_tool
from ..tool.task_lib.set_preference import _set_task_user_preference_tool

NEED_UPDATE_CTX = {
    _insert_task_tool.schema.function.name,
    _update_task_tool.schema.function.name,
    _append_messages_to_task_tool.schema.function.name,
    _append_task_progress_tool.schema.function.name,
    _set_task_user_preference_tool.schema.function.name,
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
            task_descs.append("(no task linked)")
            continue
        elif ti in mappings:
            task_descs.append(f"(append to task_{mappings[ti].order})")
        elif planning_task is not None and ti == planning_task.id:
            task_descs.append("(append to planning_section)")
        else:
            LOG.warning(f"Unknown task id: {ti}")
            task_descs.append("(no task linked)")
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
    LOG.debug(
        f"Built task context {[(t.order, t.status.value, t.data.task_description) for t in current_tasks]}"
    )
    use_ctx = TaskCtx(
        db_session=db_session,
        project_id=project_id,
        session_id=session_id,
        task_ids_index=[t.id for t in current_tasks],
        task_index=current_tasks,
        message_ids_index=[m.message_id for m in messages],
    )
    return use_ctx


@track_process
async def task_agent_curd(
    project_id: asUUID,
    session_id: asUUID,
    messages: List[MessageBlob],
    max_iterations=3,  # task curd agent only receive one turn of actions
    previous_progress_num: int = 6,
    enable_skill_learning: bool = False,
) -> Result[None]:
    async with DB_CLIENT.get_session_context() as db_session:
        r = await TD.fetch_current_tasks(db_session, session_id)
        tasks, eil = r.unpack()
        if eil:
            return r

    task_section = pack_task_section(tasks)
    previous_progress_section = pack_previous_progress_section(
        tasks, previous_progress_num
    )
    current_messages_section = pack_current_message_with_ids(messages)

    LOG.info(f"Task Section: {task_section}")
    LOG.info(f"Previous Progress Section: {previous_progress_section}")

    json_tools = [tool.model_dump() for tool in TaskPrompt.tool_schema()]
    already_iterations = 0
    _pending_learning_task_ids: list[asUUID] = []
    _messages = [
        {
            "role": "user",
            "content": TaskPrompt.pack_task_input(
                previous_progress_section, current_messages_section, task_section
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
        _messages.append(response_to_sendable_message(llm_return))
        LOG.info(f"LLM Response: {llm_return.content}...")
        if not llm_return.tool_calls:
            LOG.info("No tool calls found, stop iterations")
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
                        if tool_name != "report_thinking":
                            LOG.info(
                                f"Tool Call: {tool_name} - {tool_arguments} -> {t}"
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
        # Drain learning task IDs and publish after DB commit
        if USE_CTX and USE_CTX.learning_task_ids:
            _pending_learning_task_ids.extend(USE_CTX.learning_task_ids)
            USE_CTX.learning_task_ids.clear()
        if _pending_learning_task_ids and enable_skill_learning:
            for tid in _pending_learning_task_ids:
                try:
                    await publish_mq(
                        EX.learning_skill,
                        RK.learning_skill_process,
                        SkillLearnTask(
                            project_id=project_id,
                            session_id=session_id,
                            task_id=tid,
                        ).model_dump_json(),
                    )
                except Exception:
                    LOG.warning(
                        "Failed to publish skill learning event", task_id=str(tid)
                    )
            _pending_learning_task_ids.clear()
        if _tool_error is not None:
            return Result.reject(str(_tool_error))
        _messages.extend(tool_response)
        if just_finish:
            LOG.info("finish function is called")
            break
        already_iterations += 1
    return Result.resolve(None)
