import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from acontext_core.infra.db import DatabaseClient
from acontext_core.schema.orm import Project, Space, Block, BlockReference

FAKE_KEY = "b" * 32


@pytest.mark.asyncio
async def test_block_reference_set_null_on_delete():
    """
    Test that when a referenced block is deleted, the BlockReference record
    persists with reference_block_id set to NULL (not cascade deleted).
    """
    db_client = DatabaseClient()

    # Drop and recreate tables to ensure schema is up-to-date with new SET NULL constraint
    await db_client.create_tables()

    async with db_client.get_session_context() as session:
        try:
            # Create test project and space
            project = Project(secret_key_hmac=FAKE_KEY, secret_key_hash_phc=FAKE_KEY)
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create a page block (will be referenced)
            target_block = Block(
                space_id=space.id,
                type="page",
                title="Target Page",
                props={"description": "This page will be referenced"},
                sort=0,
            )
            session.add(target_block)
            await session.flush()

            # Create a reference block under a parent page
            parent_page = Block(
                space_id=space.id,
                type="page",
                title="Parent Page",
                props={},
                sort=1,
            )
            session.add(parent_page)
            await session.flush()

            reference_block = Block(
                space_id=space.id,
                type="reference",
                parent_id=parent_page.id,
                title="Reference to Target",
                props={},
                sort=0,
            )
            session.add(reference_block)
            await session.flush()

            # Create BlockReference linking reference_block -> target_block
            block_reference = BlockReference(
                block_id=reference_block.id,
                reference_block_id=target_block.id,
            )
            session.add(block_reference)
            await session.commit()

            # Store IDs for later verification
            reference_block_id = reference_block.id
            target_block_id = target_block.id
            block_reference_block_id = block_reference.block_id

            # Verify the relationship is set up correctly before deletion
            result = await session.execute(
                select(BlockReference).where(
                    BlockReference.block_id == reference_block_id
                )
            )
            br_before = result.scalar_one()
            assert br_before.reference_block_id == target_block_id
            assert br_before.reference_block_id is not None
            print(
                f"✓ BlockReference created: {br_before.block_id} -> {br_before.reference_block_id}"
            )

            # Delete the target block (the block being referenced)
            await session.delete(target_block)
            await session.commit()
            session.expire_all()  # Ensure we get fresh data from database
            print(f"✓ Target block deleted: {target_block_id}")

            # Verify that the target block is deleted
            result = await session.execute(
                select(Block).where(Block.id == target_block_id)
            )
            deleted_block = result.scalar_one_or_none()
            assert deleted_block is None
            print("✓ Target block confirmed deleted from database")

            # Verify that the reference block still exists
            result = await session.execute(
                select(Block).where(Block.id == reference_block_id)
            )
            existing_reference_block = result.scalar_one_or_none()
            assert existing_reference_block is not None
            assert existing_reference_block.id == reference_block_id
            assert existing_reference_block.type == "reference"
            print(f"✓ Reference block still exists: {existing_reference_block.id}")

            # Verify that the BlockReference still exists but with NULL reference_block_id
            result = await session.execute(
                select(BlockReference).where(
                    BlockReference.block_id == block_reference_block_id
                )
            )
            br_after = result.scalar_one_or_none()
            assert br_after is not None
            assert br_after.block_id == reference_block_id
            assert br_after.reference_block_id is None  # SET NULL behavior
            print(f"✓ BlockReference persists with NULL reference_block_id")

            # Verify relationship access
            result = await session.execute(
                select(BlockReference)
                .options(selectinload(BlockReference.reference_block))
                .where(BlockReference.block_id == reference_block_id)
            )
            br_with_rel = result.scalar_one()
            assert br_with_rel.reference_block is None
            print("✓ BlockReference.reference_block is None (broken reference)")

            print("\n✅ All SET NULL behavior tests passed!")
            print("   - Target block deleted")
            print("   - Reference block preserved")
            print("   - BlockReference preserved with NULL reference_block_id")

        finally:
            # Cleanup
            await session.delete(project)
            await session.commit()
