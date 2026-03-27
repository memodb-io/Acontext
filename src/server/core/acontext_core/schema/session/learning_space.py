from enum import StrEnum


class SessionStatus(StrEnum):
    """Learning space session status enum.

    Tracks the lifecycle of a session being learned by a learning space:
    pending → distilling → (skill_writing | queued | completed | failed)
      - skill_writing → completed | failed
      - queued → distilling (re-enters via drain_skill_learn_pending)
    """

    PENDING = "pending"
    DISTILLING = "distilling"
    QUEUED = "queued"
    SKILL_WRITING = "skill_writing"
    COMPLETED = "completed"
    FAILED = "failed"


TERMINAL_STATUSES = frozenset({SessionStatus.COMPLETED, SessionStatus.FAILED})
