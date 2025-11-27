from typing import Optional, List
from ...env import LOG, bound_logging_vars
from ...schema.result import Result
from ...schema.utils import asUUID
from ...schema.session.task import TaskSchema
from ...schema.session.message import MessageBlob
from ...schema.config import ProjectConfig
from ..complete import llm_complete, response_to_sendable_message
from ..prompt.task_sop import TaskSOPPrompt, SOP_TOOLS
from ..prompt.sop_customization import SOPPromptCustomization
from ...util.generate_ids import track_process
from ..tool.sop_lib.ctx import SOPCtx


def pack_task_data(
    task: TaskSchema, message_blobs: list[MessageBlob]
) -> tuple[str, str, str]:
    tool_mappings = {}
    return (
        task.data.task_description,
        "\n".join([f"- {p}" for p in (task.data.user_preferences or [])]),
        "\n".join(
            [m.to_string(tool_mappings, truncate_chars=1024) for m in message_blobs]
        ),
    )


def pack_one_task_progress_context(task: TaskSchema) -> str:
    progresses = task.data.progresses or []
    progress_context = "\n".join([f"- {p}" for p in progresses])
    return f"""<task id={task.order}>
Description: {task.data.task_description}
Progresses:
{progress_context}
</task>
"""


def pack_previous_task_context(
    previous_tasks: List[TaskSchema], current_task: TaskSchema
) -> str:
    prev_tasks = "\n".join(
        [pack_one_task_progress_context(task) for task in previous_tasks]
    )
    return f"""{prev_tasks}
You're looking at task {current_task.order}.
"""


@track_process
async def sop_agent_curd(
    project_id: asUUID,
    space_id: asUUID,
    current_task: TaskSchema,
    previous_tasks: List[TaskSchema],
    message_blobs: list[MessageBlob],
    max_iterations=3,
    project_config: Optional[ProjectConfig] = None,
):
    task_desc, user_perferences, raw_messages = pack_task_data(
        current_task, message_blobs
    )
    previous_task_context = pack_previous_task_context(previous_tasks, current_task)

    LOG.info(f"Task SOP Input: {task_desc}, {user_perferences}")
    LOG.info(f"Previous Task Context: {previous_task_context}")
    print(raw_messages)

    # Build customization from project config
    customization = None
    if project_config and project_config.sop_agent_custom_scoring_rules:
        customization = SOPPromptCustomization(
            custom_scoring_rules=project_config.sop_agent_custom_scoring_rules
        )

    json_tools = [tool.model_dump() for tool in TaskSOPPrompt.tool_schema()]
    already_iterations = 0
    already_submit = False
    _messages = [
        {
            "role": "user",
            "content": TaskSOPPrompt.pack_task_input(
                previous_task_context, task_desc, user_perferences, raw_messages
            ),
        }
    ]
    while already_iterations < max_iterations:
        r = await llm_complete(
            system_prompt=TaskSOPPrompt.system_prompt(customization=customization),
            history_messages=_messages,
            tools=json_tools,
            prompt_kwargs=TaskSOPPrompt.prompt_kwargs(),
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
        tool_response = []
        USE_CTX = SOPCtx(
            project_id=project_id,
            enable_user_confirmation_on_new_experiences=project_config.project_enable_user_confirmation_on_new_experiences,
            space_id=space_id,
            task=current_task,
        )
        for tool_call in use_tools:
            try:
                tool_name = tool_call.function.name
                if tool_name == "submit_sop":
                    already_submit = True
                tool_arguments = tool_call.function.arguments
                tool = SOP_TOOLS[tool_name]
                with bound_logging_vars(tool=tool_name):
                    r = await tool.handler(USE_CTX, tool_arguments)
                    t, eil = r.unpack()
                    if eil:
                        return r
                if tool_name != "report_thinking":
                    LOG.info(f"Tool Call: {tool_name} - {tool_arguments} -> {t}")
                tool_response.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": t,
                    }
                )
            except KeyError as e:
                return Result.reject(f"Tool {tool_name} not found: {str(e)}")
            except Exception as e:
                return Result.reject(f"Tool {tool_name} error: {str(e)}")
        _messages.extend(tool_response)
        if already_submit:
            LOG.info("submit_sop called, exit the loop")
            break
        already_iterations += 1
    return Result.resolve(None)


if __name__ == "__main__":
    import asyncio
    from dataclasses import dataclass

    @dataclass
    class Mock:
        id: int = 1

    asyncio.run(sop_agent_curd(1, 1, Mock(), []))
