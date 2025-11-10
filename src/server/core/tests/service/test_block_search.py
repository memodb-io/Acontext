import pytest
from acontext_core.schema.orm import Block, BlockEmbedding, Project, Space
from acontext_core.schema.orm.block import BLOCK_TYPE_PAGE, BLOCK_TYPE_FOLDER
from acontext_core.infra.db import DatabaseClient
from acontext_core.service.data.block_search import search_path_blocks


class TestBlockSearch:
    @pytest.mark.asyncio
    async def test_search_path_blocks_basic(self, mock_block_search_get_embedding):
        """Test basic semantic search for page and folder blocks"""
        db_client = DatabaseClient()
        await db_client.create_tables()
        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create test blocks
            page1 = Block(
                space_id=space.id,
                type=BLOCK_TYPE_PAGE,
                title="Machine Learning Guide",
                props={"view_when": "Deep learning and neural networks"},
                sort=0,
            )
            session.add(page1)
            await session.flush()

            page2 = Block(
                space_id=space.id,
                type=BLOCK_TYPE_PAGE,
                title="Cooking Recipes",
                props={"view_when": "Italian pasta and pizza"},
                sort=1,
            )
            session.add(page2)
            await session.flush()

            folder1 = Block(
                space_id=space.id,
                type=BLOCK_TYPE_FOLDER,
                title="AI Research",
                props={"view_when": "Artificial intelligence papers"},
                sort=2,
            )
            session.add(folder1)
            await session.flush()

            # Create embeddings for the blocks
            # The mock in conftest.py will generate embeddings based on text content
            # These vectors match the mock's keyword-based generation
            import numpy as np

            # ML-related page - vector based on "machine learning" keywords
            ml_embedding = np.zeros(1536, dtype=np.float32)
            ml_embedding[0] = 0.8
            ml_embedding[1] = 0.2
            ml_embedding[2] = 0.1

            embedding1 = BlockEmbedding(
                block_id=page1.id,
                space_id=space.id,
                block_type=page1.type,
                embedding=ml_embedding,
                configs={"model": "test"},
            )
            session.add(embedding1)

            # Cooking page - vector based on "cooking" keywords
            cooking_embedding = np.zeros(1536, dtype=np.float32)
            cooking_embedding[0] = 0.1
            cooking_embedding[1] = 0.8
            cooking_embedding[2] = 0.5

            embedding2 = BlockEmbedding(
                block_id=page2.id,
                space_id=space.id,
                block_type=page2.type,
                embedding=cooking_embedding,
                configs={"model": "test"},
            )
            session.add(embedding2)

            # AI folder - vector similar to ML page
            ai_embedding = np.zeros(1536, dtype=np.float32)
            ai_embedding[0] = 0.7
            ai_embedding[1] = 0.3
            ai_embedding[2] = 0.15

            embedding3 = BlockEmbedding(
                block_id=folder1.id,
                space_id=space.id,
                block_type=folder1.type,
                embedding=ai_embedding,
                configs={"model": "test"},
            )
            session.add(embedding3)

            await session.commit()

            # Test search - search for "machine learning" related content
            # The mock will generate an embedding with [0.8, 0.2, 0.1, ...]
            # which should match page1 and folder1 closely
            result = await search_path_blocks(
                db_session=session,
                space_id=space.id,
                query_text="neural networks deep learning",
                topk=3,
                threshold=1.0,
            )

            # Verify result structure
            assert result.ok(), f"Search should succeed, got error: {result.error}"
            results = result.data
            assert isinstance(results, list), "Should return a list"
            assert len(results) > 0, "Should find at least one matching block"

            # Verify each result
            for block, distance in results:
                assert isinstance(block, Block), "First element should be Block"
                assert isinstance(distance, float), "Second element should be float"
                assert block.type in [
                    BLOCK_TYPE_PAGE,
                    BLOCK_TYPE_FOLDER,
                ], "Should only return page or folder blocks"
                assert distance >= 0.0, "Distance should be non-negative"

            # Verify ML-related content ranks higher (lower distance) than cooking
            result_ids = [block.id for block, _ in results]
            result_distances = {block.id: distance for block, distance in results}

            # ML page or AI folder should be in results
            assert (
                page1.id in result_ids or folder1.id in result_ids
            ), "Should find ML-related content"

            # If cooking page is in results, it should have higher distance than ML content
            if page2.id in result_ids:
                ml_distance = min(
                    result_distances.get(page1.id, float("inf")),
                    result_distances.get(folder1.id, float("inf")),
                )
                cooking_distance = result_distances[page2.id]
                assert (
                    ml_distance < cooking_distance
                ), "ML content should be more similar than cooking content"

            print(f"✓ Search test passed - Found {len(results)} results")

            # Cleanup - delete the project (cascades to space, blocks, embeddings)
            await session.delete(project)
            await session.commit()
