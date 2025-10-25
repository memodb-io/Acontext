from .sop_lib.submit import _submit_sop_tool
from .sop_lib.ctx import SOPCtx
from .base import ToolPool

SOP_TOOLS: ToolPool = {}


SOP_TOOLS[_submit_sop_tool.schema.function.name] = _submit_sop_tool
