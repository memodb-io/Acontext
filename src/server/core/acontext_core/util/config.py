import os
from ..schema.config import (
    filter_value_from_env,
    filter_value_from_yaml,
    CoreConfig,
    ProjectConfig,
)


def get_local_core_config() -> CoreConfig:
    CONFIG_FILE_PATH = os.getenv("CONFIG_FILE_PATH", "config.yaml")

    if not os.path.isfile(CONFIG_FILE_PATH):
        CONFIG_YAML_STRING = ""
        print(f"No config file found in {CONFIG_FILE_PATH}")
    else:
        with open(CONFIG_FILE_PATH) as f:
            CONFIG_YAML_STRING = f.read()

    _ENV_VARS = filter_value_from_env(CoreConfig)
    _YAML_VARS = filter_value_from_yaml(CONFIG_YAML_STRING, CoreConfig)

    VARS = {**_ENV_VARS, **_YAML_VARS}
    return CoreConfig(**VARS)


def get_local_project_config() -> ProjectConfig:
    CONFIG_FILE_PATH = os.getenv("CONFIG_FILE_PATH", "config.yaml")

    if not os.path.isfile(CONFIG_FILE_PATH):
        CONFIG_YAML_STRING = ""
        print(f"No config file found in {CONFIG_FILE_PATH}")
    else:
        with open(CONFIG_FILE_PATH) as f:
            CONFIG_YAML_STRING = f.read()

    _ENV_VARS = filter_value_from_env(ProjectConfig)
    _YAML_VARS = filter_value_from_yaml(CONFIG_YAML_STRING, ProjectConfig)

    VARS = {**_ENV_VARS, **_YAML_VARS}
    return ProjectConfig(**VARS)
