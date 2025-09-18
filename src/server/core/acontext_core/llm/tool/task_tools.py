from typing import Any
from ...infra.db import AsyncSession
from .base import Tool, ToolPool
from ...schema.llm import ToolSchema
from ...schema.utils import asUUID
from ...schema.result import Result
from ...schema.orm import Task
from ...service.data import task as TD
from ...env import LOG

TASK_TOOLS: ToolPool = {}


async def insert_task_handler(
    db_session: AsyncSession, session_id: asUUID, llm_arguments: dict
) -> Result[str]:
    r = await TD.insert_task(
        db_session,
        session_id,
        after_order=llm_arguments["after_task_order"],
        data={
            "task_description": llm_arguments["task_description"],
        },
    )
    t, eil = r.unpack()
    if eil:
        return r
    return Result.resolve(f"Task {t.task_order} created")


_insert_task_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "insert_task",
                "description": "Create a new task by inserting it after the specified task order. This is used when identifying new tasks from conversation messages.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "after_task_order": {
                            "type": "integer",
                            "description": "The task order after which to insert the new task. Use 0 to insert at the beginning.",
                        },
                        "task_description": {
                            "type": "string",
                            "description": "A clear, concise description of the task, of what's should be done and what's the expected result if any.",
                        },
                    },
                    "required": ["after_task_order", "task_description"],
                },
            }
        )
    )
    .use_handler(insert_task_handler)
)


async def update_task_handler(
    db_session: AsyncSession,
    task_id: asUUID,
    llm_arguments: dict,
) -> Result[Task]:
    status = llm_arguments.get("task_status", None)
    description = llm_arguments.get("task_description", None)
    r = await TD.update_task(
        db_session,
        task_id,
        status=status,
        patch_data={
            "task_description": description,
        },
    )
    t, eil = r.unpack()
    if eil:
        return r
    return Result.resolve(f"Task {t.task_order} updated")


_update_task_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "update_task",
                "description": """Update an existing task's description and/or status. 
Use this when task progress changes or task details need modification.
Mostly use it to update the task status, if you're confident about a task is running, completed or failed.
Only when the conversation explicitly mention certain task's purpose should be modified, then use this tool to update the task description.""",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_order": {
                            "type": "integer",
                            "description": "The order number of the task to update.",
                        },
                        "task_status": {
                            "type": "string",
                            "enum": ["pending", "running", "success", "failed"],
                            "description": "New status for the task. Use 'pending' for not started, 'running' for in progress, 'success' for completed, 'failed' for encountered errors.",
                        },
                        "task_description": {
                            "type": "string",
                            "description": "Update description for the task, of what's should be done and what's the expected result if any. (optional).",
                        },
                    },
                    "required": ["task_order"],
                },
            }
        )
    )
    .use_handler(update_task_handler)
)


async def _append_messages_to_planning_section_handler(
    db_session: AsyncSession,
    session_id: asUUID,
    message_ids_index: list[asUUID],
    llm_arguments: dict,
):
    message_order_indexes = llm_arguments.get("message_ids", [])
    actually_message_ids = [
        message_ids_index[i]
        for i in message_order_indexes
        if i < len(message_ids_index)
    ]
    if not actually_message_ids:
        LOG.warning(f"No message ids to append, skip: {message_order_indexes}")
        return Result.resolve()
    r = await TD.append_messages_to_planning_section(
        db_session,
        session_id,
        actually_message_ids,
    )
    return r
    pass


_append_messages_to_planning_section_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "append_messages_to_planning_section",
                "description": """Save current message ids to the planning section.
Use this when messages are about the agent/user is planning general plan, and those messages aren't related to any specific task execution.""",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "message_ids": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "List of message IDs to append to the planning section.",
                        },
                    },
                    "required": ["message_ids"],
                },
            }
        )
    )
    .use_handler(_append_messages_to_planning_section_handler)
)

TASK_TOOLS[_insert_task_tool.schema.function.name] = _insert_task_tool
TASK_TOOLS[_update_task_tool.schema.function.name] = _update_task_tool
TASK_TOOLS[_append_messages_to_planning_section_tool.schema.function.name] = (
    _append_messages_to_planning_section_tool
)


# TODO: finish those tools
# append_messages_to_planning_tool = ToolSchema(
#     function={
#         "name": "append_messages_to_planning_section",
#         "description": """Save current message ids to the planning section.
# Use this when messages are about the agent/user is planning general plan, and those messages aren't related to any specific task execution.""",
#         "parameters": {
#             "type": "object",
#             "properties": {
#                 "message_ids": {
#                     "type": "array",
#                     "items": {"type": "integer"},
#                     "description": "List of message IDs to append to the planning section.",
#                 },
#             },
#             "required": ["message_ids"],
#         },
#     }
# )

# append_messages_to_task_tool = ToolSchema(
#     function={
#         "name": "append_messages_to_task",
#         "description": """Link current message ids to a task for tracking progress and context.
# Use this to associate conversation messages with relevant tasks.
# If the task is marked as 'success' or 'failed', don't append messages to it.""",
#         "parameters": {
#             "type": "object",
#             "properties": {
#                 "task_order": {
#                     "type": "integer",
#                     "description": "The order number of the task to link messages to.",
#                 },
#                 "message_ids": {
#                     "type": "array",
#                     "items": {"type": "integer"},
#                     "description": "List of message IDs to append to the task.",
#                 },
#             },
#             "required": ["task_order", "message_ids"],
#         },
#     }
# )

# finish_tool = ToolSchema(
#     function={
#         "name": "finish",
#         "description": "Call it when you have completed the actions for task management.",
#         "parameters": {
#             "type": "object",
#             "properties": {},
#             "required": [],
#         },
#     }
# )
