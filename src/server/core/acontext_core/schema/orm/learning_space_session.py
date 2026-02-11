from dataclasses import dataclass, field
from sqlalchemy import Column, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from .base import ORM_BASE, CommonMixin
from ..utils import asUUID


@ORM_BASE.mapped
@dataclass
class LearningSpaceSession(CommonMixin):
    """Junction table linking learning spaces to sessions with learning status.

    Uses CommonMixin for id, created_at, updated_at (tracks status transitions).
    """

    __tablename__ = "learning_space_sessions"

    __table_args__ = (
        UniqueConstraint("session_id", name="uq_learning_space_session_session_id"),
    )

    learning_space_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("learning_spaces.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            )
        }
    )

    session_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("sessions.id", ondelete="CASCADE"),
                nullable=False,
            )
        }
    )

    status: str = field(
        default="pending",
        metadata={
            "db": Column(Text, nullable=False, default="pending", server_default="pending")
        },
    )
