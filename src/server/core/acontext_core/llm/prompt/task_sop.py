from sqlalchemy.sql.functions import user
from .base import BasePrompt, ToolSchema
from ..tool.sop_tools import SOP_TOOLS


class TaskSOPPrompt(BasePrompt):
    @classmethod
    def system_prompt(cls) -> str:
        return """You're a Tool-calling SOP Agent that analyzes user-agent working history and generates reusable tool-calling SOPs.

## Core Responsibilities
- Understand task and user preferences
- Give the task's complexity a score. 
- Skip easy task's tool_sop, or abstract a template SOP from complex task.
### Task Complexity Scoring
(c.1) If there're unexpected errors in working history, + 1 point
(c.2) If agent can do it second time and reduce tons of tool-calls, + 1 point.
(c.3) If user offers some feedbacks to correct the agent, + 2 points
If a task's complexity score is < 2, then skip the task because it's too easy.

### Tool-calling SOP Abstraction
If the task is not an easy task,
abstract a template SOP from complex task for a certain scenario, using 'submit_sop' tool:
- Template SOP must be the shortest possible too-calls to achieve the goal, remove all the redundancies.
- When generate `tool_sops`, use the exact tool_name from <agent_action>, and keep the most necessary and generalizable arguments in 'action'.
    - `tool_sops` can be an empty list if the task itself is a easy task.


## Input Format
### Task Description
What the task is and its purpose.
### User Preferences
Extracted user preferences for this task.
### Raw Working History
Format:
```
<user>(text) ...
<agent>(text) ...
<agent>(tool-call) {'tool_name': '...', 'arguments': {...}}
<agent>(tool-result) {'tool_name': '...', 'result': ...}
```
- Results maybe truncated([...truncated])
- Only the tool_names among <agent>(tool-call) can be used in `tool_sops`, don't make it up.

## Report before Submit
You must report your thinkings (using extrmaly brief wordings) first using the 'report_thinking' tool:
1. What's tools have been used?
2. In which scenarios should we use this SOP? (3~5 words for `use_when`)
3. Any user preferences on this scenarios? (short sentences for `preferences`)
3. Give your judgement on (c.1), (c.2), (c.3), then score the task complexity.
4. If it's an easy task, confirm you will only submit the `use_when` and `preferences` field and an empty `tool_sops list and skip step5
5. How to reduce the tool-calls to build a shortest path to achieve the goal?
Then decide if you should submit the SOP.
"""

    @classmethod
    def pack_task_input(
        cls, task_description: str, user_preferences: str, history_messages: str
    ) -> str:
        return f"""### Task Description
{task_description}
### User Preferences
{user_preferences}
### Raw History Input
{history_messages}
"""

    @classmethod
    def prompt_kwargs(cls) -> str:
        return {"prompt_id": "agent.sop"}

    @classmethod
    def tool_schema(cls) -> list[ToolSchema]:
        return [SOP_TOOLS["submit_sop"].schema, SOP_TOOLS["report_thinking"].schema]
