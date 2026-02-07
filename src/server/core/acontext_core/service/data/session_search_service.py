"""Session search service for semantic session search via Tasks."""

from typing import List
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...schema.result import Result
from ...schema.utils import asUUID
from ...llm.embeddings.openai_embedding import openai_embedding
from ...env import LOG


async def search_sessions_by_task_query(
    db_session: AsyncSession,
    project_id: asUUID,
    query: str,
    topk: int = 10,
    threshold: float = 0.8,
) -> Result[List[asUUID]]:
    """
    Search for sessions by semantic similarity of their Tasks to a query string.

    Args:
        db_session: Database session
        project_id: Project ID to scope the search
        query: Search query text
        topk: Maximum number of results to return
        threshold: Cosine distance threshold (lower = more similar)

    Returns:
        Result containing list of unique session_ids ordered by relevance
    """
    try:
        # Generate embedding for the query
        embedding_result = await openai_embedding(
            model="text-embedding-3-small",
            texts=[query],
            phase="query",
        )
        query_embedding = embedding_result.embedding[0].tolist()

        # Perform vector similarity search using pgvector on TASKS table
        # Using cosine distance operator <=>
        # Join with sessions table to filter by project_id
        sql = text("""
            SELECT DISTINCT t.session_id, MIN(t.embedding <=> :query_embedding) as distance
            FROM tasks t
            JOIN sessions s ON t.session_id = s.id
            WHERE s.project_id = :project_id
              AND t.embedding IS NOT NULL
              AND (t.embedding <=> :query_embedding) < :threshold
            GROUP BY t.session_id
            ORDER BY distance ASC
            LIMIT :topk
        """)

        result = await db_session.execute(
            sql,
            {
                "query_embedding": str(query_embedding),
                "project_id": str(project_id),
                "threshold": threshold,
                "topk": topk,
            },
        )

        session_ids = [row[0] for row in result.fetchall()]

        LOG.info(f"Session search (via Tasks) found {len(session_ids)} results for query: {query[:50]}...")
        return Result.resolve(session_ids)

    except Exception as e:
        LOG.error(f"Error searching sessions by task: {e}")
        return Result.reject(f"Error searching sessions: {e}")
