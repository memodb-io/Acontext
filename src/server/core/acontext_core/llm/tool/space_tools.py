from .space_lib.ls import _ls_tool
from .space_lib.create_page import _create_page_tool
from .space_lib.create_folder import _create_folder_tool
from .space_lib.mv import _move_tool
from .space_lib.rename import _rename_tool
from .space_lib.finish import _finish_tool
from .space_lib.search_title import _search_title_tool
from .space_lib.search_content import _search_content_tool
from .space_lib.read_blocks import _read_blocks_tool
from .space_lib.delete_block import _delete_block_tool
from .space_lib.delete_path import _delete_path_tool
from .space_lib.insert_candidate_data_as_content import (
    _insert_candidate_data_as_content_tool,
)
from .util_lib.think import _thinking_tool
from .base import ToolPool
from .space_lib.ctx import SpaceCtx

SPACE_TOOLS: ToolPool = {}


SPACE_TOOLS[_ls_tool.schema.function.name] = _ls_tool
SPACE_TOOLS[_create_page_tool.schema.function.name] = _create_page_tool
SPACE_TOOLS[_create_folder_tool.schema.function.name] = _create_folder_tool
SPACE_TOOLS[_move_tool.schema.function.name] = _move_tool
SPACE_TOOLS[_rename_tool.schema.function.name] = _rename_tool
SPACE_TOOLS[_search_title_tool.schema.function.name] = _search_title_tool
SPACE_TOOLS[_search_content_tool.schema.function.name] = _search_content_tool
SPACE_TOOLS[_read_blocks_tool.schema.function.name] = _read_blocks_tool
SPACE_TOOLS[_delete_block_tool.schema.function.name] = _delete_block_tool
SPACE_TOOLS[_delete_path_tool.schema.function.name] = _delete_path_tool
SPACE_TOOLS[_insert_candidate_data_as_content_tool.schema.function.name] = (
    _insert_candidate_data_as_content_tool
)
SPACE_TOOLS[_finish_tool.schema.function.name] = _finish_tool
SPACE_TOOLS[_thinking_tool.schema.function.name] = _thinking_tool
