import base64
from ..env import LOG, DEFAULT_CORE_CONFIG
from ..infra.db import DB_CLIENT
from ..infra.async_mq import (
    register_consumer,
    publish_mq,
    Message,
    ConsumerConfigData,
)
from ..telemetry.log import get_wide_event
from ..schema.mq.learning import SkillLearnTask, SkillLearnDistilled
from ..schema.session.learning_space import SessionStatus
from .constants import EX, RK
from .data import learning_space as LS
from .data import session as SD
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
    wide = get_wide_event()

    async with DB_CLIENT.get_session_context() as db_session:
        r = await LS.get_learning_space_for_session(db_session, body.session_id)
        ls_session, eil = r.unpack()
        if eil or ls_session is None:
            wide["distillation_outcome"] = "skipped_no_learning_space"
            return

        await LS.update_session_status(db_session, body.session_id, SessionStatus.DISTILLING)

        # Get session configs to extract original_date
        r = await SD.fetch_session(db_session, body.session_id)
        session, eil = r.unpack()
        original_date = None
        if not eil and session and session.configs:
            original_date = session.configs.get("original_date")
            LOG.info(
                "skill_learner.original_date_parsed",
                session_id=str(body.session_id),
                original_date=original_date,
            )

    learning_space_id = ls_session.learning_space_id
    wide["learning_space_id"] = str(learning_space_id)
    wide["task_id"] = str(body.task_id)
    if original_date:
        wide["original_date"] = original_date

    # Decode user KEK from base64 if present.
    # Hard-fail on invalid KEK — running without it would store plaintext in the DB.
    user_kek_bytes = None
    if body.user_kek:
        try:
            user_kek_bytes = base64.b64decode(body.user_kek)
        except Exception:
            LOG.error("skill_learner.invalid_user_kek", session_id=str(body.session_id))
            async with DB_CLIENT.get_session_context() as db_session:
                await LS.update_session_status(db_session, body.session_id, SessionStatus.FAILED)
            return

    r = await SLC.process_context_distillation(
        body.project_id, body.session_id, body.task_id, learning_space_id,
        user_kek=user_kek_bytes,
        original_date=original_date,
    )
    distilled_payload, eil = r.unpack()
    if eil:
        wide["distillation_outcome"] = "failed"
        async with DB_CLIENT.get_session_context() as db_session:
            await LS.update_session_status(db_session, body.session_id, SessionStatus.FAILED)
        return

    if distilled_payload is None:
        wide["distillation_outcome"] = "skipped_not_worth"
        async with DB_CLIENT.get_session_context() as db_session:
            await LS.update_session_status(db_session, body.session_id, SessionStatus.COMPLETED)
        return

    # Set status to skill_writing before publishing to skill agent
    # This indicates that distillation is done and skill files are being written
    async with DB_CLIENT.get_session_context() as db_session:
        await LS.update_session_status(db_session, body.session_id, SessionStatus.SKILL_WRITING)

    await publish_mq(
        exchange_name=EX.learning_skill,
        routing_key=RK.learning_skill_agent,
        body=distilled_payload.model_dump_json(),
    )
    wide["distillation_outcome"] = "success"
    wide["published_to_agent"] = True


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
    wide = get_wide_event()

    lock_key = f"skill_learn.{body.learning_space_id}"
    wide["lock_key"] = lock_key

    _l = await check_redis_lock_or_set(
        body.project_id,
        lock_key,
        ttl_seconds=DEFAULT_CORE_CONFIG.skill_learn_lock_ttl_seconds,
    )
    if not _l:
        wide["lock_acquired"] = False
        wide["action"] = "pushed_to_pending"
        await push_skill_learn_pending(
            body.project_id, body.learning_space_id, body.model_dump_json()
        )
        async with DB_CLIENT.get_session_context() as db_session:
            await LS.update_session_status(db_session, body.session_id, SessionStatus.QUEUED)
        return

    wide["lock_acquired"] = True

    # Decode user KEK from base64 if present.
    # Hard-fail on invalid KEK — running without it would store plaintext in the DB.
    user_kek_bytes = None
    if body.user_kek:
        try:
            user_kek_bytes = base64.b64decode(body.user_kek)
        except Exception:
            LOG.error("skill_agent.invalid_user_kek", session_id=str(body.session_id))
            async with DB_CLIENT.get_session_context() as db_session:
                await LS.update_session_status(db_session, body.session_id, SessionStatus.FAILED)
            return

    try:
        r = await SLC.run_skill_agent(
            body.project_id,
            body.learning_space_id,
            body.distilled_context,
            max_iterations=DEFAULT_CORE_CONFIG.skill_learn_agent_max_iterations,
            lock_key=lock_key,
            lock_ttl_seconds=DEFAULT_CORE_CONFIG.skill_learn_lock_ttl_seconds,
            user_kek=user_kek_bytes,
            original_date=body.original_date,
        )
        drained_session_ids, eil = r.unpack()
        if eil:
            wide["agent_outcome"] = "failed"
            async with DB_CLIENT.get_session_context() as db_session:
                await LS.update_session_status(db_session, body.session_id, SessionStatus.FAILED)
        else:
            all_session_ids = [body.session_id] + (drained_session_ids or [])
            all_session_ids = list(set(all_session_ids))
            wide["agent_outcome"] = "success"
            wide["sessions_completed"] = [str(s) for s in all_session_ids]
            async with DB_CLIENT.get_session_context() as db_session:
                for sid in all_session_ids:
                    await LS.update_session_status(db_session, sid, SessionStatus.COMPLETED)
    except Exception as e:
        wide["agent_outcome"] = "error"
        wide["error"] = {"type": type(e).__name__, "message": str(e)}
        async with DB_CLIENT.get_session_context() as db_session:
            await LS.update_session_status(db_session, body.session_id, SessionStatus.FAILED)
    finally:
        await release_redis_lock(body.project_id, lock_key)
        try:
            remaining = await drain_skill_learn_pending(
                body.project_id, body.learning_space_id, max_read=1
            )
            if remaining:
                await publish_mq(
                    exchange_name=EX.learning_skill,
                    routing_key=RK.learning_skill_agent,
                    body=remaining[0].model_dump_json(),
                )
                wide["retrigger_published"] = True
                wide["pending_remaining"] = 1
            else:
                wide["retrigger_published"] = False
                wide["pending_remaining"] = 0
        except Exception as e:
            LOG.error(
                "skill_agent.retrigger_failed",
                learning_space_id=str(body.learning_space_id),
                error=str(e),
            )
            wide["retrigger_published"] = False
            wide["retrigger_error"] = str(e)
