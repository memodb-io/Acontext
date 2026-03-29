from enum import StrEnum


class LearningSessionStatus(StrEnum):
    """Status values for LearningSpaceSession records.

    Lifecycle: pending → distilling → queued → skill_writing → completed
                                  ↘ failed
    """

    PENDING = "pending"
    DISTILLING = "distilling"
    QUEUED = "queued"
    SKILL_WRITING = "skill_writing"
    COMPLETED = "completed"
    FAILED = "failed"
