import base64
from typing import List, Optional
from uuid import UUID

from ...env import LOG
from ...infra.db import DB_CLIENT
from ...schema.result import Result
from ...schema.utils import asUUID
from ...schema.session.task import TaskStatus
from ...schema.session.message import MessageBlob
from ...schema.mq.learning import SkillLearnDistilled
from ...telemetry.log import get_wide_event
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
    user_kek: bytes | None = None,
    original_date: str | None = None,
) -> Result[SkillLearnDistilled | None]:
    """Steps 1-2: Fetch task + raw messages, run context distillation.

    Returns a fully-formed SkillLearnDistilled payload on success.
    DB session is closed before returning — raw messages are freed from memory.
    """
    wide = get_wide_event()

    async with DB_CLIENT.get_session_context() as db_session:
        r = await TD.fetch_task(db_session, task_id)
        finished_task, eil = r.unpack()
        if eil:
            wide["distill_outcome"] = "skipped_status"
            wide["skip_reason"] = f"Task {task_id} not found (stale message)"
            return Result.reject(f"Task {task_id} not found (stale message)")

        if finished_task.status not in (TaskStatus.SUCCESS, TaskStatus.FAILED):
            wide["distill_outcome"] = "skipped_status"
            wide["task_status"] = str(finished_task.status)
            return Result.resolve(None)

        wide["task_status"] = str(finished_task.status)

        r = await TD.fetch_current_tasks(db_session, session_id)
        all_tasks, eil = r.unpack()
        if eil:
            return Result.reject(f"Failed to fetch session tasks: {eil}")
        if not all_tasks:
            return Result.reject("Session has no tasks")

        task_messages = []
        has_raw = bool(finished_task.raw_message_ids)
        wide["has_raw_messages"] = has_raw
        if finished_task.raw_message_ids:
            r = await MD.fetch_messages_data_by_ids(
                db_session, finished_task.raw_message_ids, user_kek=user_kek
            )
            messages, eil = r.unpack()
            if not eil and messages:
                task_messages = [
                    MessageBlob(
                        message_id=m.id, role=m.role, parts=m.parts, task_id=m.task_id
                    )
                    for m in messages
                ]

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
                wide["skill_count"] = len(skills_info)

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
        wide["distill_outcome"] = "llm_failed"
        return Result.reject(f"Distillation LLM call failed: {eil}")

    distillation_result = extract_distillation_result(llm_return)
    outcome, eil = distillation_result.unpack()
    if eil:
        wide["distill_outcome"] = "extraction_failed"
        return Result.reject(f"Distillation extraction failed: {eil}")

    if not outcome.is_worth_learning:
        wide["distill_outcome"] = "skipped_not_worth"
        wide["skip_reason"] = outcome.skip_reason or "not specified"
        return Result.resolve(None)

    LOG.info(
        "distillation.output",
        text=outcome.distilled_text[:200],
    )

    wide["distill_outcome"] = "success"

    return Result.resolve(
        SkillLearnDistilled(
            project_id=project_id,
            session_id=session_id,
            task_id=task_id,
            learning_space_id=learning_space_id,
            distilled_context=outcome.distilled_text,
            user_kek=base64.b64encode(user_kek).decode() if user_kek else None,
            original_date=original_date,
        )
    )


async def run_skill_agent(
    project_id: asUUID,
    learning_space_id: asUUID,
    distilled_context: str,
    max_iterations: int = 5,
    lock_key: Optional[str] = None,
    lock_ttl_seconds: Optional[int] = None,
    user_kek: Optional[bytes] = None,
    original_date: Optional[str] = None,
) -> Result[List[UUID]]:
    """Steps 3-4: Fetch learning space (for user_id) + skills, run agent.

    Re-fetches LearningSpace to get user_id (not passed via MQ message).
    Returns drained session IDs on success so the consumer can mark them completed.
    """
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

    r = await skill_learner_agent(
        project_id=project_id,
        learning_space_id=learning_space_id,
        user_id=ls.user_id,
        skills_info=skills_info,
        distilled_context=distilled_context,
        max_iterations=max_iterations,
        lock_key=lock_key,
        lock_ttl_seconds=lock_ttl_seconds,
        user_kek=user_kek,
        original_date=original_date,
    )
    return r
