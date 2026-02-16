from ..data import message as MD
from ..data import learning_space as LS
from ...infra.db import DB_CLIENT
from ...schema.session.task import TaskStatus
from ...schema.session.message import MessageBlob
from ...schema.utils import asUUID
from ...schema.result import Result
from ...llm.agent import task as AT
from ...llm.complete import llm_complete
from ...env import LOG
from ...schema.config import ProjectConfig
from ...telemetry.get_metrics import get_metrics
from ...constants import ExcessMetricTags
from ..data import session as SD

TITLE_INPUT_MAX_CHARS = 512
TITLE_INPUT_MIN_CHARS = 12
TITLE_GENERATION_MAX_TOKENS = 24
NON_INFORMATIVE_TITLE_INPUTS = {
    "hi",
    "hello",
    "hey",
    "ok",
    "okay",
    "thanks",
    "thank you",
    "test",
    "testing",
}
TITLE_GENERATION_SYSTEM_PROMPT = """You generate concise session titles.
Given a user's first message, return one short, informative title.
Rules:
- 3 to 8 words.
- Use plain text only.
- Do not use quotes.
- Do not include punctuation at the end.
"""


def normalize_title_input_text(text: str, max_chars: int = TITLE_INPUT_MAX_CHARS) -> str | None:
    normalized = " ".join(text.strip().split())
    if normalized == "":
        return None
    if len(normalized) > max_chars:
        normalized = normalized[:max_chars].rstrip()
    return normalized


def check_title_input_quality(text: str | None) -> tuple[bool, str]:
    if text is None:
        return False, "empty"
    normalized = normalize_title_input_text(text)
    if normalized is None:
        return False, "empty"
    if len(normalized) < TITLE_INPUT_MIN_CHARS:
        return False, "too_short"
    if normalized.lower() in NON_INFORMATIVE_TITLE_INPUTS:
        return False, "non_informative"
    return True, "ok"


def extract_first_user_message_text(messages: list[MessageBlob]) -> str | None:
    for message in messages:
        if message.role != "user":
            continue
        text_parts = [
            part.text.strip()
            for part in message.parts
            if part.type == "text"
            and isinstance(part.text, str)
            and part.text.strip() != ""
        ]
        if text_parts:
            return normalize_title_input_text("\n".join(text_parts))
    return None


async def generate_session_title_candidate(
    first_user_message_text: str,
) -> Result[str | None]:
    r = await llm_complete(
        system_prompt=TITLE_GENERATION_SYSTEM_PROMPT,
        history_messages=[{"role": "user", "content": first_user_message_text}],
        max_tokens=TITLE_GENERATION_MAX_TOKENS,
        prompt_kwargs={"prompt_id": "session.display_title.first_user"},
    )
    llm_response, eil = r.unpack()
    if eil:
        return Result.reject(eil.errmsg)
    if llm_response.content is None:
        return Result.resolve(None)
    title_candidate = llm_response.content.strip()
    if title_candidate == "":
        return Result.resolve(None)
    return Result.resolve(title_candidate)


async def process_session_pending_message(
    project_config: ProjectConfig, project_id: asUUID, session_id: asUUID
) -> Result[None]:
    disabled = await get_metrics(project_id, ExcessMetricTags.new_task_created)

    pending_message_ids = None
    try:
        async with DB_CLIENT.get_session_context() as session:
            r = await MD.get_message_ids(
                session,
                session_id,
                limit=(
                    project_config.project_session_message_buffer_max_overflow
                    + project_config.project_session_message_buffer_max_turns
                ),
                asc=True,
            )
            pending_message_ids, eil = r.unpack()
            if eil:
                return r
            if not pending_message_ids:
                return Result.resolve(None)
            if disabled:
                LOG.warning(
                    f"Project {project_id} has disabled new task creation, skip"
                )
                await MD.update_message_status_to(
                    session, pending_message_ids, TaskStatus.FAILED
                )
                return Result.resolve(None)
            await MD.update_message_status_to(
                session, pending_message_ids, TaskStatus.RUNNING
            )
        LOG.info(f"Unpending {len(pending_message_ids)} session messages to process")

        async with DB_CLIENT.get_session_context() as session:
            r = await MD.fetch_messages_data_by_ids(session, pending_message_ids)
            messages, eil = r.unpack()
            if eil:
                return r

            r = await MD.fetch_previous_messages_by_datetime(
                session,
                session_id,
                messages[0].created_at,
                limit=project_config.project_session_message_use_previous_messages_turns,
            )
            messages_data = [
                MessageBlob(
                    message_id=m.id, role=m.role, parts=m.parts, task_id=m.task_id
                )
                for m in messages
            ]
            r = await SD.should_generate_session_display_title(session, session_id)
            should_generate_title, eil = r.unpack()
            if eil:
                return r
            if not should_generate_title:
                first_user_message_text = None
                LOG.debug(
                    f"Session {session_id} already has display_title, "
                    "skip title-input extraction"
                )
            else:
                first_user_message_text = extract_first_user_message_text(messages_data)
                is_quality_ok, quality_reason = check_title_input_quality(
                    first_user_message_text
                )
                if not is_quality_ok:
                    first_user_message_text = None
                    LOG.debug(
                        f"Skip title-input generation for session {session_id}: "
                        f"{quality_reason}"
                    )
                else:
                    LOG.debug(
                        f"Extracted first user text from pending session {session_id}, "
                        f"length={len(first_user_message_text)}"
                    )

        if first_user_message_text is not None:
            r = await generate_session_title_candidate(first_user_message_text)
            title_candidate, eil = r.unpack()
            if eil:
                LOG.warning(
                    f"Title generation failed for session {session_id}: {eil.errmsg}"
                )
            elif title_candidate is None:
                LOG.debug(
                    f"Title generation returned empty content for session {session_id}"
                )
            else:
                LOG.debug(
                    f"Generated session title candidate for session {session_id}: "
                    f"{title_candidate[:80]}"
                )

        ls_session = None
        async with DB_CLIENT.get_session_context() as session:
            r = await LS.get_learning_space_for_session(session, session_id)
            _ls_session, eil = r.unpack()
            if eil is None:
                ls_session = _ls_session

        r = await AT.task_agent_curd(
            project_id,
            session_id,
            messages_data,
            max_iterations=project_config.default_task_agent_max_iterations,
            previous_progress_num=project_config.default_task_agent_previous_progress_num,
            learning_space_id=ls_session.learning_space_id if ls_session is not None else None,
        )

        after_status = TaskStatus.SUCCESS
        if not r.ok():
            after_status = TaskStatus.FAILED
        async with DB_CLIENT.get_session_context() as session:
            await MD.update_message_status_to(
                session, pending_message_ids, after_status
            )
        return r
    except Exception as e:
        if pending_message_ids is None:
            raise e
        LOG.error(
            f"Exception while processing session pending message: {e}, rollback {len(pending_message_ids)} message status to failed"
        )
        async with DB_CLIENT.get_session_context() as session:
            await MD.update_message_status_to(
                session, pending_message_ids, TaskStatus.FAILED
            )
        raise e
