from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Tuple, cast

from ...schema.orm import Block, BlockEmbedding
from ...schema.orm.block import PATH_BLOCK, CONTENT_BLOCK
from ...schema.utils import asUUID
from ...schema.result import Result
from ...llm.embeddings import get_embedding
from ...env import LOG


async def search_blocks(
    db_session: AsyncSession,
    space_id: asUUID,
    query_text: str,
    block_types: list[str],
    topk: int = 10,
    threshold: float = 0.5,
    fetch_ratio: float = 1.5,
):
    """
    Search for page and folder blocks using semantic vector similarity.

    Uses cosine distance on block embeddings with Python-side deduplication
    for optimal performance when blocks have multiple embeddings.

    Args:
        db_session: Database session
        space_id: Space to search within
        query_text: Search query text to embed and match against
        topk: Maximum number of unique blocks to return (default: 10)
        threshold: Maximum cosine distance threshold for matches (default: 1.0)
                  Range: 0.0 (identical) to 2.0 (opposite)
                  Typical good matches: 0.3-0.8

    Returns:
        Result containing list of (Block, distance) tuples sorted by similarity.
        Blocks are deduplicated - only the best match per block is returned.
        Lower distance = more similar.

    Example:
        >>> r = await search_path_blocks(
        ...     db_session=session,
        ...     space_id=space_uuid,
        ...     query_text="machine learning",
        ...     topk=5,
        ...     threshold=0.7
        ... )
        >>> if r.ok():
        ...     for block, distance in r.data:
        ...         print(f"{block.title}: {distance:.4f}")
    """
    # Generate query embedding
    r = await get_embedding([query_text], phase="query")
    if not r.ok():
        return r
    query_embedding = r.data.embedding[0]

    # Calculate distance using pgvector's cosine distance method
    # This uses the <=> operator for cosine distance in PostgreSQL
    distance = BlockEmbedding.embedding.cosine_distance(query_embedding).label(
        "distance"
    )

    # Fetch more than needed to account for blocks with multiple embeddings
    # Conservative estimate: 3x to ensure we get enough unique blocks
    fetch_limit = int(topk * fetch_ratio)

    # Build query - simple join without grouping for best performance
    query = (
        select(Block, distance)
        .join(BlockEmbedding, Block.id == BlockEmbedding.block_id)
        .where(
            Block.space_id == space_id,
            Block.type.in_(block_types),  # Only page and folder blocks
            Block.is_archived == False,  # Exclude archived blocks
            distance <= threshold,  # Apply distance threshold
        )
        .order_by(distance.asc())  # Best matches first
        .limit(fetch_limit)
    )

    # Execute query
    try:
        result = await db_session.execute(query)
        rows = result.all()

        # Deduplicate in Python: keep best (lowest distance) match per block
        # Since results are ordered by distance ASC, first occurrence is best
        seen: dict[asUUID, Tuple[Block, float]] = {}
        for row in rows:
            block, distance = cast(
                Tuple[Block, float], row
            )  # Unpack tuple: (Block, distance)
            if block.id in seen:
                continue
            seen[block.id] = (block, float(distance))

        # Get top-K unique blocks (already sorted by distance)
        results = list(seen.values())[:topk]

        LOG.info(
            f"Search '{query_text[:50]}...' found {len(results)} unique blocks "
            f"(from {len(rows)} total embeddings)"
        )
        return Result.resolve(results)

    except Exception as e:
        LOG.error(f"Error in search_path_blocks: {e}")
        return Result.reject(f"Vector search failed: {str(e)}")


async def search_path_blocks(
    db_session: AsyncSession,
    space_id: asUUID,
    query_text: str,
    topk: int = 10,
    threshold: float = 0.5,
    fetch_ratio: float = 1.5,
) -> Result[List[Tuple[Block, float]]]:
    return await search_blocks(
        db_session, space_id, query_text, list(PATH_BLOCK), topk, threshold, fetch_ratio
    )


async def search_content_blocks(
    db_session: AsyncSession,
    space_id: asUUID,
    query_text: str,
    topk: int = 10,
    threshold: float = 0.5,
    fetch_ratio: float = 1.5,
) -> Result[List[Tuple[Block, float]]]:
    return await search_blocks(
        db_session,
        space_id,
        query_text,
        list(CONTENT_BLOCK),
        topk,
        threshold,
        fetch_ratio,
    )
