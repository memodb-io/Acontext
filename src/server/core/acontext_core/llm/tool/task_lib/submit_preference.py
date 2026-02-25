from ..base import Tool
from ....env import LOG
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data import task as TD
from .ctx import TaskCtx


async def _submit_user_preference_handler(
    ctx: TaskCtx,
    llm_arguments: dict,
) -> Result[str]:
    preference: str = llm_arguments.get("preference", None)

    if not preference or not preference.strip():
        return Result.resolve(
            "You must provide a non-empty preference string. Submitting preference failed."
        )

    preference = preference.strip()

    # MQ path first — always succeeds, ensures preference is never lost
    ctx.pending_preferences.append(preference)

    # DB persist second — soft-fail on error
    try:
        r = await TD.append_preference_to_planning_task(
            ctx.db_session, ctx.project_id, ctx.session_id, preference
        )
        if not r.ok():
            LOG.warning(
                f"Failed to persist preference to planning task (non-fatal): {r.error}"
            )
    except Exception as e:
        LOG.warning(
            f"Exception persisting preference to planning task (non-fatal): {e}"
        )

    return Result.resolve(f"User preference submitted: {preference}")


_submit_user_preference_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "submit_user_preference",
                "description": """Submit a user preference, personal info, or general constraint for learning. These are task-independent — submit them regardless of which task (if any) they relate to.
- Examples: tech stack preferences, coding style, personal info (name, email), tool/workflow preferences, project constraints.
- Each call submits one preference — be specific and self-contained.
- Do NOT skip preferences just because they seem unrelated to the current task.
- IMPORTANT: Always write in third-person ("The user prefers X", "The user's name is Y"). Never use first-person pronouns (I, my, me) — these memories will be read by other agents who would confuse "I" with themselves.""",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "preference": {
                            "type": "string",
                            "description": "A specific, self-contained user preference, personal info, or constraint statement. Must use third-person (e.g. 'The user prefers TypeScript', NOT 'I prefer TypeScript').",
                        },
                    },
                    "required": ["preference"],
                },
            }
        )
    )
    .use_handler(_submit_user_preference_handler)
)
