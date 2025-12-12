from typing import List

from ...schema.block.general import GeneralBlockData
from ...env import LOG
from ...telemetry.log import bound_logging_vars
from ...infra.db import AsyncSession, DB_CLIENT
from ..complete import llm_complete, response_to_sendable_message
from ...util.generate_ids import track_process
from ...schema.block.sop_block import SOPData
from ...schema.result import Result
from ...schema.utils import asUUID
from ..prompt.space_construct import SpaceConstructPrompt
from ..tool.space_tools import SPACE_TOOLS, SpaceCtx
from ..tool.space_lib.insert_candidate_data_as_content import set_space_digests


async def build_space_ctx(
    db_session: AsyncSession,
    project_id: asUUID,
    space_id: asUUID,
    task_ids: List[asUUID],
    data_candidate: list[dict],
    before_use_ctx: SpaceCtx = None,
) -> SpaceCtx:
    if before_use_ctx is not None:
        before_use_ctx.db_session = db_session
        return before_use_ctx
    LOG.info(f"Building space context for project {project_id} and space {space_id}")
    ctx = SpaceCtx(
        db_session=db_session,
        project_id=project_id,
        space_id=space_id,
        task_ids=task_ids,
        candidate_data=data_candidate,
        already_inserted_candidate_data=set[int](),
        path_2_block_ids={"/": None},
    )
    return ctx


def pack_candidate_data_list(data: list[GeneralBlockData]) -> str:
    return "\n".join(
        [
            f"<candidate_data id={i}>{d['data']}</candidate_data>"
            for i, d in enumerate(data)
        ]
    )


@track_process
async def space_construct_agent_curd(
    project_id: asUUID,
    space_id: asUUID,
    task_ids: List[asUUID],
    sop_datas: List[SOPData],
    max_iterations=16,
) -> Result[None]:
    """
    Construct Agent - Process SOP data and build into Space

    Args:
        project_id: Project ID
        space_id: Space ID
        task_id: Task ID
        sop_datas: SOP data
        max_iterations: Maximum iterations

    Returns:
        Result[Dict[str, Any]]: Processing result
    """

    json_tools = [tool.model_dump() for tool in SpaceConstructPrompt.tool_schema()]
    already_iterations = 0
    candidate_data_list = [
        {
            "type": "sop",
            "data": sop_data.model_dump(),
        }
        for sop_data in sop_datas
    ]
    candidate_data_section = pack_candidate_data_list(candidate_data_list)
    LOG.info(f"Candidate Data Section: {candidate_data_section}")

    _messages = [
        {
            "role": "user",
            "content": SpaceConstructPrompt.pack_task_input(candidate_data_section),
        }
    ]
    just_finish = False
    USE_CTX = None
    while already_iterations < max_iterations:
        r = await llm_complete(
            system_prompt=SpaceConstructPrompt.system_prompt(),
            history_messages=_messages,
            tools=json_tools,
            prompt_kwargs=SpaceConstructPrompt.prompt_kwargs(),
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
                if tool_name == "finish":
                    just_finish = True
                    continue
                tool_arguments = tool_call.function.arguments
                tool = SPACE_TOOLS[tool_name]
                with bound_logging_vars(tool=tool_name):
                    async with DB_CLIENT.get_session_context() as db_session:
                        USE_CTX = await build_space_ctx(
                            db_session,
                            project_id,
                            space_id,
                            task_ids,
                            candidate_data_list,
                            before_use_ctx=USE_CTX,
                        )
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
        if just_finish:
            LOG.info("finish tool called, exit the loop")
            break
        already_iterations += 1

    async with DB_CLIENT.get_session_context() as db_session:
        USE_CTX = await build_space_ctx(
            db_session,
            project_id,
            space_id,
            task_ids,
            candidate_data_list,
            before_use_ctx=USE_CTX,
        )
        for d_i in USE_CTX.already_inserted_candidate_data:
            await set_space_digests(USE_CTX, d_i)
    return Result.resolve(None)
