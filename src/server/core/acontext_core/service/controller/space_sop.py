from ..data import message as MD
from ..data import task as TD
from ...infra.db import DB_CLIENT
from ...schema.session.task import TaskStatus
from ...schema.session.message import MessageBlob
from ...schema.utils import asUUID
from ...llm.agent import space_construct as SC
from ...schema.result import ResultError
from ...env import LOG, DEFAULT_CORE_CONFIG
from ...schema.config import ProjectConfig
from ...schema.session.task import TaskSchema


async def process_sop_complete(
    project_config: ProjectConfig,
    project_id: asUUID,
    space_id: asUUID,
    task_id: asUUID,
    sop_data: dict,
):
    """
    Process SOP completion and trigger construct agent
    """
    LOG.info(f"Processing SOP completion for task {task_id}")

    # Call construct agent
    construct_result = await SC.construct_agent_curd(
        project_id,
        space_id,
        task_id,
        sop_data,
        max_iterations=project_config.default_sop_agent_max_iterations,
    )

    if construct_result.ok():
        result_data, _ = construct_result.unpack()
        LOG.info(f"Construct agent completed successfully: {result_data}")
    else:
        LOG.error(f"Construct agent failed: {construct_result}")

    return construct_result
