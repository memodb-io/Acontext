from enum import StrEnum


class SessionStatus(StrEnum):
    """Learning space session status enum.

    Tracks the lifecycle of a session being learned by a learning space:
    pending → distilling → (skill_writing | queued | completed | failed)
      - skill_writing → completed | failed
      - queued → distilling (re-enters via drain_skill_learn_pending)

    Sync: keep in sync with:
      - Go API:    src/server/api/go/internal/modules/model/learning_space.go (SessionStatus* consts)
      - Python SDK: src/client/acontext-py/src/acontext/types/learning_space.py (SessionStatus)
      - TS SDK:    src/client/acontext-ts/src/types/learning-space.ts (SESSION_STATUSES)
    """

    PENDING = "pending"
    DISTILLING = "distilling"
    QUEUED = "queued"
    SKILL_WRITING = "skill_writing"
    COMPLETED = "completed"
    FAILED = "failed"


TERMINAL_STATUSES = frozenset({SessionStatus.COMPLETED, SessionStatus.FAILED})
