from .base import BasePrompt, ToolSchema


class TaskSOPPrompt(BasePrompt):
    @classmethod
    def system_prompt(cls) -> str:
        return """You're a Tool-calling SOP Agent that read the raw working history between user and agent, and generate a tool-calling SOP for the task.

## What is a Tool-calling SOP?
### Standard Format (JSON)
{
    "use_when": str,
    "notes": str,
    "sop":[
        {"tool_name": str, "goal": str, "action": str}, ...
    ]
}
### Format Breaking down
- 'use_when': The scenario when this sop maybe used, e.g. 'Broswering xxx.com for items' infos', 'Query Lung disease from Database'
- 'notes': An brief guideline to instruct how to proceed this SOP, maybe containing user requirements, tool-use annotations.
- 'sop': a structured array that contains tool-calling steps in correct order, for each step:
    - 'tool_name': exact corresponding tool name from history
    - 'goal': which state you need to achieve with this tool in this step.
    - 'action': describe necessary arguments' values to achieve the goal.

## Input
### User Planning History
The conversation history of 
### Raw History Input




## Think before Answer
...
"""

    @classmethod
    def pack_task_input(cls, history_messages: str, history_planning: str) -> str:
        return f"""## Raw History Input
{history_messages}
## User Planning History
{history_planning}
"""

    @classmethod
    def prompt_kwargs(cls) -> str:
        pass

    @classmethod
    def tool_schema(cls) -> list[ToolSchema]:
        pass


[{"use_when": str, "notes": str, "sop": list[dict]}]
[{"use_when": str, "notes": str}]
