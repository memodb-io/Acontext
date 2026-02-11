"""Type definitions for session, message, and task resources."""

from typing import Any, Literal, NotRequired, TypedDict, Union

from pydantic import BaseModel, Field


class RemoveToolResultParams(TypedDict, total=False):
    """Parameters for the remove_tool_result edit strategy.

    Attributes:
        keep_recent_n_tool_results: Number of most recent tool results to keep with original content.
            Defaults to 3 if not specified.
        tool_result_placeholder: Custom text to replace old tool results with.
            Defaults to "Done" if not specified.
        keep_tools: List of tool names that should never have their results removed.
            Tool results from these tools are always kept regardless of keep_recent_n_tool_results.
        gt_token: Only remove tool results whose text has more than this many tokens.
            If omitted, all tool results are eligible for removal.
    """

    keep_recent_n_tool_results: NotRequired[int]
    tool_result_placeholder: NotRequired[str]
    keep_tools: NotRequired[list[str]]
    gt_token: NotRequired[int]


class RemoveToolResultStrategy(TypedDict):
    """Edit strategy to replace old tool results with placeholder text.

    Example:
        {"type": "remove_tool_result", "params": {"keep_recent_n_tool_results": 5, "tool_result_placeholder": "Cleared"}}
    """

    type: Literal["remove_tool_result"]
    params: RemoveToolResultParams


class RemoveToolCallParamsParams(TypedDict, total=False):
    """Parameters for the remove_tool_call_params edit strategy.

    Attributes:
        keep_recent_n_tool_calls: Number of most recent tool calls to keep with full parameters.
            Defaults to 3 if not specified.
        keep_tools: List of tool names that should never have their parameters removed.
            Tool calls for these tools always keep their full parameters regardless of keep_recent_n_tool_calls.
        gt_token: Only remove tool call params whose arguments have more than this many tokens.
            If omitted, all tool calls are eligible for removal.
    """

    keep_recent_n_tool_calls: NotRequired[int]
    keep_tools: NotRequired[list[str]]
    gt_token: NotRequired[int]


class RemoveToolCallParamsStrategy(TypedDict):
    """Edit strategy to remove parameters from old tool-call parts.

    Keeps the most recent N tool calls with full parameters, replacing older
    tool call arguments with empty JSON "{}". The tool call ID and name remain
    intact so tool-results can still reference them.

    Example:
        {"type": "remove_tool_call_params", "params": {"keep_recent_n_tool_calls": 5}}
    """

    type: Literal["remove_tool_call_params"]
    params: RemoveToolCallParamsParams


class TokenLimitParams(TypedDict):
    """Parameters for the token_limit edit strategy.

    Attributes:
        limit_tokens: Maximum number of tokens to keep. Required parameter.
            Messages will be removed from oldest to newest until total tokens <= limit_tokens.
            Tool-call and tool-result pairs are always removed together.
    """

    limit_tokens: int


class TokenLimitStrategy(TypedDict):
    """Edit strategy to truncate messages based on token count.

    Removes oldest messages until the total token count is within the specified limit.
    Maintains tool-call/tool-result pairing - when removing a message with tool-calls,
    the corresponding tool-result messages are also removed.

    Example:
        {"type": "token_limit", "params": {"limit_tokens": 20000}}
    """

    type: Literal["token_limit"]
    params: TokenLimitParams


class MiddleOutParams(TypedDict):
    """Parameters for the middle_out edit strategy.

    Attributes:
        token_reduce_to: Target token count to reduce the prompt to. Required parameter.
    """

    token_reduce_to: int


class MiddleOutStrategy(TypedDict):
    """Edit strategy to reduce prompt size by removing middle messages.

    Example:
        {"type": "middle_out", "params": {"token_reduce_to": 5000}}
    """

    type: Literal["middle_out"]
    params: MiddleOutParams


# Union type for all edit strategies
# When adding new strategies, add them to this Union: EditStrategy = Union[RemoveToolResultStrategy, OtherStrategy, ...]
EditStrategy = Union[
    RemoveToolResultStrategy,
    RemoveToolCallParamsStrategy,
    TokenLimitStrategy,
    MiddleOutStrategy,
]


class Asset(BaseModel):
    """Asset model representing a file asset."""

    bucket: str = Field(..., description="S3 bucket name")
    s3_key: str = Field(..., description="S3 key")
    etag: str = Field(..., description="ETag")
    sha256: str = Field(..., description="SHA256 hash")
    mime: str = Field(..., description="MIME type")
    size_b: int = Field(..., description="File size in bytes")


class Part(BaseModel):
    """Message part model representing a part of a message."""

    type: str = Field(
        ...,
        description="Part type: 'text', 'image', 'audio', 'video', 'file', 'tool-call', 'tool-result', 'data', 'thinking'",
    )
    text: str | None = Field(None, description="Text content for text parts")
    asset: Asset | None = Field(None, description="Asset information for media parts")
    filename: str | None = Field(None, description="Filename for file parts")
    meta: dict[str, Any] | None = Field(None, description="Optional metadata")


