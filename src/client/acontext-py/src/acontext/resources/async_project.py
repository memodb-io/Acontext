"""
Project configuration endpoints (async).
"""

from typing import Any

from ..client_types import AsyncRequesterProtocol
from ..types.project import ProjectConfig


class AsyncProjectAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def get_configs(self) -> ProjectConfig:
        """Get the project-level configuration.

        Returns:
            ProjectConfig containing the current project configuration.
        """
        data = await self._requester.request("GET", "/project/configs")
        if isinstance(data, dict):
            return ProjectConfig.model_validate(data)
        return ProjectConfig()

    async def update_configs(self, configs: dict[str, Any]) -> ProjectConfig:
        """Update the project-level configuration by merging keys.
        Keys with None/null values are deleted (reset to default).

        Args:
            configs: Dictionary of configuration keys to merge.

        Returns:
            ProjectConfig containing the updated project configuration.
        """
        data = await self._requester.request(
            "PATCH", "/project/configs", json_data=configs
        )
        if isinstance(data, dict):
            return ProjectConfig.model_validate(data)
        return ProjectConfig()
