import pytest
import uuid
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from acontext_core.infra.db import DatabaseClient
from acontext_core.schema.orm import BlockEmbedding, Block, Space, Project


FAKE_KEY = "c" * 32


@pytest.mark.asyncio
async def test_block_embedding_create_and_basic_queries():
    """Test creating block embeddings and basic CRUD operations"""
    db_client = DatabaseClient()
    await db_client.create_tables()

    async with db_client.get_session_context() as session:
        # Enable pgvector extension
        await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

        try:
            # Create test project and space
            project = Project(secret_key_hmac=FAKE_KEY, secret_key_hash_phc=FAKE_KEY)

            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create test blocks
            page_block = Block(
                space_id=space.id,
                type="page",
                title="Test Page",
                props={"description": "A test page"},
                sort=0,
            )
            session.add(page_block)
            await session.flush()

            text_block = Block(
                space_id=space.id,
                type="text",
                parent_id=page_block.id,
                title="Test Text",
                props={"content": "Machine learning algorithms"},
                sort=1,
            )
            session.add(text_block)
            await session.flush()

            # Create embeddings for blocks
            # Using 1536-dimensional vectors (OpenAI text-embedding-3-small dimension)
            page_embedding = BlockEmbedding(
                block_id=page_block.id,
                space_id=space.id,
                block_type=page_block.type,
                embedding=[0.1] * 1536,  # Simple test vector
                configs={"model": "text-embedding-3-small", "provider": "openai"},
            )
            session.add(page_embedding)

            text_embedding = BlockEmbedding(
                block_id=text_block.id,
                space_id=space.id,
                block_type=text_block.type,
                embedding=[0.2] * 1536,  # Different test vector
                configs={"model": "text-embedding-3-small", "provider": "openai"},
            )
            session.add(text_embedding)
            await session.commit()

            # Test 1: Query embeddings by block_id
            result = await session.execute(
                select(BlockEmbedding).where(BlockEmbedding.block_id == page_block.id)
            )
            embedding = result.scalar_one()
            assert embedding.block_id == page_block.id
            assert embedding.space_id == space.id
            assert embedding.block_type == "page"
            assert len(embedding.embedding) == 1536
            assert embedding.configs["model"] == "text-embedding-3-small"

            # Test 2: Query embeddings by space_id
            result = await session.execute(
                select(BlockEmbedding).where(BlockEmbedding.space_id == space.id)
            )
            embeddings = result.scalars().all()
            assert len(embeddings) == 2

            # Test 3: Query embeddings by space_id and block_type
            result = await session.execute(
                select(BlockEmbedding).where(
                    BlockEmbedding.space_id == space.id,
                    BlockEmbedding.block_type == "text",
                )
            )
            text_embeddings = result.scalars().all()
            assert len(text_embeddings) == 1
            assert text_embeddings[0].block_type == "text"

            print(f"✓ Basic CRUD tests passed: {len(embeddings)} embeddings created")

        # Cleanup
        finally:
            await session.delete(project)


@pytest.mark.asyncio
async def test_block_embedding_relationships():
    """Test relationships between BlockEmbedding, Block, and Space"""
    db_client = DatabaseClient()
    await db_client.create_tables()

    async with db_client.get_session_context() as session:
        # Enable pgvector extension
        await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        project = Project(
            secret_key_hmac=FAKE_KEY + "1", secret_key_hash_phc=FAKE_KEY + "1"
        )
        session.add(project)
        await session.flush()

        space = Space(project_id=project.id)
        session.add(space)
        await session.flush()

        block = Block(
            space_id=space.id,
            type="page",
            title="Test Block",
            props={},
            sort=0,
        )
        session.add(block)
        await session.flush()

        embedding = BlockEmbedding(
            block_id=block.id,
            space_id=space.id,
            block_type=block.type,
            embedding=[0.5] * 1536,
            configs={"test": "relationship"},
        )
        session.add(embedding)
        await session.flush()

    async with db_client.get_session_context() as session:
        # Enable pgvector extension
        try:

            # Test 1: Load embedding with block relationship
            result = await session.execute(
                select(BlockEmbedding)
                .options(selectinload(BlockEmbedding.block))
                .where(BlockEmbedding.id == embedding.id)
            )
            loaded_embedding = result.scalar_one()
            assert loaded_embedding.block is not None
            assert loaded_embedding.block.id == block.id
            assert loaded_embedding.block.title == "Test Block"

            # Test 2: Load embedding with space relationship
            result = await session.execute(
                select(BlockEmbedding)
                .options(selectinload(BlockEmbedding.space))
                .where(BlockEmbedding.id == embedding.id)
            )
            loaded_embedding = result.scalar_one()
            assert loaded_embedding.space is not None
            assert loaded_embedding.space.id == space.id

            # Test 3: Load block with embeddings (reverse relationship)
            result = await session.execute(
                select(Block)
                .options(selectinload(Block.embeddings))
                .where(Block.id == block.id)
            )
            loaded_block = result.scalar_one()
            print(len(loaded_block.embeddings), type(loaded_block.embeddings))
            assert len(loaded_block.embeddings) == 1
            assert loaded_block.embeddings[0].id == embedding.id

            # Test 4: Load space with block_embeddings (reverse relationship)
            result = await session.execute(
                select(Space)
                .options(selectinload(Space.block_embeddings))
                .where(Space.id == space.id)
            )
            loaded_space = result.scalar_one()
            assert len(loaded_space.block_embeddings) == 1
            assert loaded_space.block_embeddings[0].id == embedding.id

            print("✓ Relationship tests passed")

        # Cleanup
        finally:
            await session.delete(project)
            await session.commit()


