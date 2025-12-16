from ...schema.block.sop_block import SOPData
from ...schema.utils import asUUID
from ...schema.result import Result
from ...llm.agent import space_construct as SC
from ...env import LOG
from ...schema.config import ProjectConfig
from ...telemetry.get_metrics import get_metrics
from ...constants import ExcessMetricTags


async def process_sop_complete_batch(
    project_config: ProjectConfig,
    project_id: asUUID,
    space_id: asUUID,
    task_ids: list[asUUID],
    sop_datas: list[SOPData],
) -> Result[None]:
    """
    Process SOP completions and trigger construct agent.
    """
    disabled = await get_metrics(project_id, ExcessMetricTags.new_skill_learned)
    if disabled:
        LOG.warning(f"Project {project_id} has disabled new skill learned, skip")
        return Result.resolve(None)

    construct_result = await SC.space_construct_agent_curd(
        project_id,
        space_id,
        task_ids,
        sop_datas,
        max_iterations=project_config.default_space_construct_agent_max_iterations,
    )

    if construct_result.ok():
        result_data, _ = construct_result.unpack()
        LOG.info(f"Construct agent completed successfully: {result_data}")
    else:
        LOG.error(f"Construct agent failed: {construct_result}")

    return construct_result


async def process_sop_complete(
    project_config: ProjectConfig,
    project_id: asUUID,
    space_id: asUUID,
    task_id: asUUID,
    sop_data: SOPData,
) -> Result[None]:
    """
    Process SOP completion and trigger construct agent
    """
    LOG.info(f"Processing SOP completion for task {task_id}")
    return await process_sop_complete_batch(
        project_config,
        project_id,
        space_id,
        [task_id],
        [sop_data],
    )
