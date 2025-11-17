from .base import BasePrompt, ToolSchema
from ..tool.sop_tools import SOP_TOOLS
from typing import Optional
from .sop_customization import SOPPromptCustomization


class TaskSOPPrompt(BasePrompt):
    @classmethod
    def system_prompt(cls, customization: Optional[SOPPromptCustomization] = None) -> str:
        """
        Generate system prompt for SOP agent.
        
        Args:
            customization: Optional customization config for extending prompt behavior
            
        Returns:
            Complete system prompt string
        """
        # Build base scoring rules
        base_scoring_section = """### Task Complexity Scoring
(c.1) If there're errors because of the wrong tool parameter passing and it can be avoided, + 1 point
(c.2) If there're back-and-forth retries (not errors) because agent has a wrong strategy, + 1 point.
(c.3) If agent done something wrong decision before, then user offers some feedbacks/preferences to correct the agent's wrong decision, + 2 points
(c.4) User explicitly emphasized saving this workflow or experience, + 5 points"""
        
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
- Understand task and user preferences
- Give the task's complexity a score. 
- Skip easy task's tool_sop, or abstract a template SOP from complex task.
{base_scoring_section}
If a task's complexity score is < 2, then skip the task because it's too easy, and you should submit a empty SOP with `is_easy_task` set to True.
else, set `is_easy_task` to False.

### Tool-calling SOP Abstraction
If the task is not an easy task, abstract a template SOP from complex task for a certain scenario, using 'submit_sop' tool:
- When generate `tool_sops`, use the exact tool_name from <agent_action>, and keep the most necessary and generalizable arguments in 'action'.
    - `tool_sops` can be an empty list if the task itself is a easy task.
- If this task involves the same workflow repeated with different inputs, only retain the most concise SOP from a single iteration.
#### Templatized Tool Action 
- Template SOP must be the shortest possible too-calls to achieve the goal, remove all the redundancies.
- Template tool sops: remove those parameters that may vary in different user input in tool 'action', only keep the parameters that are critical to the sop case.
For example, if the sop is 'star a github repo', 
then the detailed repo url should be removed because next time user may input a new repo url.
But use `click` tool to click a 'Star' button, this can keep in action because the 'Star' button is a universal step and unrelated to the user's input.
#### Preferences
- remove those preferences or infos that are may vary in different user input.

## Input Format
### Task Description
What the task is and its purpose.
### User Preferences and Infos
User preferences and personal infos for this task.
### Raw Working History
Format:
```
<user>(text) ...
<agent>(text) ...
<agent>(tool-call) {{'tool_name': '...', 'arguments': {{'...'}}}}
<agent>(tool-result) {{'tool_name': '...', 'result': '...'}}
```
- Results maybe truncated([...truncated])
- Only the tool_names among <agent>(tool-call) can be used in `tool_sops`, don't make it up.

## Report before Submit
You must report your thinkings (using extrmaly brief wordings) first using the 'report_thinking' tool:
1. What's tools have been used?
2. Give your judgement on {rule_indices_str} and for each term, what's the scores?, then sum them and score the task complexity.
3. If it's an easy task, confirm you will set `is_easy_task` to True and only submit the `use_when` and `preferences` field and an empty `tool_sops list
4. How to reduce the tool-calls to build a shortest path to achieve the goal?
5. Which parameters/values are related to the future user input and should be removed in 'action' and 'preferences'?
6. Which parameters/values are necessary to make sure the SOP will have no more unexpected errors and back-and-forth retries?
7. In which general scenarios should we use this SOP? (3~5 words for `use_when`)
8. Any user preferences can help this general scenarios? (short sentenqces for `preferences`) If not, 'preferences' field should be empty string
Then decide if you should submit the SOP.
"""

    @classmethod
    def pack_task_input(
        cls, task_description: str, user_preferences: str, history_messages: str
    ) -> str:
        return f"""### Task Description
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
