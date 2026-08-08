from acontext_core.llm.complete import FACTORIES
from acontext_core.llm.complete.openai_sdk import openai_complete
from acontext_core.schema.config import CoreConfig


def test_minimax_uses_openai_compatible_adapter():
    config = CoreConfig(
        llm_api_key="test-key",
        llm_base_url="https://api.minimax.io/v1",
        llm_sdk="minimax",
        llm_simple_model="MiniMax-M3",
    )

    assert config.llm_sdk == "minimax"
    assert FACTORIES[config.llm_sdk] is openai_complete
