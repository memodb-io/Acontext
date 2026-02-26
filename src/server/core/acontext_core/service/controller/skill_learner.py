from ...env import LOG
from ...infra.db import DB_CLIENT
from ...schema.result import Result
from ...schema.utils import asUUID
from ...schema.session.task import TaskStatus
from ...schema.session.message import MessageBlob
from ...schema.mq.learning import SkillLearnDistilled
from ..data import task as TD
from ..data import message as MD
from ..data import learning_space as LS
from ...llm.complete import llm_complete
from ...llm.prompt.skill_distillation import SkillDistillationPrompt
from ...llm.tool.skill_learner_lib.distill import (
    DISTILL_SKIP_TOOL,
    DISTILL_SUCCESS_TOOL,
    DISTILL_FACTUAL_TOOL,
    DISTILL_FAILURE_TOOL,
    extract_distillation_result,
)
from ...llm.agent.skill_learner import skill_learner_agent


async def process_context_distillation(
    project_id: asUUID,
    session_id: asUUID,
    task_id: asUUID,
    learning_space_id: asUUID,
) -> Result[SkillLearnDistilled | None]:
    """Steps 1-2: Fetch task + raw messages, run context distillation.

    Returns a fully-formed SkillLearnDistilled payload on success.
    DB session is closed before returning — raw messages are freed from memory.
    """
    # Step 1: Fetch target task, raw messages, session tasks, and skill descriptions
    async with DB_CLIENT.get_session_context() as db_session:
        r = await TD.fetch_task(db_session, task_id)
        finished_task, eil = r.unpack()
        if eil:
            return Result.reject(f"Task {task_id} not found (stale message)")

        if finished_task.status not in (TaskStatus.SUCCESS, TaskStatus.FAILED):
            LOG.info(
                f"Skill learning: task {task_id} is {finished_task.status}, skipping"
            )
            return Result.resolve(None)

        r = await TD.fetch_current_tasks(db_session, session_id)
        all_tasks, eil = r.unpack()
        if eil:
            return Result.reject(f"Failed to fetch session tasks: {eil}")
        if not all_tasks:
            return Result.reject("Session has no tasks")

        # Fetch messages linked to this task
        task_messages = []
        if not finished_task.raw_message_ids:
            LOG.info(
                f"Skill learning: task {task_id} has no raw messages, distilling from metadata only"
            )
        if finished_task.raw_message_ids:
            r = await MD.fetch_messages_data_by_ids(
                db_session, finished_task.raw_message_ids
            )
            messages, eil = r.unpack()
            if not eil and messages:
                task_messages = [
                    MessageBlob(
                        message_id=m.id, role=m.role, parts=m.parts, task_id=m.task_id
                    )
                    for m in messages
                ]

        # Fetch skill descriptions so distillation can assess relevance
        skill_descriptions = []
        r = await LS.get_learning_space_skill_ids(db_session, learning_space_id)
        skill_ids, eil = r.unpack()
        if not eil and skill_ids:
            r = await LS.get_skills_info(db_session, skill_ids)
            skills_info, eil = r.unpack()
            if not eil and skills_info:
                skill_descriptions = [
                    (si.name, si.description) for si in skills_info
                ]

    # Step 2: Context Distillation
    if finished_task.status == TaskStatus.SUCCESS:
        tools = [
            DISTILL_SKIP_TOOL.model_dump(),
            DISTILL_SUCCESS_TOOL.model_dump(),
            DISTILL_FACTUAL_TOOL.model_dump(),
        ]
        distill_system_prompt = SkillDistillationPrompt.success_distillation_prompt()
    else:
        tools = [DISTILL_FAILURE_TOOL.model_dump()]
        distill_system_prompt = SkillDistillationPrompt.failure_distillation_prompt()

    user_content = SkillDistillationPrompt.pack_distillation_input(
        finished_task, task_messages, all_tasks, skill_descriptions
    )

    r = await llm_complete(
        system_prompt=distill_system_prompt,
        history_messages=[{"role": "user", "content": user_content}],
        tools=tools,
        prompt_kwargs={"prompt_id": "distill.skill_learner"},
    )
    llm_return, eil = r.unpack()
    if eil:
        LOG.warning(f"Skill learning distillation LLM call failed: {eil}")
        return Result.reject(f"Distillation LLM call failed: {eil}")

    distillation_result = extract_distillation_result(llm_return)
    outcome, eil = distillation_result.unpack()
    if eil:
        LOG.warning(f"Skill learning distillation extraction failed: {eil}")
        return Result.reject(f"Distillation extraction failed: {eil}")

    if not outcome.is_worth_learning:
        LOG.info(
            f"Skill learning: task {task_id} not worth learning, "
            f"reason: {outcome.skip_reason or 'not specified'}"
        )
        return Result.resolve(None)

    LOG.info(f"Skill learning distillation output:\n{outcome.distilled_text}")

    return Result.resolve(
        SkillLearnDistilled(
            project_id=project_id,
            session_id=session_id,
            task_id=task_id,
            learning_space_id=learning_space_id,
            distilled_context=outcome.distilled_text,
        )
    )


async def run_skill_agent(
    project_id: asUUID,
    learning_space_id: asUUID,
    distilled_context: str,
    max_iterations: int = 5,
) -> Result[None]:
    """Steps 3-4: Fetch learning space (for user_id) + skills, run agent.

    Re-fetches LearningSpace to get user_id (not passed via MQ message).
    """
    # Step 3: Fetch learning space info and skills
    async with DB_CLIENT.get_session_context() as db_session:
        r = await LS.get_learning_space(db_session, learning_space_id)
        ls, eil = r.unpack()
        if eil:
            return Result.reject(
                f"Learning space {learning_space_id} not found (deleted?)"
            )

        r = await LS.get_learning_space_skill_ids(db_session, learning_space_id)
        skill_ids, eil = r.unpack()
        if eil:
            return Result.reject(f"Failed to fetch skill IDs: {eil}")

        r = await LS.get_skills_info(db_session, skill_ids)
        skills_info, eil = r.unpack()
        if eil:
            return Result.reject(f"Failed to fetch skills info: {eil}")

    # Step 4: Run skill learner agent
    r = await skill_learner_agent(
        project_id=project_id,
        learning_space_id=learning_space_id,
        user_id=ls.user_id,
        skills_info=skills_info,
        distilled_context=distilled_context,
        max_iterations=max_iterations,
    )
    return r