@pytest.mark.asyncio
async def test_block_embedding_vector_similarity_search():
    """Test vector similarity search using cosine distance"""
    db_client = DatabaseClient()
    await db_client.create_tables()

    async with db_client.get_session_context() as session:
        # Enable pgvector extension
        await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

        # Create test data
        project = Project(
            secret_key_hmac=FAKE_KEY + "2", secret_key_hash_phc=FAKE_KEY + "2"
        )
        session.add(project)
        await session.flush()

        space = Space(project_id=project.id)
        session.add(space)
        await session.flush()

        # Create multiple blocks with different embeddings
        test_vectors = [
            [1.0, 0.0] + [0.0] * 1534,  # Vector 1
            [0.9, 0.1] + [0.0] * 1534,  # Vector 2 (similar to Vector 1)
            [0.0, 1.0] + [0.0] * 1534,  # Vector 3 (different)
            [0.5, 0.5] + [0.0] * 1534,  # Vector 4 (middle)
        ]

        embeddings = []
        for i, vector in enumerate(test_vectors):
            block = Block(
                space_id=space.id,
                type="text",
                title=f"Test Block {i}",
                props={"content": f"Content {i}"},
                sort=i,
            )
            session.add(block)
            await session.flush()

            embedding = BlockEmbedding(
                block_id=block.id,
                space_id=space.id,
                block_type=block.type,
                embedding=vector,
                configs={"index": i},
            )
            session.add(embedding)
            embeddings.append(embedding)

        await session.commit()

        # Test: Search for similar vectors using cosine distance
        query_vector = [1.0, 0.0] + [0.0] * 1534  # Should be most similar to Vector 1

        # Using pgvector's cosine distance operator (<=>)
        result = await session.execute(
            text(
                """
                SELECT id, block_id, configs, 
                       embedding <=> CAST(:query_vector AS vector) AS distance
                FROM block_embeddings
                WHERE space_id = :space_id
                ORDER BY embedding <=> CAST(:query_vector AS vector)
                LIMIT 3
                """
            ),
            {"query_vector": str(query_vector), "space_id": space.id},
        )

        similar_embeddings = result.all()
        assert len(similar_embeddings) >= 2

        # The first result should be the most similar (Vector 1 or Vector 2)
        # Vector 1 should be first (distance ~0), Vector 2 second (small distance)
        assert similar_embeddings[0].distance < similar_embeddings[1].distance

        print(f"✓ Vector similarity search test passed")
        print(f"  Top result distance: {similar_embeddings[0].distance:.4f}")
        print(f"  Second result distance: {similar_embeddings[1].distance:.4f}")

        # Cleanup
        await session.delete(project)
        await session.commit()


