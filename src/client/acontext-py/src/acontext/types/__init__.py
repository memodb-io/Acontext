"""Type definitions for API responses."""

from .common import FileContent, FlagResponse
from .disk import (
    Artifact,
    Disk,
    DownloadToSandboxResp,
    GetArtifactResp,
    ListArtifactsResp,
    ListDisksOutput,
    UpdateArtifactResp,
)
from .session import (
    Asset,
    EditingTrigger,
    GetMessagesOutput,
    GetTasksOutput,
    ListSessionsOutput,
    Message,
    Part,
    PublicURL,
    Session,
    Task,
    TaskData,
    TokenCounts,
)
from .skill import (
    DownloadSkillResp,
    FileInfo,
    GetSkillFileResp,
    ListSkillsOutput,
    Skill,
    SkillCatalogItem,
)
from .sandbox import (
    GeneratedFile,
    GetSandboxLogsOutput,
    HistoryCommand,
    SandboxCommandOutput,
    SandboxLog,
    SandboxRuntimeInfo,
)
from .user import (
    GetUserResourcesOutput,
    ListUsersOutput,
    User,
    UserResourceCounts,
)
from .project import ProjectConfig
from .learning_space import (
    LearningSpace,
    LearningSpaceSession,
    LearningSpaceSkill,
    ListLearningSpacesOutput,
)

__all__ = [
    # Common types
    "FileContent",
    "FlagResponse",
    # Disk types
    "Artifact",
    "Disk",
    "DownloadToSandboxResp",
    "GetArtifactResp",
    "ListArtifactsResp",
    "ListDisksOutput",
    "UpdateArtifactResp",
    # Session types
    "Asset",
    "EditingTrigger",
    "GetMessagesOutput",
    "GetTasksOutput",
    "ListSessionsOutput",
    "Message",
    "Part",
    "PublicURL",
    "Session",
    "Task",
    "TaskData",
    "TokenCounts",
    # Skill types
    "DownloadSkillResp",
    "FileInfo",
    "Skill",
    "SkillCatalogItem",
    "ListSkillsOutput",
    "GetSkillFileResp",
    # Sandbox types
    "SandboxCommandOutput",
    "SandboxRuntimeInfo",
    "SandboxLog",
    "HistoryCommand",
    "GeneratedFile",
    "GetSandboxLogsOutput",
    # User types
    "GetUserResourcesOutput",
    "ListUsersOutput",
    "User",
    "UserResourceCounts",
    # Project types
    "ProjectConfig",
    # Learning space types
    "LearningSpace",
    "LearningSpaceSession",
    "LearningSpaceSkill",
    "ListLearningSpacesOutput",
]
