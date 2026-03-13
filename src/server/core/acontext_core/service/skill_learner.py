from ..env import LOG, DEFAULT_CORE_CONFIG
from ..infra.db import DB_CLIENT
from ..infra.async_mq import (
    register_consumer,
    publish_mq,
    Message,
    ConsumerConfigData,
)
from ..schema.mq.learning import SkillLearnTask, SkillLearnDistilled
from .constants import EX, RK
from .data import learning_space as LS
from .controller import skill_learner as SLC
from .utils import (
    check_redis_lock_or_set,
    release_redis_lock,
    push_skill_learn_pending,
    drain_skill_learn_pending,
)


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
        LOG.warning(f"Skill distillation: failed for task {body.task_id}: {eil}")
        async with DB_CLIENT.get_session_context() as db_session:
            await LS.update_session_status(db_session, body.session_id, "failed")
        return

    if distilled_payload is None:
        LOG.info(
            f"Skill distillation: task {body.task_id} skipped (task not actionable or not worth learning)"
        )
        async with DB_CLIENT.get_session_context() as db_session:
            await LS.update_session_status(db_session, body.session_id, "completed")
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
        timeout=DEFAULT_CORE_CONFIG.skill_learn_agent_consumer_timeout,
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
            f"Skill agent: learning space {body.learning_space_id} is locked, pushing to Redis pending list"
        )
        await push_skill_learn_pending(
            body.project_id, body.learning_space_id, body.model_dump_json()
        )
        async with DB_CLIENT.get_session_context() as db_session:
            await LS.update_session_status(db_session, body.session_id, "queued")
        return

    should_retrigger = False
    try:
        r = await SLC.run_skill_agent(
            body.project_id,
            body.learning_space_id,
            body.distilled_context,
            max_iterations=DEFAULT_CORE_CONFIG.skill_learn_agent_max_iterations,
            lock_key=lock_key,
            lock_ttl_seconds=DEFAULT_CORE_CONFIG.skill_learn_lock_ttl_seconds,
        )
        drained_session_ids, eil = r.unpack()
        if eil:
            LOG.warning(
                f"Skill agent: processing failed for learning space {body.learning_space_id}: {eil}"
            )
            async with DB_CLIENT.get_session_context() as db_session:
                await LS.update_session_status(db_session, body.session_id, "failed")
        else:
            should_retrigger = True
            all_session_ids = [body.session_id] + (drained_session_ids or [])
            all_session_ids = list(set(all_session_ids))
            async with DB_CLIENT.get_session_context() as db_session:
                for sid in all_session_ids:
                    await LS.update_session_status(db_session, sid, "completed")
    except Exception as e:
        LOG.error(
            f"Skill agent: unhandled exception for learning space {body.learning_space_id}: {e}"
        )
        async with DB_CLIENT.get_session_context() as db_session:
            await LS.update_session_status(db_session, body.session_id, "failed")
    finally:
        await release_redis_lock(body.project_id, lock_key)

    if should_retrigger:
        remaining = await drain_skill_learn_pending(
            body.project_id, body.learning_space_id, max_read=1
        )
        if remaining:
            await publish_mq(
                exchange_name=EX.learning_skill,
                routing_key=RK.learning_skill_agent,
                body=remaining[0].model_dump_json(),
            )
            LOG.info(
                f"Skill agent: remaining contexts in Redis, re-triggered agent "
                f"for learning space {body.learning_space_id}"
            )
