from typing import List, Dict, Any

from ...schema.block.general import GeneralBlockData
from ...env import LOG, bound_logging_vars
from ...infra.db import AsyncSession, DB_CLIENT
from ..complete import llm_complete, response_to_sendable_message
from ...util.generate_ids import track_process
from ...schema.block.sop_block import SOPData
from ...schema.result import Result
from ...schema.utils import asUUID
from ..prompt.space_search import SpaceSearchPrompt
from ..tool.space_search_tools import SPACE_SEARCH_TOOLS, SpaceSearchCtx


async def build_space_search_ctx(
    db_session: AsyncSession,
    project_id: asUUID,
    space_id: asUUID,
    limit: int = 10,
    before_use_ctx: SpaceSearchCtx = None,
) -> SpaceSearchCtx:
    if before_use_ctx is not None:
        before_use_ctx.db_session = db_session
        return before_use_ctx
    LOG.info(f"Building space context for project {project_id} and space {space_id}")
    ctx = SpaceSearchCtx(db_session, project_id, space_id, limit, [], {"/": None})
    return ctx


@track_process
async def space_agent_search(
    project_id: asUUID,
    space_id: asUUID,
    user_query: str,
    limit: int = 10,
    max_iterations: int = 16,
) -> Result[SpaceSearchCtx]:

    json_tools = [tool.model_dump() for tool in SpaceSearchPrompt.tool_schema()]
    already_iterations = 0
    _messages = [
        {
            "role": "user",
            "content": SpaceSearchPrompt.pack_task_input(user_query),
        }
    ]
    just_finish = False
    USE_CTX = None
    while already_iterations < max_iterations:
        r = await llm_complete(
            system_prompt=SpaceSearchPrompt.system_prompt(),
            history_messages=_messages,
            tools=json_tools,
            prompt_kwargs=SpaceSearchPrompt.prompt_kwargs(),
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
        for tool_call in use_tools:
            try:
                tool_name = tool_call.function.name
                tool_arguments = tool_call.function.arguments
                tool = SPACE_SEARCH_TOOLS[tool_name]
                with bound_logging_vars(tool=tool_name):
                    async with DB_CLIENT.get_session_context() as db_session:
                        USE_CTX = await build_space_search_ctx(
                            db_session,
                            project_id,
                            space_id,
                            limit,
                            before_use_ctx=USE_CTX,
                        )
                        r = await tool.handler(USE_CTX, tool_arguments)
                    t, eil = r.unpack()
                    if eil:
                        return r
                if tool_name != "report_thinking":
                    LOG.info(f"Tool Call: {tool_name} - {tool_arguments} -> {t}")
                if tool_name == "submit_final_answer":
                    just_finish = True
                    continue
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
        if just_finish:
            LOG.info("submit_answer tool called, exit the loop")
            break
        already_iterations += 1
    USE_CTX.db_session = None  # remove the out-dated session
    return Result.resolve(USE_CTX)
