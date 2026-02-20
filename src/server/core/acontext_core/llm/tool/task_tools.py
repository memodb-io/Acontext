from .task_lib.insert import _insert_task_tool
from .task_lib.update import _update_task_tool
from .task_lib.append_planning import _append_messages_to_planning_section_tool
from .task_lib.append import _append_messages_to_task_tool
from .task_lib.progress import _append_task_progress_tool
from .task_lib.submit_preference import _submit_user_preference_tool
from .task_lib.finish import _finish_tool
from .base import ToolPool
from .util_lib.think import _thinking_tool

TASK_TOOLS: ToolPool = {}

TASK_TOOLS[_insert_task_tool.schema.function.name] = _insert_task_tool
TASK_TOOLS[_update_task_tool.schema.function.name] = _update_task_tool
TASK_TOOLS[_append_messages_to_planning_section_tool.schema.function.name] = (
    _append_messages_to_planning_section_tool
)
TASK_TOOLS[_append_messages_to_task_tool.schema.function.name] = (
    _append_messages_to_task_tool
)
TASK_TOOLS[_append_task_progress_tool.schema.function.name] = (
    _append_task_progress_tool
)
TASK_TOOLS[_submit_user_preference_tool.schema.function.name] = (
    _submit_user_preference_tool
)
TASK_TOOLS[_finish_tool.schema.function.name] = _finish_tool
TASK_TOOLS[_thinking_tool.schema.function.name] = _thinking_tool
