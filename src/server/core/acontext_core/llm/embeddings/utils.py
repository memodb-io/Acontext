from openai import AsyncOpenAI
from httpx import AsyncClient
from ...env import DEFAULT_CORE_CONFIG

_global_openai_async_client = None
_global_jina_async_client = None
_global_lmstudio_async_client = None


def get_openai_async_client_instance() -> AsyncOpenAI:
    global _global_openai_async_client
    if _global_openai_async_client is None:
        _global_openai_async_client = AsyncOpenAI(
            base_url=DEFAULT_CORE_CONFIG.block_embedding_base_url
            or DEFAULT_CORE_CONFIG.llm_base_url,
            api_key=DEFAULT_CORE_CONFIG.block_embedding_api_key
            or DEFAULT_CORE_CONFIG.llm_api_key,
        )
    return _global_openai_async_client


def get_jina_async_client_instance() -> AsyncClient:
    global _global_jina_async_client
    assert (
        DEFAULT_CORE_CONFIG.block_embedding_base_url is not None
    ), "Jina base URL is not set"
    assert (
        DEFAULT_CORE_CONFIG.block_embedding_api_key is not None
    ), "Jina API key is not set"
    if _global_jina_async_client is None:
        _global_jina_async_client = AsyncClient(
            base_url=DEFAULT_CORE_CONFIG.block_embedding_base_url,
            headers={
                "Authorization": f"Bearer {DEFAULT_CORE_CONFIG.block_embedding_api_key}"
            },
        )
    return _global_jina_async_client


def get_lmstudio_async_client_instance() -> AsyncClient:
    global _global_lmstudio_async_client
    assert (
        DEFAULT_CORE_CONFIG.block_embedding_base_url is not None
    ), "LMStudio base URL is not set"
    assert (
        DEFAULT_CORE_CONFIG.block_embedding_api_key is not None
    ), "LMStudio API key is not set"
    if _global_lmstudio_async_client is None:
        _global_lmstudio_async_client = AsyncClient(
            base_url=DEFAULT_CORE_CONFIG.block_embedding_base_url,
            headers={
                "Authorization": f"Bearer {DEFAULT_CORE_CONFIG.block_embedding_api_key}"
            },
        )
    return _global_lmstudio_async_client
