from typing import Optional
from pydantic import BaseModel
from ..utils import asUUID


class InsertNewMessage(BaseModel):
    project_id: asUUID
    session_id: asUUID
    message_id: asUUID  # sent by API but unused by handler
    process_rightnow: bool = False
    lock_retry_count: int = 0
    user_kek: Optional[str] = None  # base64-encoded user KEK
