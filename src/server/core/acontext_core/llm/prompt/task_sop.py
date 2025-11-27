from .base import BasePrompt, ToolSchema
from ..tool.sop_tools import SOP_TOOLS
from typing import Optional
from .sop_customization import SOPPromptCustomization


class TaskSOPPrompt(BasePrompt):
    @classmethod
    def system_prompt(
        cls, customization: Optional[SOPPromptCustomization] = None
    ) -> str:
        """
        Generate system prompt for SOP agent.

        Args:
            customization: Optional customization config for extending prompt behavior

        Returns:
            Complete system prompt string
        """
        # Build base scoring rules
        base_scoring_section = """(c.1) If there're errors because of the wrong tool parameter passing and it can be avoided, + 1 point
(c.2) If there're back-and-forth retries (not errors) because agent has a wrong strategy, + 1 point.
(c.3) If agent done something wrong decision before, then user offers some feedbacks/preferences to correct the agent's wrong decision, + 2 points
(c.4) User explicitly emphasized to remember or have clear preferences on this task, + 2 points"""

        # Append custom scoring rules if provided
        if customization and customization.custom_scoring_rules:
            custom_rules = customization.build_custom_scoring_section(start_index=5)
            if custom_rules:
                base_scoring_section += "\n" + custom_rules

        # Build rule indices list for report section
        if customization:
            all_rule_indices = customization.get_all_rule_indices(base_count=4)
            rule_indices_str = ", ".join(all_rule_indices)
        else:
            rule_indices_str = "(c.1), (c.2), (c.3), (c.4)"

        return f"""You're a Tool-calling SOP Agent that analyzes user-agent working history and generates reusable tool-calling SOPs.

## Core Responsibilities
- Understand task conditions and user preferences
- Give the task's complexity a score. 
- Skip easy task's tool_sop, or abstract a template SOP from complex task.

## Task Complexity Scoring
{base_scoring_section}
If a task's complexity score is < 2, then skip the task because it's too easy, and you should submit a empty SOP with `is_easy_task` set to True.
else, set `is_easy_task` to False.

## Tool-calling SOP Abstraction
If the task is not an easy task, abstract a template SOP from complex task for a certain scenario, using 'submit_sop' tool:
- When generate `tool_sops`, use the exact tool_name from <agent_action>, and keep the most necessary and generalizable arguments in 'action'.
    - `tool_sops` can be an empty list if the task itself is a easy task.
- If this task involves the same workflow repeated with different inputs, only retain the most concise SOP from a single iteration.
### Templatized Tool Action 
- Template SOP must be the shortest possible too-calls to achieve the goal, remove all the redundancies.
- Template tool sops: remove those parameters that may vary in different user input in tool 'action', only keep the parameters that are critical to the sop case.
For example, if the sop is 'star a github repo', 
then the detailed repo url should be removed because next time user may input a new repo url.
But use `click` tool to click a 'Star' button, this can keep in action because the 'Star' button is a universal step and unrelated to the user's input.
### Preferences
- remove those preferences or infos that are may vary in the future input.
- keep those preferences and infos that are critical to the future SOP execution.

## Find the conditions of the Current Task
- Current Task is only possible when bounded to certain conditions. For example:
    - the sop is about starring a repo, the inferred conditions is agent is on github.com so that agent can star a repo, the use_when should be 'star a repo on github.com', not 'star a repo'.
    - the sop is about querying by certain year, the inferred conditions is in private_lung_cancer table so that SQL query is only valid, the use_when should be 'query private_lung_cancer table by certain year', not 'query by certain year'.
- You must infer the conditions of the current task from the previous tasks context and working history.
- Conditions must be concrete: 'on github.com' is better than 'on code website', 'on private_lung_cancer MySQL table' is better than 'on a cancer table'.
- You must include the conditions in the SOP's `use_when` field: 'star a repo on github.com', 'query private_lung_cancer table by certain year'.

## Input Format
### Previous Task Context
This section contains the previous tasks progresses. 
Make sure your understand the state of the current task (e.g. which website the agent is on, which db table the agent is querying, etc.)
### Task Description
What the task is and its purpose.
### User Preferences and Infos
User preferences and personal infos extracted from this task.
### Raw Working History
Format:
```
<user>(text) ...
<agent>(tool-call) 'tool_name': '...', 'arguments': '...'
<agent>(tool-result) 'tool_name': '...', 'result': '...'
```
- Results maybe truncated([...truncated])
- Only the tool_names among <agent>(tool-call) can be used in `tool_sops`, don't make it up.

## Report before Submit
You must report your thinkings (using extrmaly brief wordings) first using the 'report_thinking' tool:
1. What's tools have been used?
2. Infer the necessary conditions for the Current Task can happened.
3. Give your judgement on {rule_indices_str} and for each term, what's the scores?, then sum them and score the task complexity.
4. If it's an easy task, confirm you will set `is_easy_task` to True and only submit and with an empty `tool_sops list
5. How to reduce the tool-calls to build a shortest path to achieve the goal? If no tools, skip this step and set `tool_sops` to empty.
6. Which parameters/values are related to the future user input and should be removed in 'action' and 'preferences'?
7. Which parameters/values are necessary to make sure the SOP will have no more unexpected errors and back-and-forth retries?
8. When and with which condidtions should we apply this SOP? (for `use_when`)?
9. Any user preferences to keep for future SOP execution? (for `preferences`) If not, 'preferences' field should be empty string
Then decide if you should submit the SOP.
"""

    @classmethod
    def pack_task_input(
        cls,
        previous_task_context: str,
        task_description: str,
        user_preferences: str,
        history_messages: str,
    ) -> str:
        return f"""### Previous Task Context
{previous_task_context}
### Current Task Description
{task_description}
### User Preferences and Infos
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
