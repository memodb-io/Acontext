from ..env import LOG, DEFAULT_CORE_CONFIG
from ..infra.db import DB_CLIENT
from ..infra.async_mq import (
    register_consumer,
    publish_mq,
    Message,
    ConsumerConfigData,
    SpecialHandler,
)
from ..schema.mq.learning import SkillLearnTask, SkillLearnDistilled
from .constants import EX, RK
from .data import learning_space as LS
from .controller import skill_learner as SLC
from .utils import check_redis_lock_or_set, release_redis_lock


# =============================================================================
# Consumer 1: Distillation — fast, single LLM call, no lock needed
# =============================================================================


@register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.learning_skill,
        routing_key=RK.learning_skill_distill,
        queue_name="learning.skill.distill.entry",
    )
)
async def process_skill_distillation(body: SkillLearnTask, message: Message):
    LOG.info(
        f"Skill distillation: received task {body.task_id} for session {body.session_id}"
    )

    # Resolve learning_space_id from session and mark as running
    async with DB_CLIENT.get_session_context() as db_session:
        r = await LS.get_learning_space_for_session(db_session, body.session_id)
        ls_session, eil = r.unpack()
        if eil or ls_session is None:
            LOG.info(
                f"Skill distillation: session {body.session_id} has no learning space, skipping"
            )
            return

        await LS.update_session_status(db_session, body.session_id, "running")

    learning_space_id = ls_session.learning_space_id

    # Run distillation (Steps 1-2)
    r = await SLC.process_context_distillation(
        body.project_id, body.session_id, body.task_id, learning_space_id
    )
    distilled_payload, eil = r.unpack()
    if eil:
        LOG.warning(
            f"Skill distillation: failed for task {body.task_id}: {eil}"
        )
        async with DB_CLIENT.get_session_context() as db_session:
            await LS.update_session_status(db_session, body.session_id, "failed")
        return

    if distilled_payload is None:
        LOG.info(
            f"Skill distillation: task {body.task_id} skipped (not success/failed)"
        )
        return

    # Publish distilled result to skill agent consumer
    await publish_mq(
        exchange_name=EX.learning_skill,
        routing_key=RK.learning_skill_agent,
        body=distilled_payload.model_dump_json(),
    )
    LOG.info(
        f"Skill distillation: published distilled context for learning space {learning_space_id}"
    )


# =============================================================================
# Consumer 2: Skill Agent — holds lock, custom timeout for agent loop
# =============================================================================


@register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.learning_skill,
        routing_key=RK.learning_skill_agent,
        queue_name="learning.skill.agent.entry",
        timeout=DEFAULT_CORE_CONFIG.skill_learn_lock_ttl_seconds + 60,
    )
)
async def process_skill_agent(body: SkillLearnDistilled, message: Message):
    LOG.info(
        f"Skill agent: received distilled context for session {body.session_id}, "
        f"task {body.task_id}, learning space {body.learning_space_id}"
    )

    lock_key = f"skill_learn.{body.learning_space_id}"

    _l = await check_redis_lock_or_set(
        body.project_id,
        lock_key,
        ttl_seconds=DEFAULT_CORE_CONFIG.skill_learn_lock_ttl_seconds,
    )
    if not _l:
        LOG.info(
            f"Skill agent: learning space {body.learning_space_id} is locked, republishing to retry"
        )
        await publish_mq(
            exchange_name=EX.learning_skill,
            routing_key=RK.learning_skill_agent_retry,
            body=body.model_dump_json(),
        )
        return

    try:
        r = await SLC.run_skill_agent(
            body.project_id,
            body.learning_space_id,
            body.distilled_context,
            max_iterations=DEFAULT_CORE_CONFIG.skill_learn_agent_max_iterations,
        )
        _, eil = r.unpack()
        if eil:
            LOG.warning(
                f"Skill agent: processing failed for learning space {body.learning_space_id}: {eil}"
            )
            async with DB_CLIENT.get_session_context() as db_session:
                await LS.update_session_status(
                    db_session, body.session_id, "failed"
                )
        else:
            async with DB_CLIENT.get_session_context() as db_session:
                await LS.update_session_status(
                    db_session, body.session_id, "completed"
                )
    finally:
        await release_redis_lock(body.project_id, lock_key)


# =============================================================================
# Retry queue for agent consumer (DLX pattern)
# =============================================================================

register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.learning_skill,
        routing_key=RK.learning_skill_agent_retry,
        queue_name="learning.skill.agent.retry.entry",
        message_ttl_seconds=DEFAULT_CORE_CONFIG.skill_learn_agent_retry_delay_seconds,
        need_dlx_queue=True,
        use_dlx_ex_rk=(EX.learning_skill, RK.learning_skill_agent),
    )
)(SpecialHandler.NO_PROCESS)
