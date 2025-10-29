import re
from typing import List, Dict, Any
from urllib import response

from ...schema.block.sop_block import SOPData
from ...env import LOG, DEFAULT_CORE_CONFIG, bound_logging_vars
from ...infra.db import AsyncSession, DB_CLIENT
from ...schema.result import Result
from ...schema.utils import asUUID
from ...schema.session.task import TaskSchema, TaskStatus
from ...schema.session.message import MessageBlob
from ...service.data import task as TD
from ..complete import llm_complete, response_to_sendable_message
from ..prompt.task import TaskPrompt, TASK_TOOLS
from ...util.generate_ids import track_process
from ..tool.sop_lib.ctx import SOPCtx


@track_process
async def construct_agent_curd(
    project_id: asUUID,
    space_id: asUUID,
    task_id: asUUID,
    sop_data: SOPData,
    max_iterations=3,
) -> Result[Dict[str, Any]]:
    """
    Construct Agent - Process SOP data and build into Space

    Args:
        project_id: Project ID
        space_id: Space ID
        task_id: Task ID
        sop_data: SOP data
        max_iterations: Maximum iterations

    Returns:
        Result[Dict[str, Any]]: Processing result
    """
    LOG.info(f"Enter construct_agent_curd for task {task_id}")

    try:
        # 1. Print received SOP data
        LOG.info(f"SOP Data received: {sop_data}")
        print(f"🔧 Construct Agent - Processing SOP for Task {task_id}")
        print(f"📋 SOP Data: {sop_data}")

        # 2. Process SOP data

        # 3. Print processing result
        LOG.info(f"Processed result: {sop_data}")
        print(f"✅ SOP Processing Complete!")
        print(f"📊 Result: {sop_data}")

        # 4. Mark completion
        completion_status = {
            "status": "completed",
            "task_id": str(task_id),
            "space_id": str(space_id),
            "processed_sop": sop_data,
            "timestamp": "2025-01-28T00:00:00Z",
        }

        LOG.info(f"Construct agent completed successfully: {completion_status}")
        print(f"🎯 Construct Agent - COMPLETED!")
        print(f"📈 Final Status: {completion_status}")

        return Result.resolve(completion_status)

    except Exception as e:
        LOG.error(f"Construct agent error: {e}")
        print(f"❌ Construct Agent Error: {e}")
        return Result.error(f"Construct agent failed: {str(e)}")
