"""Type definitions for project configuration."""

from typing import Any

from pydantic import BaseModel, Field


class ProjectConfig(BaseModel, extra="allow"):
    """Project-level configuration model.

    Known fields are typed explicitly. Additional fields from the API
    are captured via ``extra="allow"`` and accessible as normal attributes
    or via ``model_extra``.
    """

    task_success_criteria: str | None = Field(
        None, description="Criteria for determining task success"
    )
    task_failure_criteria: str | None = Field(
        None, description="Criteria for determining task failure"
    )
