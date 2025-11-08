from pydantic import BaseModel
from ..utils import asUUID


class LLMRenderBlock(BaseModel):
    parent_id: asUUID
    order: int
    props: dict | None
    type: str
    block_id: asUUID
