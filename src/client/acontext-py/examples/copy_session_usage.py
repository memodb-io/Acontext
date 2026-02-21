"""
Example demonstrating session copy functionality.

This script demonstrates:
1. Creating a session and adding messages
2. Copying a session to create an independent copy
3. Modifying the copied session without affecting the original
4. Comparing results between original and copied sessions
5. Using copy for experimentation and checkpointing
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from acontext import AcontextClient
from acontext.errors import APIError


def resolve_credentials() -> tuple[str, str]:
    api_key = os.getenv("ACONTEXT_API_KEY", "sk-ac-your-root-api-bearer-token")
    base_url = os.getenv("ACONTEXT_BASE_URL", "http://localhost:8029/api/v1")
    return api_key, base_url


def main() -> None:
    api_key, base_url = resolve_credentials()

    with AcontextClient(api_key=api_key, base_url=base_url) as client:
        # Test connectivity
        print(f"✓ Server ping: {client.ping()}")

        original_session_id: str | None = None
        copied_session_id: str | None = None

        try:
            # Create an original session
            print("\n--- Creating original session ---")
            original_session = client.sessions.create()
            original_session_id = original_session.id
            print(f"Original session ID: {original_session_id}")

            # Add some messages to the original session
            # Note: System messages are not supported in OpenAI format.
            # Use session-level configs for system prompts instead.
            print("\n--- Adding messages to original session ---")
            client.sessions.store_message(
                original_session_id,
                blob={"role": "user", "content": "What is 2+2?"},
                format="openai",
            )
            print("✓ Added user message")

            client.sessions.store_message(
                original_session_id,
                blob={"role": "assistant", "content": "2+2 equals 4."},
                format="openai",
            )
            print("✓ Added assistant message")

            # Get original session messages count
            original_messages = client.sessions.get_messages(
                session_id=original_session_id, limit=100
            )
            print(f"\nOriginal session has {len(original_messages.items)} messages")

            # Copy the session
            print("\n--- Copying session ---")
            copy_result = client.sessions.copy(session_id=original_session_id)
            copied_session_id = copy_result.new_session_id
            print("✓ Copied session created")
            print(f"  Original session ID: {copy_result.old_session_id}")
            print(f"  Copied session ID: {copy_result.new_session_id}")

            # Verify copied session has the same messages
            print("\n--- Verifying copied session ---")
            copied_messages = client.sessions.get_messages(
                session_id=copied_session_id, limit=100
            )
            print(f"Copied session has {len(copied_messages.items)} messages")
            assert (
                len(copied_messages.items) == len(original_messages.items)
            ), "Copied session should have same number of messages"

            # Add a new message to the copied session
            print("\n--- Modifying copied session (independent) ---")
            client.sessions.store_message(
                copied_session_id,
                blob={"role": "user", "content": "What is 3+3?"},
                format="openai",
            )
            print("✓ Added new message to copied session")

            # Verify original session is unchanged
            print("\n--- Verifying original session unchanged ---")
            original_messages_after = client.sessions.get_messages(
                session_id=original_session_id, limit=100
            )
            copied_messages_after = client.sessions.get_messages(
                session_id=copied_session_id, limit=100
            )

            print(f"Original session still has {len(original_messages_after.items)} messages")
            print(f"Copied session now has {len(copied_messages_after.items)} messages")
            assert (
                len(original_messages_after.items) == len(original_messages.items)
            ), "Original session should be unchanged"
            assert (
                len(copied_messages_after.items) > len(original_messages.items)
            ), "Copied session should have more messages"

            # Demonstrate experimentation use case
            print("\n--- Experimentation use case ---")
            print("You can now try different approaches in the copied session")
            print("without affecting the original conversation.")

            # Demonstrate checkpointing use case
            print("\n--- Checkpointing use case ---")
            checkpoint_result = client.sessions.copy(session_id=original_session_id)
            checkpoint_id = checkpoint_result.new_session_id
            print(f"✓ Created checkpoint: {checkpoint_id}")
            print("You can always return to this checkpoint if needed.")

            # Compare token counts
            print("\n--- Comparing token counts ---")
            original_tokens = client.sessions.get_token_counts(
                session_id=original_session_id
            )
            copied_tokens = client.sessions.get_token_counts(session_id=copied_session_id)
            checkpoint_tokens = client.sessions.get_token_counts(session_id=checkpoint_id)

            print(f"Original session: {original_tokens.total_tokens} tokens")
            print(f"Copied session: {copied_tokens.total_tokens} tokens")
            print(f"Checkpoint session: {checkpoint_tokens.total_tokens} tokens")

            print("\n✓ Copy session example completed successfully!")
            print("\nSession IDs:")
            print(f"  Original: {original_session_id}")
            print(f"  Copied: {copied_session_id}")
            print(f"  Checkpoint: {checkpoint_id}")

        except APIError as exc:
            print(f"\n[API error] status={exc.status_code} message={exc.message}")
            if exc.status_code == 413:
                print("Session is too large to copy synchronously (>5000 messages)")
            elif exc.status_code == 404:
                print("Session not found or access denied")
            raise


def demonstrate_error_handling() -> None:
    """Demonstrate error handling for copy operations."""
    api_key, base_url = resolve_credentials()

    with AcontextClient(api_key=api_key, base_url=base_url) as client:
        print("\n--- Error Handling Examples ---")

        # Invalid UUID format
        try:
            client.sessions.copy(session_id="invalid-uuid")
        except APIError as exc:
            print(f"✓ Invalid UUID handled: {exc.message}")

        # Non-existent session
        try:
            import uuid

            fake_id = str(uuid.uuid4())
            client.sessions.copy(session_id=fake_id)
        except APIError as exc:
            if exc.status_code == 404:
                print(f"✓ Non-existent session handled: {exc.message}")


if __name__ == "__main__":
    try:
        main()
        # Uncomment to see error handling examples
        # demonstrate_error_handling()
    except APIError as exc:
        print(f"[API error] status={exc.status_code} message={exc.message}")
        sys.exit(1)
    except Exception as exc:
        print(f"[Error] {exc}")
        sys.exit(1)
