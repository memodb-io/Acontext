import numpy as np
from pydantic import BaseModel, ConfigDict


class EmbeddingReturn(BaseModel):
    embedding: np.ndarray
    prompt_tokens: int
    total_tokens: int

    model_config = ConfigDict(arbitrary_types_allowed=True)
