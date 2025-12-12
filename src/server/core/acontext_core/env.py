from dotenv import load_dotenv
from .telemetry.log import get_logger
from .util.config import get_local_core_config, get_local_project_config


load_dotenv()


DEFAULT_CORE_CONFIG = get_local_core_config()
DEFAULT_PROJECT_CONFIG = get_local_project_config()

LOG = get_logger(DEFAULT_CORE_CONFIG.logging_format)

LOG.info(f"Default Core Config: [{DEFAULT_CORE_CONFIG}]")
LOG.info(f"Default Project Config: [{DEFAULT_PROJECT_CONFIG}]")
