import uuid
from dataclasses import dataclass, field
from datetime import datetime
from sqlalchemy import Column, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime
from .base import ORM_BASE, BaseMixin
from ..utils import asUUID


@ORM_BASE.mapped
@dataclass
class LearningSpaceSkill(BaseMixin):
    """Junction table linking learning spaces to skills.

    Does NOT use CommonMixin because this table has no updated_at column.
    Defines id and created_at manually.
    """

    __tablename__ = "learning_space_skills"

    __table_args__ = (
        UniqueConstraint("learning_space_id", "skill_id", name="idx_ls_skill_unique"),
    )

    id: asUUID = field(
        init=False,
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                primary_key=True,
                default=uuid.uuid4,
                server_default=func.gen_random_uuid(),
            )
        },
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

    skill_id: asUUID = field(
        metadata={
            "db": Column(
                UUID(as_uuid=True),
                ForeignKey("agent_skills.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            )
        }
    )

    created_at: datetime = field(
        init=False,
        metadata={
            "db": Column(
                DateTime(timezone=True), server_default=func.now(), nullable=False
            )
        },
    )
