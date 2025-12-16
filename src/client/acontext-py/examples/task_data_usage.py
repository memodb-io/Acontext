"""
Example demonstrating the use of structured TaskData in the Acontext Python SDK.

This example shows how to:
1. Retrieve tasks from a session
2. Access structured TaskData fields with proper type annotations
3. Work with task descriptions, progresses, user preferences, and SOP thinking
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from acontext import AcontextClient, Task, TaskData


def resolve_credentials() -> tuple[str, str]:
    """Get API credentials from environment variables."""
    api_key = os.getenv("ACONTEXT_API_KEY", "sk-ac-your-root-api-bearer-token")
    base_url = os.getenv("ACONTEXT_BASE_URL", "http://localhost:8029/api/v1")
    return api_key, base_url


def display_task_data(task: Task) -> None:
    """Display structured TaskData with proper type annotations.

    Args:
        task: Task object with structured TaskData
    """
    print(f"\n{'='*60}")
    print(f"Task #{task.order} (ID: {task.id})")
    print(f"Status: {task.status}")
    print(f"Planning: {task.is_planning}")
    print(f"Space Digested: {task.space_digested}")
    print(f"{'='*60}")

    # Access structured TaskData fields with type safety
    data: TaskData = task.data

    print("\n📝 Task Description:")
    print(f"   {data.task_description}")

    if data.progresses:
        print(f"\n✅ Progress Updates ({len(data.progresses)}):")
        for i, progress in enumerate(data.progresses, 1):
            print(f"   {i}. {progress}")

    if data.user_preferences:
        print(f"\n⚙️  User Preferences ({len(data.user_preferences)}):")
        for i, pref in enumerate(data.user_preferences, 1):
            print(f"   {i}. {pref}")

    if data.sop_thinking:
        print("\n💭 SOP Thinking:")
        print(f"   {data.sop_thinking}")

    print("\n⏰ Timestamps:")
    print(f"   Created: {task.created_at}")
    print(f"   Updated: {task.updated_at}")


def main() -> None:
    """Main function to demonstrate TaskData usage."""
    api_key, base_url = resolve_credentials()

    # Get session ID from environment or use a default
    session_id = os.getenv("ACONTEXT_SESSION_ID")
    if not session_id:
        print("⚠️  Please set ACONTEXT_SESSION_ID environment variable")
        print("   Example: export ACONTEXT_SESSION_ID='your-session-uuid'")
        return

    with AcontextClient(api_key=api_key, base_url=base_url) as client:
        print(f"🔍 Fetching tasks for session: {session_id}")

        # Get tasks with structured TaskData
        result = client.sessions.get_tasks(
            session_id, limit=20, time_desc=True  # Most recent first
        )

        print(f"\n📊 Found {len(result.items)} task(s)")
        print(f"   Has more: {result.has_more}")
        if result.next_cursor:
            print(f"   Next cursor: {result.next_cursor[:50]}...")

        # Display each task with structured data
        for task in result.items:
            display_task_data(task)

        # Example: Filter tasks by status
        print(f"\n{'='*60}")
        print("Task Summary by Status:")
        print(f"{'='*60}")

        status_counts = {}
        for task in result.items:
            status_counts[task.status] = status_counts.get(task.status, 0) + 1

        for status, count in sorted(status_counts.items()):
            print(f"  {status.upper()}: {count}")

        # Example: Show tasks with progresses
        tasks_with_progress = [t for t in result.items if t.data.progresses]
        print(f"\n📈 Tasks with progress updates: {len(tasks_with_progress)}")

        # Example: Show tasks with user preferences
        tasks_with_prefs = [t for t in result.items if t.data.user_preferences]
        print(f"⚙️  Tasks with user preferences: {len(tasks_with_prefs)}")

        # Example: Show tasks with SOP thinking
        tasks_with_sop = [t for t in result.items if t.data.sop_thinking]
        print(f"💭 Tasks with SOP thinking: {len(tasks_with_sop)}")


if __name__ == "__main__":
    main()
