import os
import yaml
from pydantic import BaseModel, Field
from typing import Literal, Mapping, Optional, Any, Type


class ProjectConfig(BaseModel):
    project_session_message_use_previous_messages_turns: int = 3
    project_session_message_buffer_max_turns: int = 32
    project_session_message_buffer_max_overflow: int = 16
    project_session_message_buffer_ttl_seconds: int = 60  # 1 minutes
    default_task_agent_max_iterations: int = 4
    default_sop_agent_max_iterations: int = 4


class CoreConfig(BaseModel):
    llm_api_key: str
    llm_base_url: Optional[str] = None
    llm_openai_default_query: Optional[Mapping[str, Any]] = None
    llm_openai_default_header: Optional[Mapping[str, Any]] = None
    llm_openai_completion_kwargs: Mapping[str, Any] = {}
    llm_response_timeout: float = 60
    llm_sdk: Literal["openai", "anthropic"] = "openai"

    llm_simple_model: str = "gpt-4.1"

    block_embedding_provider: Literal["openai", "jina"] = "openai"
    block_embedding_model: str = "text-embedding-3-small"
    block_embedding_dim: int = 1536
    block_embedding_api_key: Optional[str] = None
    block_embedding_base_url: Optional[str] = None
    block_embedding_search_cosine_distance_threshold: float = 0.5

    # Core Configuration
    logging_format: str = "text"
    session_message_session_lock_wait_seconds: int = 1
    session_message_processing_timeout_seconds: int = 60
    space_task_sop_lock_wait_seconds: int = 1

    # MQ Configuration
    mq_url: str = "amqp://acontext:helloworld@127.0.0.1:15672/"
    mq_connection_name: str = "acontext_core"
    mq_global_qos: int = 32
    mq_consumer_handler_timeout: float = 96
    mq_default_message_ttl_seconds: int = 7 * 24 * 60 * 60
    mq_default_dlx_ttl_days: int = 7
    mq_default_max_retries: int = 1
    mq_default_retry_delay_unit_sec: float = 1.0

    # Database Configuration
    database_pool_size: int = 64
    database_url: str = "postgresql://acontext:helloworld@127.0.0.1:15432/acontext"

    # Redis Configuration
    redis_pool_size: int = 32
    redis_url: str = "redis://:helloworld@127.0.0.1:16379"

    # S3 Configuration (MinIO defaults based on docker-compose)
    s3_endpoint: str = "http://127.0.0.1:19000"  # MinIO API endpoint
    s3_region: str = "auto"  # MinIO region (can be any value)
    s3_access_key: str = "acontext"  # Default MinIO root user
    s3_secret_key: str = "helloworld"  # Default MinIO root password
    s3_bucket: str = "acontext-assets"  # Default bucket name
    s3_use_path_style: bool = True  # Required for MinIO
    s3_max_pool_connections: int = 32
    s3_connection_timeout: float = 60.0
    s3_read_timeout: float = 60.0


def filter_value_from_env(CLS: Type[BaseModel]) -> dict[str, Any]:
    config_keys = CLS.model_fields.keys()
    env_already_keys = {}
    for key in config_keys:
        value = os.getenv(key.upper(), None)
        if value is None:
            continue
        env_already_keys[key] = value
    return env_already_keys


def filter_value_from_yaml(yaml_string, CLS: Type[BaseModel]) -> dict[str, Any]:
    yaml_config_data: dict | None = yaml.safe_load(yaml_string)
    if yaml_config_data is None:
        return {}

    yaml_already_keys = {}
    config_keys = CLS.model_fields.keys()
    for key in config_keys:
        value = yaml_config_data.get(key, None)
        if value is None:
            continue
        yaml_already_keys[key] = value
    return yaml_already_keys


def filter_value_from_json(
    json_config_data: dict, CLS: Type[BaseModel]
) -> dict[str, Any]:

    json_already_keys = {}
    config_keys = CLS.model_fields.keys()
    for key in config_keys:
        value = json_config_data.get(key, None)
        if value is None:
            continue
        json_already_keys[key] = value
    return json_already_keys


def post_validate_core_config_sanity(config: CoreConfig):
    # TODO: add cross-params validation
    pass
