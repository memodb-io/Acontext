from sqlalchemy.sql.functions import user
from .base import BasePrompt, ToolSchema
from ..tool.sop_tools import SOP_TOOLS


class TaskSOPPrompt(BasePrompt):
    @classmethod
    def system_prompt(cls) -> str:
        return """You're a Tool-calling SOP Agent that analyzes user-agent working history and generates reusable tool-calling SOPs.

## Core Responsibilities
- Understand task and user preferences
- Skip easy task
- Abstract to general patterns of SOP.
### Redundancy Detection
- Failed attempts
- Rework because user offers some preferences?
- Multiple lookups, but only some of them is effective.
### Easy task
If the raw hisotry show the agent delivers results but no errors, no user corrections, no redundancy, then this task is easy.

## Tool-calling SOP Structure
A tool-calling SOP instructs agents how to complete tasks in specific scenarios.
Fields: 'use_when' (5-10 words, concise), 'notes', 'tool_sops'.
- When generate `tool_sops`, use the exact tool_name from <agent_action>, and keep the most necessary and generalizable arguments in 'action'.
- Submit using 'submit_sop' tool. Only submit if task is standardizable. Submit once with comprehensive SOP.
- `tool_sops` can be an empty list if the task itself is a easy or direct task.


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
- Only the tools among <agent>(tool-call) can be used in `tool_sops`, and you will refer its exact 'tool_name', don't make it up.

## Report before Submit
Report your thinking step be step(using extrmaly brief wordings):
### Basic
0. What's tools have been used?
1. In which scenarios should we use this SOP? (3~5words for `use_when`)
2. What preferences/notes should be added?
3. Any redundancy? Think of ### Redundancy Detection section
4. Is this task a easy task? Think of ### Easy task section
5. If task is easy, only user preferences are worth submit, too_sops should be empty
6. If not preference or worthwhile tool_sops, don't call submit_sop
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
        return [SOP_TOOLS["submit_sop"].schema]
