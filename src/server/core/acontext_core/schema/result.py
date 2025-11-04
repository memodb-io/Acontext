from pydantic import BaseModel, ConfigDict
from typing import Generic, TypeVar, Type, Optional, Union
from .error_code import Code
from ..env import LOG

T = TypeVar("T")


class ResultError(Exception):
    pass


class Error(BaseModel):
    status: Code = Code.SUCCESS
    errmsg: str = ""

    @classmethod
    def init(cls, status: Code, errmsg: str) -> "Error":
        return cls(status=status, errmsg=errmsg)

    def __str__(self) -> str:
        return f"Error(status={self.status}, errmsg={self.errmsg})"


class Result(BaseModel, Generic[T]):
    data: Optional[T]
    error: Error

    @classmethod
    def resolve(cls, data: T) -> "Result[T]":
        return cls(data=data, error=Error())

    @classmethod
    def reject(cls, errmsg: str, status: Code = Code.INTERNAL_ERROR) -> "Result[T]":
        assert status != Code.SUCCESS, "status must not be SUCCESS"
        LOG.error(f"[{status}]: {errmsg}")
        return cls(data=None, error=Error.init(status, errmsg))

    def unpack(self) -> Union[tuple[T, None], tuple[None, Error]]:
        if self.error.status != Code.SUCCESS:
            return None, self.error
        return self.data, None

    def ok(self) -> bool:
        if self.error.status != Code.SUCCESS:
            return False
        return True

    def raise_error(self):
        if self.error.status != Code.SUCCESS:
            raise ResultError(str(self.error))
