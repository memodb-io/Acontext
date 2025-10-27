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
from ..prompt.task_sop import TaskSOPPrompt, SOP_TOOLS
from ...util.generate_ids import track_process
from ..tool.sop_lib.ctx import SOPCtx


def pack_task_data(
    task: TaskSchema, message_blobs: list[MessageBlob]
) -> tuple[str, str, str]:
    return (
        task.data.task_description,
        "\n".join([f"- {p}" for p in (task.data.user_preferences or [])]),
        "\n".join([m.to_string(truncate_chars=1024) for m in message_blobs]),
    )


@track_process
async def sop_agent_curd(
    project_id: asUUID,
    space_id: asUUID,
    current_task: TaskSchema,
    message_blobs: list[MessageBlob],
):

    # task_desc, user_perferences, raw_messages = pack_task_data(
    #     current_task, message_blobs
    # )
    task_desc = "Collect the latest news and key information about iPhone 15 Pro Max and report the findings to the user before starting any coding."
    user_perferences = "- user expects the message to be collected and reported before any landing page coding."
    raw_messages = """<agent>(text) I need to search the latest news about iPhone 15 pro max first
<agent>(tool-call) {"tool_name": "search_news", "arguments": {"query": "iPhone 15 pro max launching"}}
<agent>(tool-call) {"tool_name": "search_news", "arguments": {"query": "iPhone 15 pro max price"}}
<agent>(tool-call) {"tool_name": "search_news", "arguments": {"query": "iPhone 15 pro max features specif
ications"}}
<agent>(text) Based on my search results, here's what I found about the iPhone 15 Pro Max:
<agent>(text) ## iPhone 15 Pro Max Key Information

**Launch Details:**
- Released in September 2023
- Available in Natural Titanium, Blue Titanium, White Titanium, and Black Titanium

**Key Features:**                                                                                        - 6.7-inch Super Retina XDR display                                                                      - A17 Pro chip with 6-core GPU                                                                           - Pro camera system with 48MP main camera                                                                - Action Button replacing the mute switch
- USB-C connectivity
- Titanium design

**Pricing:**
- Starting at $1,199 for 256GB
- 512GB model at $1,399
- 1TB model at $1,599

This information should be perfect for creating an engaging landing page. Should I proceed with initializ
ing the Next.js project?"""

    LOG.info(f"Task SOP before: {task_desc}, {user_perferences}, {raw_messages}")

    json_tools = [tool.model_dump() for tool in TaskSOPPrompt.tool_schema()]
    already_iterations = 0
    _messages = [
        {
            "role": "user",
            "content": TaskSOPPrompt.pack_task_input(
                task_desc, user_perferences, raw_messages
            ),
        }
    ]
    while already_iterations < 1:
        r = await llm_complete(
            system_prompt=TaskSOPPrompt.system_prompt(),
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
        USE_CTX = SOPCtx(project_id, space_id, current_task.id)
        for tool_call in use_tools:
            try:
                tool_name = tool_call.function.name
                tool_arguments = tool_call.function.arguments
                tool = SOP_TOOLS[tool_name]
                with bound_logging_vars(tool=tool_name):
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
            except KeyError as e:
                return Result.reject(f"Tool {tool_name} not found: {str(e)}")
            except Exception as e:
                return Result.reject(f"Tool {tool_name} error: {str(e)}")
        _messages.extend(tool_response)
        already_iterations += 1
    return Result.resolve(None)


if __name__ == "__main__":
    import asyncio
    from dataclasses import dataclass

    @dataclass
    class Mock:
        id: int = 1

    asyncio.run(sop_agent_curd(1, 1, Mock(), []))