class Message(BaseModel):
    """Message model representing a message in a session."""

    id: str = Field(..., description="Message UUID")
    session_id: str = Field(..., description="Session UUID")
    parent_id: str | None = Field(None, description="Parent message UUID")
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    meta: dict[str, Any] = Field(..., description="Message metadata")
    parts: list[Part] = Field(..., description="List of message parts")
    task_id: str | None = Field(None, description="Task UUID if associated with a task")
    session_task_process_status: str = Field(
        ...,
        description="Task process status: 'success', 'failed', 'running', or 'pending'",
    )
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class Session(BaseModel):
    """Session model representing a session."""

    id: str = Field(..., description="Session UUID")
    project_id: str = Field(..., description="Project UUID")
    user_id: str | None = Field(None, description="User UUID")
    disable_task_tracking: bool = Field(
        False, description="Whether task tracking is disabled for this session"
    )
    configs: dict[str, Any] | None = Field(
        None, description="Session configuration dictionary"
    )
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class TaskData(BaseModel):
    """Task data model representing the structured data stored in a task.

    This schema matches the TaskData model in acontext_core/schema/session/task.py
    and the Go API TaskData struct.
    """

    task_description: str = Field(..., description="Description of the task")
    progresses: list[str] | None = Field(
        None, description="List of progress updates for the task"
    )
    user_preferences: list[str] | None = Field(
        None, description="List of user preferences related to the task"
    )


class Task(BaseModel):
    """Task model representing a task in a session."""

    id: str = Field(..., description="Task UUID")
    session_id: str = Field(..., description="Session UUID")
    project_id: str = Field(..., description="Project UUID")
    order: int = Field(..., description="Task order")
    data: TaskData = Field(..., description="Structured task data")
    status: str = Field(
        ...,
        description="Task status: 'success', 'failed', 'running', or 'pending'",
    )
    is_planning: bool = Field(..., description="Whether the task is in planning phase")
    created_at: str = Field(..., description="ISO 8601 formatted creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 formatted update timestamp")


class ListSessionsOutput(BaseModel):
    """Response model for listing sessions."""

    items: list[Session] = Field(..., description="List of sessions")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")


class PublicURL(BaseModel):
    """Public URL model for asset presigned URLs."""

    url: str = Field(..., description="Presigned URL")
    expire_at: str = Field(..., description="Expiration time in ISO 8601 format")


class GetMessagesOutput(BaseModel):
    """Response model for getting messages.

    Note: The items field type depends on the format parameter:
    - format="acontext": items is list[Message] (Acontext format)
    - format="openai": items is OpenAI format messages
    - format="anthropic": items is Anthropic format messages

    Since format is a runtime parameter, items uses list[Any] for flexibility.
    """

    items: list[Any] = Field(
        ...,
        description="List of messages in the requested format (Message, OpenAI format, or Anthropic format)",
    )
    ids: list[str] = Field(
        ...,
        description="List of message UUIDs corresponding to each item in the same order",
    )
    metas: list[dict[str, Any]] = Field(
        default_factory=list,
        description="List of user-provided metadata for each message (same order as items/ids)",
    )
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")
    this_time_tokens: int = Field(
        ...,
        description="Total token count of the returned messages",
    )
    public_urls: dict[str, PublicURL] | None = Field(
        None,
        description="Map of SHA256 hash to PublicURL (only included when format='acontext')",
    )
    edit_at_message_id: str | None = Field(
        None,
        description=(
            "The message ID where edit strategies were applied up to. "
            "If pin_editing_strategies_at_message was provided, this equals that value. "
            "Otherwise, this is the ID of the last message in the response. "
            "Use this value to maintain prompt cache stability by passing it as "
            "pin_editing_strategies_at_message in subsequent requests."
        ),
    )


class GetTasksOutput(BaseModel):
    """Response model for getting tasks."""

    items: list[Task] = Field(..., description="List of tasks")
    next_cursor: str | None = Field(None, description="Cursor for pagination")
    has_more: bool = Field(..., description="Whether there are more items")


class TokenCounts(BaseModel):
    """Response model for token counts."""

    total_tokens: int = Field(
        ...,
        description="Total token count for all text and tool-call parts in a session",
    )


class MessageObservingStatus(BaseModel):
    """Response model for message observing status."""

    observed: int = Field(..., description="Number of messages with observed status")
    in_process: int = Field(
        ..., description="Number of messages with in_process status"
    )
    pending: int = Field(..., description="Number of messages with pending status")
    updated_at: str = Field(..., description="Timestamp when the status was retrieved")


class ForkSessionOutput(BaseModel):
    """Response model for forking a session."""

    old_session_id: str = Field(..., description="UUID of the original session")
    new_session_id: str = Field(..., description="UUID of the forked session")
