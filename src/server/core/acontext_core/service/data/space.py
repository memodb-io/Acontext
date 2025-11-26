from typing import List, Optional
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from ...schema.orm import ExperienceConfirmation
from ...schema.result import Result
from ...schema.utils import asUUID


async def set_experience_confirmation(
    db_session: AsyncSession,
    space_id: asUUID,
    experience_data: dict,
    task_id: Optional[asUUID] = None,
) -> Result[ExperienceConfirmation]:
    """
    Create a new experience confirmation for a space.

    Args:
        db_session: Database session
        space_id: UUID of the space
        experience_data: Dictionary containing experience data
        task_id: Optional UUID of the task (for SOP confirmations)

    Returns:
        Result containing the created ExperienceConfirmation
    """
    try:
        experience_confirmation = ExperienceConfirmation(
            space_id=space_id,
            experience_data=experience_data,
            task_id=task_id,
        )

        db_session.add(experience_confirmation)
        await db_session.flush()
        return Result.resolve(experience_confirmation)
    except Exception as e:
        return Result.reject(f"Failed to create experience confirmation: {e}")


async def remove_experience_confirmation(
    db_session: AsyncSession,
    experience_confirmation_id: asUUID,
) -> Result[None]:
    """
    Remove an experience confirmation by ID.

    Args:
        db_session: Database session
        experience_confirmation_id: UUID of the experience confirmation to remove

    Returns:
        Result indicating success or failure
    """
    try:
        # Check if the experience confirmation exists
        query = select(ExperienceConfirmation).where(
            ExperienceConfirmation.id == experience_confirmation_id
        )
        result = await db_session.execute(query)
        experience_confirmation = result.scalars().first()

        if experience_confirmation is None:
            return Result.reject(
                f"Experience confirmation {experience_confirmation_id} not found"
            )

        # Delete the experience confirmation
        await db_session.execute(
            delete(ExperienceConfirmation).where(
                ExperienceConfirmation.id == experience_confirmation_id
            )
        )
        await db_session.flush()
        return Result.resolve(None)
    except Exception as e:
        return Result.reject(f"Failed to remove experience confirmation: {e}")


async def list_experience_confirmations(
    db_session: AsyncSession,
    space_id: asUUID,
    limit: int = 20,
    offset: int = 0,
) -> Result[List[ExperienceConfirmation]]:
    """
    List experience confirmations for a space with pagination.

    Args:
        db_session: Database session
        space_id: UUID of the space
        limit: Maximum number of results to return (default: 20)
        offset: Number of results to skip (default: 0)

    Returns:
        Result containing a list of ExperienceConfirmation objects, ordered by created_at descending
    """
    try:
        query = (
            select(ExperienceConfirmation)
            .where(ExperienceConfirmation.space_id == space_id)
            .order_by(ExperienceConfirmation.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await db_session.execute(query)
        confirmations = list(result.scalars().all())
        return Result.resolve(confirmations)
    except Exception as e:
        return Result.reject(f"Failed to list experience confirmations: {e}")
