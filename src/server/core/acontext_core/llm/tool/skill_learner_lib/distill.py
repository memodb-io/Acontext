from ....schema.llm import ToolSchema, LLMResponse
from ....schema.result import Result


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
                "user_preferences_observed": {"type": "string"},
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
                "user_preferences_observed": {"type": "string"},
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


def extract_distillation_result(llm_return: LLMResponse) -> Result[str]:
    """Extract tool call arguments from LLM response and format as readable text."""
    if not llm_return.tool_calls:
        return Result.reject("No tool calls in LLM response")

    tool_call = llm_return.tool_calls[0]
    if tool_call.function is None:
        return Result.reject("Tool call has no function")

    func_name = tool_call.function.name
    args = tool_call.function.arguments

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
        if args.get("user_preferences_observed"):
            lines.append(
                f"**User Preferences Observed:** {args['user_preferences_observed']}"
            )
        return Result.resolve("\n".join(lines))

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
        if args.get("user_preferences_observed"):
            lines.append(
                f"**User Preferences Observed:** {args['user_preferences_observed']}"
            )
        return Result.resolve("\n".join(lines))

    else:
        return Result.reject(f"Unexpected tool call: {func_name}")
