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


@pytest.fixture(autouse=True)
def mock_block_search_get_embedding():
    """
    Automatically mock get_embedding for block_search tests.

    This fixture:
    - Applies automatically to all tests (autouse=True)
    - Mocks the embedding API calls in search_path_blocks
    - Returns consistent embeddings for reproducible search tests

    The mock returns a deterministic embedding based on the input text
    to allow testing search ranking logic.
    """
    with patch("acontext_core.service.data.block_search.get_embedding") as mock:

        async def get_mock_embedding(texts, phase="document"):
            """Generate deterministic embeddings based on text content"""
            # Simple hash-based embedding for consistent results
            text = texts[0].lower() if texts else ""

            # Create a deterministic embedding based on text content
            # This allows search tests to have predictable results
            base_vector = np.zeros(
                DEFAULT_CORE_CONFIG.block_embedding_dim, dtype=np.float32
            )

            # Set different values based on keywords to create meaningful similarities
            if "machine" in text or "learning" in text or "neural" in text:
                base_vector[0] = 0.8
                base_vector[1] = 0.2
                base_vector[2] = 0.1
            elif "cooking" in text or "recipe" in text or "food" in text:
                base_vector[0] = 0.1
                base_vector[1] = 0.8
                base_vector[2] = 0.5
            elif "ai" in text or "artificial" in text or "research" in text:
                base_vector[0] = 0.7
                base_vector[1] = 0.3
                base_vector[2] = 0.15
            else:
                # Default random embedding for unknown queries
                base_vector = np.random.rand(
                    DEFAULT_CORE_CONFIG.block_embedding_dim
                ).astype(np.float32)

            mock_embedding_return = EmbeddingReturn(
                embedding=base_vector.reshape(1, -1),
                prompt_tokens=10,
                total_tokens=10,
            )
            return Result.resolve(mock_embedding_return)

        mock.side_effect = get_mock_embedding
        yield mock
