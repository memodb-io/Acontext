import re
from typing import List
from urllib import response
from ...env import LOG, DEFAULT_CORE_CONFIG, bound_logging_vars
from ...infra.db import AsyncSession, DB_CLIENT
from ...schema.result import Result
from ...schema.utils import asUUID
from ...schema.session.task import TaskSchema, TaskStatus
from ...schema.session.message import MessageBlob
from ...service.data import task as TD
from ..complete import llm_complete, response_to_sendable_message
from ..prompt.task import TaskPrompt, TASK_TOOLS
from ...util.generate_ids import track_process
from ..tool.task_lib.ctx import TaskCtx
from ..tool.task_lib.insert import _insert_task_tool

NEED_UPDATE_CTX = {
    _insert_task_tool.schema.function.name,
}


def pack_task_section(tasks: List[TaskSchema]) -> str:
    section = "\n".join([f"- {t.to_string()}" for t in tasks])
    return section


def pack_previous_messages_section(
    planning_task: TaskSchema | None,
    tasks: list[TaskSchema],
    messages: list[MessageBlob],
) -> str:
    task_ids = [m.task_id for m in messages]
    mappings = {t.id: t for t in tasks}
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
            f"{td}\n{m.to_string(truncate_chars=256)}"
            for td, m in zip(task_descs, messages)
        ]
    )


def pack_current_message_with_ids(messages: list[MessageBlob]) -> str:
    return "\n".join(
        [f"<message id={i}> {m.to_string()} </message>" for i, m in enumerate(messages)]
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
    previous_messages: List[MessageBlob],
    messages: List[MessageBlob],
    max_iterations=3,  # task curd agent only receive one turn of actions
) -> Result[None]:
    async with DB_CLIENT.get_session_context() as db_session:
        r = await TD.fetch_current_tasks(db_session, session_id)
        tasks, eil = r.unpack()
        if eil:
            return r

        r = await TD.fetch_planning_task(db_session, session_id)
        planning_section, eil = r.unpack()
        if eil:
            return r

    task_section = pack_task_section(tasks)
    previous_messages_section = pack_previous_messages_section(
        planning_section, tasks, previous_messages
    )
    current_messages_section = pack_current_message_with_ids(messages)

    LOG.info(f"Task Section: {task_section}")
    LOG.info(f"Previous Messages Section: {previous_messages_section}")
    LOG.info(f"Current Messages Section: {current_messages_section}")

    json_tools = [tool.model_dump() for tool in TaskPrompt.tool_schema()]
    already_iterations = 0
    _messages = [
        {
            "role": "user",
            "content": TaskPrompt.pack_task_input(
                previous_messages_section, current_messages_section, task_section
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
        for tool_call in use_tools:
            try:
                tool_name = tool_call.function.name
                if tool_name == "finish":
                    just_finish = True
                    continue
                tool_arguments = tool_call.function.arguments
                tool = TASK_TOOLS[tool_name]
                with bound_logging_vars(tool=tool_name):
                    async with DB_CLIENT.get_session_context() as db_session:
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
                        return r
                LOG.info(f"Tool Call: {tool_name} - {tool_arguments} -> {t}")
                tool_response.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": t,
                    }
                )
                if tool_name in NEED_UPDATE_CTX:
                    USE_CTX = None
            except KeyError as e:
                return Result.reject(f"Tool {tool_name} not found: {str(e)}")
            except Exception as e:
                return Result.reject(f"Tool {tool_name} error: {str(e)}")
        _messages.extend(tool_response)
        if just_finish:
            LOG.info("finish function is called")
            break
        already_iterations += 1
    return Result.resolve(None)
