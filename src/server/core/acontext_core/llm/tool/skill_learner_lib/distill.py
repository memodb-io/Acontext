from dataclasses import dataclass
from ....schema.llm import ToolSchema, LLMResponse
from ....schema.result import Result

DISTILL_SKIP_TOOL = ToolSchema(
    function={
        "name": "skip_learning",
        "description": (
            "Skip learning from this task. Use when the task is trivial and not worth "
            "recording — e.g. simple factual lookups, small talk, one-shot calculations, "
            "generic Q&A with no domain content, or trivial status checks."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Brief reason for skipping (e.g. 'small talk', 'simple calculation').",
                },
            },
            "required": ["reason"],
        },
    }
)

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
            },
            "required": [
                "task_goal",
                "approach",
                "key_decisions",
                "generalizable_pattern",
            ],
        },
    }
)

DISTILL_FACTUAL_TOOL = ToolSchema(
    function={
        "name": "report_factual_content",
        "description": (
            "Report factual content extracted from the task — people, preferences, "
            "entities, or domain facts. Use this instead of report_success_analysis "
            "when the task is primarily about recording information rather than a "
            "multi-step procedure."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "task_goal": {"type": "string"},
                "facts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "List of concise, self-contained factual statements extracted "
                        "from the conversation. Each fact should be a single sentence "
                        "in third-person. E.g. 'Bob Martinez is on the DevOps team.'"
                    ),
                },
            },
            "required": ["task_goal", "facts"],
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
            },
            "required": [
                "task_goal",
                "failure_point",
                "flawed_reasoning",
                "what_should_have_been_done",
                "prevention_principle",
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
    """Extract tool call arguments from LLM response and format as readable text."""
    if not llm_return.tool_calls:
        return Result.reject("No tool calls in LLM response")

    tool_call = llm_return.tool_calls[0]
    if tool_call.function is None:
        return Result.reject("Tool call has no function")

    func_name = tool_call.function.name
    args = tool_call.function.arguments

    if func_name == "skip_learning":
        return Result.resolve(
            DistillationOutcome(
                is_worth_learning=False,
                skip_reason=args.get("reason", "not specified"),
            )
        )

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
                is_worth_learning=True,
                distilled_text="\n".join(lines),
            )
        )

    if func_name == "report_factual_content":
        if "facts" not in args:
            return Result.reject("Missing required field: facts")

        lines = [
            "## Factual Content",
            f"**Context:** {args.get('task_goal', 'N/A')}",
            "**Facts:**",
        ]
        for fact in args["facts"]:
            lines.append(f"  - {fact}")
        return Result.resolve(
            DistillationOutcome(
                is_worth_learning=True,
                distilled_text="\n".join(lines),
            )
        )

    if func_name == "report_failure_analysis":
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
                is_worth_learning=True,
                distilled_text="\n".join(lines),
            )
        )

    return Result.reject(f"Unexpected tool call: {func_name}")
