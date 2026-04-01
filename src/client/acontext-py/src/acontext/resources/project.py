"""
Project configuration endpoints.
"""

from typing import Any

from ..client_types import RequesterProtocol
from ..types.project import ProjectConfig


class ProjectAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def get_configs(self) -> ProjectConfig:
        """Get the project-level configuration.

        Returns:
            ProjectConfig containing the current project configuration.
        """
        data = self._requester.request("GET", "/project/configs")
        if isinstance(data, dict):
            return ProjectConfig.model_validate(data)
        return ProjectConfig()

    def update_configs(self, configs: dict[str, Any]) -> ProjectConfig:
        """Update the project-level configuration by merging keys.
        Keys with None/null values are deleted (reset to default).

        Args:
            configs: Dictionary of configuration keys to merge.

        Returns:
            ProjectConfig containing the updated project configuration.
        """
        data = self._requester.request(
            "PATCH", "/project/configs", json_data=configs
        )
        if isinstance(data, dict):
            return ProjectConfig.model_validate(data)
        return ProjectConfig()
