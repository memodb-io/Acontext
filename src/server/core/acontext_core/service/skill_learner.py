from ..env import LOG, DEFAULT_CORE_CONFIG
from ..infra.db import DB_CLIENT
from ..infra.async_mq import (
    register_consumer,
    publish_mq,
    Message,
    ConsumerConfigData,
    SpecialHandler,
)
from ..schema.mq.learning import SkillLearnTask
from .constants import EX, RK
from .data import learning_space as LS
from .controller import skill_learner as SLC
from .utils import check_redis_lock_or_set, release_redis_lock


@register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.learning_skill,
        routing_key=RK.learning_skill_process,
        queue_name="learning.skill.process.entry",
    )
)
async def process_skill_learn_task(body: SkillLearnTask, message: Message):
    LOG.info(f"Skill learner: received task {body.task_id} for session {body.session_id}")

    # Resolve learning_space_id from session
    async with DB_CLIENT.get_session_context() as db_session:
        r = await LS.get_learning_space_for_session(db_session, body.session_id)
        ls_session, eil = r.unpack()
        if eil or ls_session is None:
            LOG.info(
                f"Skill learner: session {body.session_id} has no learning space, skipping"
            )
            return

    learning_space_id = ls_session.learning_space_id
    lock_key = f"skill_learn.{learning_space_id}"

    _l = await check_redis_lock_or_set(
        body.project_id,
        lock_key,
        ttl_seconds=DEFAULT_CORE_CONFIG.skill_learn_lock_ttl_seconds,
    )
    if not _l:
        LOG.info(
            f"Skill learner: learning space {learning_space_id} is locked, republishing to retry"
        )
        await publish_mq(
            exchange_name=EX.learning_skill,
            routing_key=RK.learning_skill_process_retry,
            body=body.model_dump_json(),
        )
        return

    try:
        r = await SLC.process_skill_learning(
            body.project_id, body.session_id, body.task_id, learning_space_id
        )
        _, eil = r.unpack()
        if eil:
            LOG.warning(
                f"Skill learner: processing failed for task {body.task_id}: {eil}"
            )
    finally:
        await release_redis_lock(body.project_id, lock_key)


register_consumer(
    config=ConsumerConfigData(
        exchange_name=EX.learning_skill,
        routing_key=RK.learning_skill_process_retry,
        queue_name="learning.skill.process.retry.entry",
        message_ttl_seconds=DEFAULT_CORE_CONFIG.session_message_session_lock_wait_seconds,
        need_dlx_queue=True,
        use_dlx_ex_rk=(EX.learning_skill, RK.learning_skill_process),
    )
)(SpecialHandler.NO_PROCESS)
