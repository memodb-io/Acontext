from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class DifySandboxResponse(BaseModel, Generic[T]):
    """
    Standard Dify Sandbox API response envelope.
    
    Example success response:
        {
            "code": 0,
            "message": "success",
            "data": {...}
        }
    
    Example error response:
        {
            "code": -400,
            "message": "missing required parameter: code"
        }
    """
    
    code: int
    message: str
    data: Optional[T] = None
    
    @property
    def is_success(self) -> bool:
        """Check if the response indicates success."""
        return self.code == 0
    
    @property
    def is_error(self) -> bool:
        """Check if the response indicates an error."""
        return self.code != 0


class RunCodeData(BaseModel):
    """Data model for /v1/sandbox/run response.
    
    Note: Dify Sandbox returns 'error' field when execution fails.
    """
    
    stdout: str = ""
    error: Optional[str] = None


class DependencyItem(BaseModel):
    """Single dependency item from API response."""
    
    name: str
    version: str = ""


class DependenciesData(BaseModel):
    """Data model for /v1/sandbox/dependencies response.
    
    API returns dependencies as list of dicts:
    [{"name": "package", "version": "1.0.0"}, ...]
    """
    
    dependencies: List[DependencyItem] = []


class MessageData(BaseModel):
    """Data model for operations that return a message (update/refresh dependencies)."""
    
    message: str


# Type aliases for convenience
RunCodeResponse = DifySandboxResponse[RunCodeData]
DependenciesResponse = DifySandboxResponse[DependenciesData]
MessageResponse = DifySandboxResponse[MessageData]

