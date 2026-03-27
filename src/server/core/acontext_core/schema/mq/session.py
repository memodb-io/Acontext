from pydantic import BaseModel
from ..utils import asUUID


class InsertNewMessage(BaseModel):
    project_id: asUUID
    session_id: asUUID
    message_id: asUUID  # inserted message used as the processing key
    process_rightnow: bool = False
    lock_retry_count: int = 0
