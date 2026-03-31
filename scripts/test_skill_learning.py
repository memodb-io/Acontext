"""
Test script to verify the skill learning flow works correctly.
Specifically checks for the skill_writing status.

Usage:
    export ACONTEXT_API_KEY=sk-ac-xxx
    python scripts/test_skill_learning.py
"""

import os
import time
from acontext import AcontextClient


def main():
    api_key = os.environ.get("ACONTEXT_API_KEY")
    if not api_key:
        print("ERROR: ACONTEXT_API_KEY environment variable not set")
        return

    client = AcontextClient(api_key=api_key)

    ls_id = None
    try:
        # 1. Create a learning space
        print("\n=== Step 1: Creating learning space ===")
        ls = client.learning_spaces.create(meta={"test": "skill_writing_status_test"})
        ls_id = ls.id
        print(f"Created learning space: {ls_id}")

        # 2. Create a session
        print("\n=== Step 2: Creating session ===")
        session = client.sessions.create()
        session_id = session.id
        print(f"Created session: {session_id}")

        # 3. Send a message
        print("\n=== Step 3: Sending message ===")
        message = client.sessions.store_message(
            session_id=session_id,
            blob={"role": "user", "content": "Help me implement a binary search tree with insert, search, and delete operations in Python."},
            format="openai",
        )
        print(f"Created message: {message.id}")

        # 4. Wait for task to complete (briefly)
        print("\n=== Step 4: Brief wait for task processing ===")
        time.sleep(5)  # Give it a moment to create the task
        tasks = client.sessions.get_tasks(session_id=session_id)
        if tasks.items:
            print(f"Task created: {tasks.items[0].status}")

        # 5. Trigger learning
        print("\n=== Step 5: Triggering learning ===")
        ls_session = client.learning_spaces.learn(ls_id, session_id=session_id)
        print(f"Initial learning session status: {ls_session.status}")

        # 6. Poll and observe status transitions
        print("\n=== Step 6: Observing status transitions ===")
        seen_statuses = set([ls_session.status])
        max_wait = 120
        start = time.monotonic()

        while time.monotonic() - start < max_wait:
            ls_sessions = client.learning_spaces.list_sessions(ls_id)
            if ls_sessions:
                current = ls_sessions[0]
                if current.status not in seen_statuses:
                    print(f"  Status change: {seen_statuses} -> {current.status}")
                    seen_statuses.add(current.status)

                if current.status in ("completed", "failed"):
                    print(f"  Final status: {current.status}")
                    break
            time.sleep(0.5)  # Poll more frequently to catch transitions

        print(f"\n  All observed statuses: {seen_statuses}")

        # 7. Check for skill_writing
        print("\n=== Step 7: Checking for skill_writing status ===")
        if "skill_writing" in seen_statuses:
            print("✅ skill_writing status was observed!")
        else:
            print("❌ skill_writing status was NOT observed")
            print("   This could mean:")
            print("   1. The transition was too fast to catch")
            print("   2. Distillation returned None (not worth learning)")
            print("   3. The feature isn't working as expected")

        # 8. Check for created skills
        print("\n=== Step 8: Checking for skills ===")
        skills = client.learning_spaces.list_skills(ls_id)
        print(f"Skills in learning space: {len(skills)}")
        for skill in skills:
            print(f"  - {skill.name}")

        # Summary
        print("\n=== Summary ===")
        print(f"Statuses observed: {sorted(seen_statuses)}")
        print(f"Skills created: {len(skills)}")

    finally:
        # Cleanup
        print("\n=== Cleanup ===")
        try:
            if ls_id:
                client.learning_spaces.delete(ls_id)
                print(f"Deleted learning space: {ls_id}")
        except Exception as e:
            print(f"Cleanup error: {e}")

        client.close()


if __name__ == "__main__":
    main()
