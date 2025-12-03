from typing import Literal
from traceback import format_exc
from ...env import LOG, DEFAULT_CORE_CONFIG
from ...schema.result import Result
from ...schema.embedding import EmbeddingReturn
from ...telemetry.otel import instrument_llm_embedding
from .jina_embedding import jina_embedding
from .openai_embedding import openai_embedding

FACTORIES = {
    "openai": openai_embedding,
    "jina": jina_embedding,
}
assert (
    DEFAULT_CORE_CONFIG.block_embedding_provider in FACTORIES
), f"Unsupported embedding provider: {DEFAULT_CORE_CONFIG.block_embedding_provider}"


async def embedding_sanity_check():
    r = await get_embedding(["Hello, world!"])
    if not r.ok():
        raise ValueError(
            "Embedding API check failed! Make sure the embedding API key is valid."
        )
    d = r.data
    embedding_dim = d.embedding.shape[-1]
    if embedding_dim != DEFAULT_CORE_CONFIG.block_embedding_dim:
        raise ValueError(
            f"Embedding dimension mismatch! Expected {DEFAULT_CORE_CONFIG.block_embedding_dim}, got {embedding_dim}."
        )
    LOG.info(f"Embedding dimension matched with Config: {embedding_dim}")


@instrument_llm_embedding
async def get_embedding(
    texts: list[str],
    phase: Literal["query", "document"] = "document",
    model: str = None,
) -> Result[EmbeddingReturn]:
    model = model or DEFAULT_CORE_CONFIG.block_embedding_model
    provider = DEFAULT_CORE_CONFIG.block_embedding_provider
    try:
        results = await FACTORIES[provider](
            model, texts, phase
        )
    except Exception as e:
        LOG.error(f"Error in get_embedding: {e} {format_exc()}")
        return Result.reject(f"Error in get_embedding: {e}")
    return Result.resolve(results)
