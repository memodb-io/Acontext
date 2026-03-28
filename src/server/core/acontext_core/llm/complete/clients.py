from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from ...env import DEFAULT_CORE_CONFIG

_global_openai_async_client = None
_global_anthropic_async_client = None


def get_openai_async_client_instance() -> AsyncOpenAI:
    global _global_openai_async_client
    if _global_openai_async_client is None:
        _global_openai_async_client = AsyncOpenAI(
            base_url=DEFAULT_CORE_CONFIG.llm_base_url,
            api_key=DEFAULT_CORE_CONFIG.llm_api_key,
            default_query=DEFAULT_CORE_CONFIG.llm_openai_default_query,
            default_headers=DEFAULT_CORE_CONFIG.llm_openai_default_header,
        )
    return _global_openai_async_client


def get_anthropic_async_client_instance() -> AsyncAnthropic:
    global _global_anthropic_async_client
    if _global_anthropic_async_client is None:
        _global_anthropic_async_client = AsyncAnthropic(
            api_key=DEFAULT_CORE_CONFIG.llm_api_key,
            base_url=DEFAULT_CORE_CONFIG.llm_base_url,
        )
    return _global_anthropic_async_client
