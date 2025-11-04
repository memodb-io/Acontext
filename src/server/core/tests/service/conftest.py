"""
Shared test fixtures for service layer tests.
"""

import pytest
import numpy as np
from unittest.mock import AsyncMock, patch

from acontext_core.env import DEFAULT_CORE_CONFIG
from acontext_core.schema.result import Result
from acontext_core.schema.embedding import EmbeddingReturn


@pytest.fixture(autouse=True)
def mock_block_get_embedding():
    """
    Automatically mock get_embedding for all tests in this directory.

    This fixture:
    - Applies automatically to all tests (autouse=True)
    - Can be injected as a parameter to assert call counts
    - Returns a successful Result with mock embedding data

    Usage:
        # Automatic - no changes needed:
        async def test_create_page(self):
            r = await create_new_path_block(...)
            assert r.ok()

        # With call count assertion:
        async def test_create_pages(self, mock_block_get_embedding):
            r = await create_new_path_block(...)
            assert mock_block_get_embedding.call_count == 1
    """
    with patch("acontext_core.service.data.block.get_embedding") as mock:
        # Create a mock EmbeddingReturn with 1536-dimensional embedding (default for text-embedding-3-small)
        mock_embedding_return = EmbeddingReturn(
            embedding=np.random.rand(1, DEFAULT_CORE_CONFIG.block_embedding_dim).astype(
                np.float32
            ),
            prompt_tokens=10,
            total_tokens=10,
        )

        # Configure the AsyncMock to return a successful Result
        mock.return_value = Result.resolve(mock_embedding_return)

        yield mock
