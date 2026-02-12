from pydantic import BaseModel
from ..utils import asUUID


class InsertNewMessage(BaseModel):
    project_id: asUUID
    session_id: asUUID
    message_id: asUUID
    skip_latest_check: bool = False