@pytest.mark.asyncio
async def test_block_embedding_cascade_delete():
    """Test cascade deletion when parent block or space is deleted"""
    db_client = DatabaseClient()
    await db_client.create_tables()

    async with db_client.get_session_context() as session:
        # Enable pgvector extension
        await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

        # Create test data
        project = Project(
            secret_key_hmac=FAKE_KEY + "3", secret_key_hash_phc=FAKE_KEY + "3"
        )
        session.add(project)
        await session.flush()

        space = Space(project_id=project.id)
        session.add(space)
        await session.flush()

        block = Block(
            space_id=space.id,
            type="text",
            title="Test Block",
            props={},
            sort=0,
        )
        session.add(block)
        await session.flush()

        embedding = BlockEmbedding(
            block_id=block.id,
            space_id=space.id,
            block_type=block.type,
            embedding=[0.1] * 1536,
            configs={},
        )
        session.add(embedding)
        await session.commit()

        embedding_id = embedding.id
        block_id = block.id

        # Test 1: Delete block should cascade to embedding
        await session.delete(block)
        await session.commit()

        # Verify embedding was deleted
        result = await session.execute(
            select(BlockEmbedding).where(BlockEmbedding.id == embedding_id)
        )
        assert result.scalar_one_or_none() is None

        print("✓ Cascade delete (block -> embedding) test passed")

        # Test 2: Create new block and embedding, then delete space
        space2 = Space(project_id=project.id)
        session.add(space2)
        await session.flush()

        block2 = Block(
            space_id=space2.id,
            type="text",
            title="Test Block 2",
            props={},
            sort=0,
        )
        session.add(block2)
        await session.flush()

        embedding2 = BlockEmbedding(
            block_id=block2.id,
            space_id=space2.id,
            block_type=block2.type,
            embedding=[0.2] * 1536,
            configs={},
        )
        session.add(embedding2)
        await session.commit()

        embedding2_id = embedding2.id
        space2_id = space2.id

        # Delete space should cascade to blocks and embeddings
        await session.delete(space2)
        await session.commit()

        # Verify embedding was deleted
        result = await session.execute(
            select(BlockEmbedding).where(BlockEmbedding.id == embedding2_id)
        )
        assert result.scalar_one_or_none() is None

        print("✓ Cascade delete (space -> block -> embedding) test passed")

        # Cleanup
        await session.delete(project)
        await session.commit()


@pytest.mark.asyncio
async def test_block_embedding_multiple_embeddings_per_block():
    """Test that a block can have multiple embeddings"""
    db_client = DatabaseClient()
    await db_client.create_tables()
    async with db_client.get_session_context() as session:
        # Enable pgvector extension
        await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

        # Create test data
        project = Project(
            secret_key_hmac=FAKE_KEY + "4", secret_key_hash_phc=FAKE_KEY + "4"
        )
        session.add(project)
        await session.flush()

        space = Space(project_id=project.id)
        session.add(space)
        await session.flush()

        block = Block(
            space_id=space.id,
            type="text",
            title="Test Block with Multiple Embeddings",
            props={"content": "Long text that gets chunked"},
            sort=0,
        )
        session.add(block)
        await session.flush()

        # Create multiple embeddings for the same block (e.g., different chunks)
        embedding1 = BlockEmbedding(
            block_id=block.id,
            space_id=space.id,
            block_type=block.type,
            embedding=[0.1] * 1536,
            configs={"chunk": 0, "model": "text-embedding-3-small"},
        )
        session.add(embedding1)

        embedding2 = BlockEmbedding(
            block_id=block.id,
            space_id=space.id,
            block_type=block.type,
            embedding=[0.2] * 1536,
            configs={"chunk": 1, "model": "text-embedding-3-small"},
        )
        session.add(embedding2)

        embedding3 = BlockEmbedding(
            block_id=block.id,
            space_id=space.id,
            block_type=block.type,
            embedding=[0.3] * 1536,
            configs={"chunk": 2, "model": "text-embedding-3-small"},
        )
        session.add(embedding3)

    async with db_client.get_session_context() as session:
        # Query all embeddings for the block
        try:
            result = await session.execute(
                select(Block)
                .options(selectinload(Block.embeddings))
                .where(Block.id == block.id)
            )
            loaded_block = result.scalar_one()

            assert len(loaded_block.embeddings) == 3

            # Verify configs are different
            chunks = [emb.configs.get("chunk") for emb in loaded_block.embeddings]
            assert sorted(chunks) == [0, 1, 2]

            print(
                f"✓ Multiple embeddings per block test passed: {len(loaded_block.embeddings)} embeddings"
            )

        # Cleanup
        finally:
            await session.delete(project)
            await session.commit()
