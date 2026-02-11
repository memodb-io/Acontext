from dataclasses import dataclass, field
from sqlalchemy import String, Index, Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from typing import TYPE_CHECKING, List, Optional
from .base import ORM_BASE, CommonMixin

if TYPE_CHECKING:
    from .session import Session
    from .task import Task
    from .metric import Metric
    from .sandbox_log import SandboxLog
    from .agent_skill import AgentSkill
    from .disk import Disk
    from .learning_space import LearningSpace


@ORM_BASE.mapped
@dataclass
class Project(CommonMixin):
    __tablename__ = "projects"

    __table_args__ = (
        Index("ix_project_secret_key_hmac", "secret_key_hmac", unique=True),
    )

    secret_key_hmac: str = field(metadata={"db": Column(String(64), nullable=False)})
    secret_key_hash_phc: str = field(
        metadata={"db": Column(String(255), nullable=False)}
    )

    configs: Optional[dict] = field(
        default=None, metadata={"db": Column(JSONB, nullable=True)}
    )

    # Relationships
    sessions: List["Session"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Session", back_populates="project", cascade="all, delete-orphan"
            )
        },
    )

    tasks: List["Task"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Task", back_populates="project", cascade="all, delete-orphan"
            )
        },
    )

    metrics: List["Metric"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Metric", back_populates="project", cascade="all, delete-orphan"
            )
        },
    )

    sandbox_logs: List["SandboxLog"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "SandboxLog", back_populates="project", cascade="all, delete-orphan"
            )
        },
    )

<<<<<<< HEAD
    # Relationships for API-owned tables — passive_deletes, no cascade
    agent_skills: List["AgentSkill"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "AgentSkill", back_populates="project", passive_deletes=True
            )
        },
    )

    disks: List["Disk"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Disk", back_populates="project", passive_deletes=True
=======
    learning_spaces: List["LearningSpace"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "LearningSpace",
                back_populates="project",
                passive_deletes=True,
>>>>>>> 40cca70 (feat: add learning space resource)
            )
        },
    )
