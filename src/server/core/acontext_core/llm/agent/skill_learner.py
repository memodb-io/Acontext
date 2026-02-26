from typing import List, Optional
from ...env import LOG
from ...telemetry.log import bound_logging_vars
from ...infra.db import DB_CLIENT
from ...schema.result import Result
from ...schema.utils import asUUID
from ..complete import llm_complete, response_to_sendable_message
from ..prompt.skill_learner import SkillLearnerPrompt
from ..tool.skill_learner_tools import SKILL_LEARNER_TOOLS
from ..tool.skill_learner_lib.ctx import SkillLearnerCtx
from ...util.generate_ids import track_process
from ...service.data.learning_space import SkillInfo


@track_process
async def skill_learner_agent(
    project_id: asUUID,
    learning_space_id: asUUID,
    user_id: Optional[asUUID],
    skills_info: List[SkillInfo],
    distilled_context: str,
    max_iterations: int = 5,
) -> Result[None]:
    # Build skills dict for context
    skills = {si.name: si for si in skills_info}

    # Format available skills for the prompt
    if skills:
        available_skills_str = "\n".join(
            f"- **{s.name}**: {s.description}" for s in skills.values()
        )
    else:
        available_skills_str = "(No skills in this learning space yet)"

    json_tools = [tool.model_dump() for tool in SkillLearnerPrompt.tool_schema()]
    already_iterations = 0
    has_reported_thinking = False
    _user_input = SkillLearnerPrompt.pack_skill_learner_input(
        distilled_context, available_skills_str
    )
    LOG.info(f"Skill Learner Input:\n{_user_input}")
    _messages = [{"role": "user", "content": _user_input}]

    while already_iterations < max_iterations:
        r = await llm_complete(
            system_prompt=SkillLearnerPrompt.system_prompt(),
            history_messages=_messages,
            tools=json_tools,
            prompt_kwargs=SkillLearnerPrompt.prompt_kwargs(),
        )
        llm_return, eil = r.unpack()
        if eil:
            return r
        _messages.append(response_to_sendable_message(llm_return))
        _content_preview = (llm_return.content or "")[:20]
        LOG.info(f"Skill Learner LLM Response: {_content_preview}...")
        if not llm_return.tool_calls:
            LOG.info("Skill Learner: No tool calls found, stop iterations")
            break

        use_tools = llm_return.tool_calls
        just_finish = False
        tool_response = []

        try:
            async with DB_CLIENT.get_session_context() as db_session:
                ctx = SkillLearnerCtx(
                    db_session=db_session,
                    project_id=project_id,
                    learning_space_id=learning_space_id,
                    user_id=user_id,
                    skills=skills,
                    has_reported_thinking=has_reported_thinking,
                )

                for tool_call in use_tools:
                    try:
                        tool_name = tool_call.function.name
                        if tool_name == "finish":
                            just_finish = True
                            continue
                        tool_arguments = tool_call.function.arguments
                        tool = SKILL_LEARNER_TOOLS[tool_name]
                        with bound_logging_vars(tool=tool_name):
                            r = await tool.handler(ctx, tool_arguments)
                            t, eil = r.unpack()
                            if eil:
                                raise RuntimeError(
                                    f"Tool {tool_name} rejected: {r.error}"
                                )
                        if tool_name != "report_thinking":
                            _t_preview = (t or "")[:20]
                            LOG.info(
                                f"Skill Learner Tool Call: {tool_name} -> {_t_preview}..."
                            )
                        tool_response.append(
                            {
                                "role": "tool",
                                "tool_call_id": tool_call.id,
                                "content": t,
                            }
                        )
                    except KeyError as e:
                        raise RuntimeError(
                            f"Tool {tool_name} not found: {str(e)}"
                        ) from e
                    except RuntimeError:
                        raise
                    except Exception as e:
                        raise RuntimeError(f"Tool {tool_name} error: {str(e)}") from e

                # Preserve has_reported_thinking across DB session rebuilds
                has_reported_thinking = ctx.has_reported_thinking

        except RuntimeError as e:
            return Result.reject(str(e))

        _messages.extend(tool_response)
        if just_finish:
            LOG.info("Skill Learner: finish function is called")
            break
        already_iterations += 1

    return Result.resolve(None)
