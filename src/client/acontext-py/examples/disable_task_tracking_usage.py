"""Example: Creating sessions with task tracking disabled."""

from acontext import AcontextClient

# Initialize the client
client = AcontextClient(
    base_url="http://localhost:8029/api/v1", api_key="sk-ac-your-root-api-bearer-token"
)

# Example 1: Create a session normally
session_without_tracking = client.sessions.create(configs={"mode": "chat"})
print(f"Normal Session: {session_without_tracking.id}")
print(f"Task tracking disabled: {session_without_tracking.disable_task_tracking}")


# Example 2: Create a session with task tracking disabled
# When disabled, messages sent to this session will NOT be published to the message queue
# This means no automatic task creation or processing
session_without_tracking = client.sessions.create(
    disable_task_tracking=True, configs={"mode": "chat"}
)
print(f"\nSession without tracking: {session_without_tracking.id}")
print(f"Task tracking disabled: {session_without_tracking.disable_task_tracking}")
