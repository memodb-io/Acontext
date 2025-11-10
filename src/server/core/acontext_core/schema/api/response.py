from typing import Any
from pydantic import BaseModel, Field
from ..utils import asUUID


class SearchResultBlockItem(BaseModel):
    block_id: asUUID = Field(..., description="Block UUID")
    title: str = Field(..., description="Block title")
    type: str = Field(..., description="Block type")
    props: dict[str, Any] = Field(
        ...,
        description="Block properties. For text and sop blocks, it is the rendered props.",
    )
    distance: float = Field(..., description="Distance between the query and the block")
