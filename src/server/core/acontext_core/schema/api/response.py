from pydantic import BaseModel
from ..utils import asUUID


class SearchResultBlockItem(BaseModel):
    block_id: asUUID
    distance: float
