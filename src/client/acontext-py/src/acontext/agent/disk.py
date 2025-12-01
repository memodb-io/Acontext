from dataclasses import dataclass

from .base import BaseContext, BaseTool, BaseToolPool
from ..client import AcontextClient


@dataclass
class DiskContext(BaseContext):
    client: AcontextClient
    disk_id: str
