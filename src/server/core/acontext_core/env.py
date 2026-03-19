from dotenv import load_dotenv
from .telemetry.log import get_logger
from .util.config import get_local_core_config, get_local_project_config


load_dotenv()


DEFAULT_CORE_CONFIG = get_local_core_config()
DEFAULT_PROJECT_CONFIG = get_local_project_config()

LOG = get_logger(DEFAULT_CORE_CONFIG.logging_format, DEFAULT_CORE_CONFIG.logging_level)

_SENSITIVE_KEYS = {
    "llm_api_key", "mq_url", "database_url", "redis_url",
    "s3_secret_key", "s3_access_key", "novita_api_key", "e2b_api_key",
    "cloudflare_worker_auth_token", "aws_agentcore_secret_key",
    "aws_agentcore_access_key", "encryption_master_key",
}


def _safe_config_dict(config) -> dict:
    d = config.model_dump() if hasattr(config, "model_dump") else {}
    return {k: ("***" if k in _SENSITIVE_KEYS else v) for k, v in d.items()}

LOG.info(
    "config.loaded",
    core_config=_safe_config_dict(DEFAULT_CORE_CONFIG),
    project_config=_safe_config_dict(DEFAULT_PROJECT_CONFIG),
)
