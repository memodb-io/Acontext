from dataclasses import dataclass, field
from sqlalchemy import String, Index, Column
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from typing import TYPE_CHECKING, List, Optional
from .base import ORM_BASE, CommonMixin

if TYPE_CHECKING:
    from .space import Space
    from .session import Session
    from .task import Task
    from .tool_reference import ToolReference
    from .metric import Metric
    from .sandbox_log import SandboxLog


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
    spaces: List["Space"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "Space", back_populates="project", cascade="all, delete-orphan"
            )
        },
    )

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

    tool_references: List["ToolReference"] = field(
        default_factory=list,
        metadata={
            "db": relationship(
                "ToolReference", back_populates="project", cascade="all, delete-orphan"
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
