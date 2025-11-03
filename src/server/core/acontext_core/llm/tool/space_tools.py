from .space_lib.ls import _ls_tool
from .util_lib.think import _thinking_tool
from .base import ToolPool
from .space_lib.ctx import SpaceCtx

SPACE_TOOLS: ToolPool = {}


SPACE_TOOLS[_ls_tool.schema.function.name] = _ls_tool
SPACE_TOOLS[_thinking_tool.schema.function.name] = _thinking_tool
