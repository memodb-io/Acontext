from pydantic import BaseModel
from typing import Generic, TypeVar, Type, Optional
from .error_code import Code
from .api.response import BasicResponse

T = TypeVar("T")
R = TypeVar("R", bound=BasicResponse)


class Promise(BaseModel, Generic[T]):
    data: Optional[T]
    status: Code
    errmsg: str

    @classmethod
    def ok(cls, data: T) -> "Promise[T]":
        return cls(data=data, status=Code.SUCCESS, errmsg="")

    @classmethod
    def error(cls, status: Code, errmsg: str) -> "Promise[T]":
        assert status != Code.SUCCESS, "status must not be SUCCESS"
        return cls(data=None, status=status, errmsg=errmsg)

    def unpack(self) -> tuple[Optional[T], Optional[BasicResponse]]:
        if self.status != Code.SUCCESS:
            return None, self
        return self.data, None

    def to_response(self, response_type: Type[R]) -> R:
        return response_type(data=self.data, status=self.status, errmsg=self.errmsg)
