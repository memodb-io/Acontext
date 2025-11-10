from .space_search_lib.ls import _ls_tool
from .space_search_lib.attach_related_block import _attach_related_block_tool
from .space_search_lib.search_content import _search_content_tool
from .space_search_lib.search_title import _search_title_tool
from .space_search_lib.read_blocks import _read_blocks_tool
from .space_search_lib.submit_answer import _submit_answer_tool
from .util_lib.think import _thinking_tool
from .base import ToolPool
from .space_search_lib.ctx import SpaceSearchCtx

SPACE_SEARCH_TOOLS: ToolPool = {}


SPACE_SEARCH_TOOLS[_ls_tool.schema.function.name] = _ls_tool
SPACE_SEARCH_TOOLS[_search_title_tool.schema.function.name] = _search_title_tool
SPACE_SEARCH_TOOLS[_search_content_tool.schema.function.name] = _search_content_tool
SPACE_SEARCH_TOOLS[_read_blocks_tool.schema.function.name] = _read_blocks_tool
SPACE_SEARCH_TOOLS[_attach_related_block_tool.schema.function.name] = (
    _attach_related_block_tool
)
SPACE_SEARCH_TOOLS[_submit_answer_tool.schema.function.name] = _submit_answer_tool
SPACE_SEARCH_TOOLS[_thinking_tool.schema.function.name] = _thinking_tool
