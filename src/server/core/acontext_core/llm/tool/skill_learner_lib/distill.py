from dataclasses import dataclass
from ....schema.llm import ToolSchema, LLMResponse
from ....schema.result import Result

_WORTH_LEARNING_FIELD = {
    "is_worth_learning": {
        "type": "boolean",
        "description": (
            "Whether this task produced meaningful, reusable knowledge worth recording as a skill. "
            "Set false for trivial tasks (simple lookups, small talk, one-shot calculations, "
            "generic Q&A with no real procedure or decision)."
        ),
    },
    "skip_reason": {
        "type": "string",
        "description": (
            "If is_worth_learning is false, briefly explain why "
            "(e.g. 'simple factual lookup', 'no procedure involved'). "
            "Omit if is_worth_learning is true."
        ),
    },
}

DISTILL_SUCCESS_TOOL = ToolSchema(
    function={
        "name": "report_success_analysis",
        "description": "Report the structured analysis of a successful task.",
        "parameters": {
            "type": "object",
            "properties": {
                "task_goal": {"type": "string"},
                "approach": {"type": "string"},
                "key_decisions": {"type": "array", "items": {"type": "string"}},
                "generalizable_pattern": {"type": "string"},
                **_WORTH_LEARNING_FIELD,
            },
            "required": [
                "task_goal",
                "approach",
                "key_decisions",
                "generalizable_pattern",
                "is_worth_learning",
            ],
        },
    }
)

DISTILL_FAILURE_TOOL = ToolSchema(
    function={
        "name": "report_failure_analysis",
        "description": "Report the structured failure analysis of a failed task.",
        "parameters": {
            "type": "object",
            "properties": {
                "task_goal": {"type": "string"},
                "failure_point": {"type": "string"},
                "flawed_reasoning": {"type": "string"},
                "what_should_have_been_done": {"type": "string"},
                "prevention_principle": {"type": "string"},
                **_WORTH_LEARNING_FIELD,
            },
            "required": [
                "task_goal",
                "failure_point",
                "flawed_reasoning",
                "what_should_have_been_done",
                "prevention_principle",
                "is_worth_learning",
            ],
        },
    }
)


@dataclass
class DistillationOutcome:
    is_worth_learning: bool
    distilled_text: str | None = None
    skip_reason: str | None = None


def extract_distillation_result(llm_return: LLMResponse) -> Result[DistillationOutcome]:
    """Extract tool call arguments from LLM response and format as readable text.

    Returns a DistillationOutcome with is_worth_learning, distilled_text, and skip_reason.
    Defaults to is_worth_learning=True if the field is missing (fail-open).
    """
    if not llm_return.tool_calls:
        return Result.reject("No tool calls in LLM response")

    tool_call = llm_return.tool_calls[0]
    if tool_call.function is None:
        return Result.reject("Tool call has no function")

    func_name = tool_call.function.name
    args = tool_call.function.arguments

    is_worth_learning = args.get("is_worth_learning", True)
    skip_reason = args.get("skip_reason")

    if func_name == "report_success_analysis":
        required = ["task_goal", "approach", "key_decisions", "generalizable_pattern"]
        for field in required:
            if field not in args:
                return Result.reject(f"Missing required field: {field}")

        lines = [
            "## Task Analysis (Success)",
            f"**Goal:** {args['task_goal']}",
            f"**Approach:** {args['approach']}",
            "**Key Decisions:**",
        ]
        for decision in args["key_decisions"]:
            lines.append(f"  - {decision}")
        lines.append(f"**Generalizable Pattern:** {args['generalizable_pattern']}")
        return Result.resolve(
            DistillationOutcome(
                is_worth_learning=is_worth_learning,
                distilled_text="\n".join(lines),
                skip_reason=skip_reason,
            )
        )

    elif func_name == "report_failure_analysis":
        required = [
            "task_goal",
            "failure_point",
            "flawed_reasoning",
            "what_should_have_been_done",
            "prevention_principle",
        ]
        for field in required:
            if field not in args:
                return Result.reject(f"Missing required field: {field}")

        lines = [
            "## Task Analysis (Failure)",
            f"**Goal:** {args['task_goal']}",
            f"**Failure Point:** {args['failure_point']}",
            f"**Flawed Reasoning:** {args['flawed_reasoning']}",
            f"**What Should Have Been Done:** {args['what_should_have_been_done']}",
            f"**Prevention Principle:** {args['prevention_principle']}",
        ]
        return Result.resolve(
            DistillationOutcome(
                is_worth_learning=is_worth_learning,
                distilled_text="\n".join(lines),
                skip_reason=skip_reason,
            )
        )

    else:
        return Result.reject(f"Unexpected tool call: {func_name}")
