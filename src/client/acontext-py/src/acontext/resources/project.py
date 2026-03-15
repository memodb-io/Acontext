"""
Project configuration endpoints.
"""

from typing import Any

from ..client_types import RequesterProtocol


class ProjectAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def get_configs(self) -> dict[str, Any]:
        """Get the project-level configuration.

        Returns:
            Dictionary containing the current project configuration.
        """
        data = self._requester.request("GET", "/project/configs")
        return data if isinstance(data, dict) else {}

    def update_configs(self, configs: dict[str, Any]) -> dict[str, Any]:
        """Update the project-level configuration by merging keys.
        Keys with None/null values are deleted (reset to default).

        Args:
            configs: Dictionary of configuration keys to merge.

        Returns:
            Dictionary containing the updated project configuration.
        """
        data = self._requester.request(
            "PATCH", "/project/configs", json_data=configs
        )
        return data if isinstance(data, dict) else {}
