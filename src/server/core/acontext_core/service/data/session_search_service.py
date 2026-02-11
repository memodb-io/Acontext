from typing import List
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...schema.result import Result
from ...schema.utils import asUUID
from ...llm.embeddings.openai_embedding import openai_embedding
from ...env import LOG, DEFAULT_CORE_CONFIG

async def search_sessions_by_task_query(
    db_session: AsyncSession,
    user_id: asUUID,
    project_id: asUUID,
    query: str,
    topk: int = 10,
    threshold: float = 0.8,
) -> Result[List[asUUID]]:
    """
    Search for sessions by semantic similarity of their Tasks to a query string.

    Args:
        db_session: Database session
        user_id: User ID to scope the search
        project_id: Project ID to scope the search
        query: Search query text
        topk: Maximum number of results to return
        threshold: Cosine distance threshold (lower = more similar)

    Returns:
        Result containing list of unique session_ids ordered by relevance
    """
    try:
        embedding_result = await openai_embedding(
            model=DEFAULT_CORE_CONFIG.task_embedding_model,
            texts=[query],
            phase="query",
        )
        query_embedding = embedding_result.embedding[0]

        # Perform vector similarity search using pgvector on TASKS table
        sql = text("""
            SELECT DISTINCT t.session_id, MIN(t.embedding <=> :query_embedding::vector) as distance
            FROM tasks t
            JOIN sessions s ON t.session_id = s.id
            WHERE s.user_id = :user_id
              AND s.project_id = :project_id
              AND t.embedding IS NOT NULL
              AND (t.embedding <=> :query_embedding::vector) < :threshold
            GROUP BY t.session_id
            ORDER BY distance ASC
            LIMIT :topk
        """)

        result = await db_session.execute(
            sql,
            {
                "query_embedding": str(query_embedding),
                "user_id": str(user_id),
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
