from pydantic import BaseModel
from typing import Optional
from ..error_code import Code


class BasicResponse(BaseModel):
    data: Optional[dict] = None
    status: Code = Code.SUCCESS
    errmsg: str = ""
