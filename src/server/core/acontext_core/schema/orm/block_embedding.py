import numpy as np
from dataclasses import dataclass, field
from sqlalchemy import String, ForeignKey, Index, Column, Integer, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from typing import TYPE_CHECKING, Optional, List, Type

from ...env import DEFAULT_CORE_CONFIG, LOG
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID

if TYPE_CHECKING:
    from .block import Block
    from .space import Space


@ORM_BASE.mapped
@dataclass
class BlockEmbedding(CommonMixin):
    """
    Embedding table for blocks using pgvector.
    Each block can have multiple embeddings (one-to-many relationship).
    """

    __tablename__ = "block_embeddings"

    __table_args__ = (
        # Indexes for efficient queries
        Index("idx_block_embeddings_space", "space_id"),
        Index("idx_block_embeddings_space_type", "space_id", "block_type"),
        # Vector similarity search index (using IVFFlat or HNSW)
        # You can add this via migration: CREATE INDEX ON block_embeddings USING ivfflat (embedding vector_cosine_ops);
    )

    block_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("blocks.id", ondelete="CASCADE", onupdate="CASCADE"),
                nullable=False,
            )
        }
    )

    space_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("spaces.id", ondelete="CASCADE", onupdate="CASCADE"),
                nullable=False,
            )
        }
    )

    block_type: str = field(
        metadata={
            "db": Column(
                String,
                nullable=False,
            )
        }
    )

    # Vector embedding - adjust dimensions as needed (e.g., 1536 for OpenAI, 768 for others)
    embedding: np.ndarray = field(
        metadata={
            "db": Column(
                Vector(
                    DEFAULT_CORE_CONFIG.block_embedding_dim
                ),  # Change dimension as needed
                nullable=False,
            )
        }
    )

    # Optional: store metadata about the embedding (model used, chunk info, etc.)
    configs: Optional[dict] = field(
        default=None,
        metadata={
            "db": Column(
                "configs",  # Use "metadata" as column name in DB
                JSONB,  # Or use JSONB if you want structured data
                nullable=True,
            )
        },
    )

    # Relationships
    block: "Block" = field(
        init=False,
        metadata={
            "db": relationship(
                "Block",
                back_populates="embeddings",
            )
        },
    )

    space: "Space" = field(
        init=False,
        metadata={
            "db": relationship(
                "Space",
                back_populates="block_embeddings",
            )
        },
    )


async def check_legal_embedding_dim(
    cls: Type[BlockEmbedding], session: AsyncSession, embedding_dim
):
    try:
        # Use table_name from the ORM class to avoid hardcoding
        table_name = cls.__tablename__

        # Use text() to properly declare SQL expression
        sql = text(
            """
        SELECT atttypmod
        FROM pg_attribute
        JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
        JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
        WHERE pg_class.relname = :table_name
        AND pg_attribute.attname = 'embedding'
        AND pg_namespace.nspname = current_schema();
        """
        )

        result = (await session.execute(sql, {"table_name": table_name})).scalar()

        # Table or column might not exist yet
        if result is None:
            raise ValueError(
                "`embedding` column does not exist in the table, please check the table schema"
            )

        # In pgvector, atttypmod - 8 is the dimension
        actual_dim = result

        if actual_dim != embedding_dim:
            raise ValueError(
                f"Configuration embedding dimension ({embedding_dim}) "
                f"does not match database dimension ({actual_dim}). "
                f"This may cause errors when inserting embeddings."
            )
        LOG.info(
            f"Configuration embedding dimension ({embedding_dim}) "
            f"matches database dimension ({actual_dim}). "
        )
        return actual_dim

    except Exception as e:
        LOG.warning(f"Failed to check embedding dimension: {str(e)}")
        raise e
