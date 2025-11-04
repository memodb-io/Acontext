"""
Quick script to check the foreign key constraint configuration
"""

import asyncio
from sqlalchemy import text
from acontext_core.infra.db import DatabaseClient


async def check_constraint():
    db_client = DatabaseClient()

    async with db_client.get_session_context() as session:
        # Check the foreign key constraint
        result = await session.execute(
            text(
                """
            SELECT 
                conname, 
                confdeltype,
                CASE confdeltype
                    WHEN 'a' THEN 'NO ACTION'
                    WHEN 'r' THEN 'RESTRICT'
                    WHEN 'c' THEN 'CASCADE'
                    WHEN 'n' THEN 'SET NULL'
                    WHEN 'd' THEN 'SET DEFAULT'
                    ELSE 'UNKNOWN'
                END as delete_action
            FROM pg_constraint 
            WHERE conname LIKE '%block_reference%'
            ORDER BY conname
        """
            )
        )

        print("\nForeign Key Constraints on block_references table:")
        print("-" * 80)
        for row in result:
            print(f"  {row[0]}: {row[2]} (code: {row[1]})")

        # Check the table structure
        result2 = await session.execute(
            text(
                """
            SELECT 
                column_name, 
                data_type, 
                is_nullable
            FROM information_schema.columns
            WHERE table_name = 'block_references'
            ORDER BY ordinal_position
        """
            )
        )

        print("\nblock_references table structure:")
        print("-" * 80)
        for row in result2:
            print(f"  {row[0]}: {row[1]} (nullable: {row[2]})")


if __name__ == "__main__":
    asyncio.run(check_constraint())
