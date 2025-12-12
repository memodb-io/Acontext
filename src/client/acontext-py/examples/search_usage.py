"""
Example usage of the Acontext space search APIs.

This example demonstrates how to use the experience search endpoint:
1. experience_search - Advanced AI-powered search with optional agentic mode
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from acontext import AcontextClient
from acontext.errors import APIError


def resolve_credentials() -> tuple[str, str]:
    """Get API credentials from environment variables."""
    api_key = os.getenv("ACONTEXT_API_KEY", "sk-proj-your-project-api-key")
    base_url = os.getenv("ACONTEXT_BASE_URL", "http://localhost:8029/api/v1")
    return api_key, base_url


def example_experience_search(client: AcontextClient, space_id: str) -> None:
    """
    Example: Experience Search

    The most advanced search option that can use AI to iteratively refine search results.
    """
    print("\n=== Experience Search ===\n")

    # Fast mode (default) - quick semantic search
    print("1. Fast mode search:")
    result = client.spaces.experience_search(
        space_id,
        query="How to implement authentication?",
        limit=5,
        mode="fast",
    )
    print(f"  Found {len(result.cited_blocks)} blocks")
    for block in result.cited_blocks[:3]:  # Show first 3
        print(f"  - {block.title} (distance: {block.distance})")
    if result.final_answer:
        print(f"  Final answer: {result.final_answer[:100]}...")

    # Agentic mode - AI-powered iterative search
    print("\n2. Agentic mode search:")
    result = client.spaces.experience_search(
        space_id,
        query="What are the best practices for API security?",
        limit=10,
        mode="agentic",
        semantic_threshold=0.8,
        max_iterations=20,
    )
    print(f"  Found {len(result.cited_blocks)} blocks")
    for block in result.cited_blocks[:3]:
        print(f"  - {block.title} (type: {block.type}, distance: {block.distance})")
    if result.final_answer:
        print(f"  Final answer: {result.final_answer}")


async def example_async_search() -> None:
    """
    Example: Using async client for search operations
    """
    from acontext import AsyncAcontextClient

    api_key, base_url = resolve_credentials()

    async with AsyncAcontextClient(api_key=api_key, base_url=base_url) as client:
        # Get first space
        spaces = await client.spaces.list(limit=1)
        if not spaces.items:
            print("No spaces found. Create a space first.")
            return

        space_id = spaces.items[0].id
        print(f"\n=== Async Search Example (Space: {space_id}) ===\n")

        # Perform experience search
        exp_result = await client.spaces.experience_search(
            space_id,
            query="API documentation",
            limit=5,
        )

        print(f"Experience search: {len(exp_result.cited_blocks)} blocks")


def main() -> None:
    """Run all search examples."""
    api_key, base_url = resolve_credentials()

    try:
        with AcontextClient(api_key=api_key, base_url=base_url) as client:
            # Get the first available space
            spaces = client.spaces.list(limit=1)
            if not spaces.items:
                print("No spaces found. Please create a space first.")
                print("\nExample: client.spaces.create(configs={'name': 'My Space'})")
                return

            space_id = spaces.items[0].id
            print(f"Using space: {space_id}")

            # Run synchronous examples
            example_experience_search(client, space_id)

    except APIError as exc:
        print(f"\n[API Error] {exc.status_code}: {exc.message}")
        if exc.payload:
            print(f"Details: {json.dumps(exc.payload, indent=2)}")
    except Exception as exc:
        print(f"\n[Error] {exc}")
        raise

    # Run async example
    print("\n" + "=" * 60)
    print("Running async example...")
    print("=" * 60)

    import asyncio

    asyncio.run(example_async_search())


if __name__ == "__main__":
    main()
