import os
import yaml
from pydantic import BaseModel
from typing import Literal, Mapping, Optional, Any, Type


class ProjectConfig(BaseModel):
    project_session_message_use_previous_messages_turns: int = 3
    project_session_message_buffer_max_turns: int = 16
    project_session_message_buffer_max_overflow: int = 16
    project_session_message_buffer_ttl_seconds: int = 8  # 4 seconds
    default_task_agent_max_iterations: int = 6
    default_task_agent_previous_progress_num: int = 6


class CoreConfig(BaseModel):
    llm_api_key: str
    llm_base_url: Optional[str] = None
    llm_openai_default_query: Optional[Mapping[str, Any]] = None
    llm_openai_default_header: Optional[Mapping[str, Any]] = None
    llm_openai_completion_kwargs: Mapping[str, Any] = {}
    llm_response_timeout: float = 60
    llm_sdk: Literal["openai", "anthropic", "mock"] = "openai"

    llm_simple_model: str = "gpt-4.1"

    # Core Configuration
    logging_format: str = "text"
    logging_level: str = "INFO"
    session_message_session_lock_wait_seconds: int = 1
    session_message_processing_timeout_seconds: int = 60
    session_message_flush_max_retries: int = 60
    skill_learn_agent_max_iterations: int = 24
    skill_learn_lock_ttl_seconds: int = (
        240  # 4 min — agent phase only (5 iters × ~40s + 20% headroom)
    )
    skill_learn_agent_retry_delay_seconds: int = (
        16  # retry delay on lock contention (240s TTL / 16s ≈ 15 retries worst-case)
    )

    # MQ Configuration
    mq_url: str = "amqp://acontext:helloworld@127.0.0.1:15672/"
    mq_connection_name: str = "acontext_core"
    mq_heartbeat: int = (
        60  # Heartbeat interval in seconds (should match or be less than RabbitMQ server timeout)
    )
    mq_blocked_connection_timeout: int = (
        300  # Timeout for blocked connections in seconds
    )
    mq_max_reconnect_attempts: int = 5
    mq_reconnect_delay: float = 5.0
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

    # otel
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"
    otel_enabled: bool = True
    otel_sample_ratio: float = 1.0
    otel_service_name: str = "acontext-core"
    otel_service_version: str = "0.0.1"

    # sandbox
    sandbox_type: Literal[
        "disabled", "novita", "e2b", "cloudflare", "aws_agentcore"
    ] = "disabled"
    novita_api_key: Optional[str] = None
    e2b_domain_base_url: Optional[str] = None
    e2b_api_key: Optional[str] = None
    cloudflare_worker_url: Optional[str] = (
        None  # Worker URL, default: http://localhost:8787 for local dev
    )
    cloudflare_worker_auth_token: Optional[str] = (
        None  # Optional authentication token for Worker API
    )
    aws_agentcore_region: Optional[str] = None
    # If explicitly provided, the AgentCore backend will use these static credentials.
    # If omitted, boto3 will use the default credential chain, see https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials
    aws_agentcore_access_key: Optional[str] = None
    aws_agentcore_secret_key: Optional[str] = None
    sandbox_default_cpu_count: float = 1
    sandbox_default_memory_mb: int = 512
    sandbox_default_disk_gb: int = 10
    sandbox_default_keepalive_seconds: int = 60 * 10
    sandbox_default_template: Optional[str] = None


def filter_value_from_env(CLS: Type[BaseModel]) -> dict[str, Any]:
    config_keys = CLS.model_fields.keys()
    env_already_keys = {}
    for key in config_keys:
        value = os.getenv(key, os.getenv(key.upper(), None))
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


def post_validate_core_config_sanity(config: CoreConfig) -> None:
    """Raises an assertion error if the config is invalid."""
    if config.sandbox_type == "e2b":
        assert (
            config.e2b_api_key is not None
        ), "e2b_api_key is required when sandbox_type is e2b"
        assert (
            config.sandbox_default_template is not None
        ), "e2b_default_template is required when sandbox_type is e2b"

    if config.sandbox_type == "novita":
        assert (
            config.novita_api_key is not None
        ), "novita_api_key is required when sandbox_type is novita"
        assert (
            config.sandbox_default_template is not None
        ), "sandbox_default_template is required when sandbox_type is novita"

    if config.sandbox_type == "cloudflare":
        assert (
            config.cloudflare_worker_url is not None
        ), "cloudflare_worker_url is required when sandbox_type is cloudflare"
    if config.sandbox_type == "aws_agentcore":
        assert (
            config.aws_agentcore_region is not None
        ), "aws_agentcore_region is required when sandbox_type is aws_agentcore"
