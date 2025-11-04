from .space_lib.ls import _ls_tool
from .space_lib.create_page import _create_page_tool
from .space_lib.create_folder import _create_folder_tool
from .space_lib.mv import _move_tool
from .space_lib.rename import _rename_tool
from .util_lib.think import _thinking_tool
from .base import ToolPool
from .space_lib.ctx import SpaceCtx

SPACE_TOOLS: ToolPool = {}


SPACE_TOOLS[_ls_tool.schema.function.name] = _ls_tool
SPACE_TOOLS[_create_page_tool.schema.function.name] = _create_page_tool
SPACE_TOOLS[_create_folder_tool.schema.function.name] = _create_folder_tool
SPACE_TOOLS[_move_tool.schema.function.name] = _move_tool
SPACE_TOOLS[_rename_tool.schema.function.name] = _rename_tool
SPACE_TOOLS[_thinking_tool.schema.function.name] = _thinking_tool
