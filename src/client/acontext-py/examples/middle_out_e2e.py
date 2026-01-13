"""
End-to-end exercise for the `middle_out` edit strategy.

This script is meant to be run against a live Acontext API instance.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from acontext import AcontextClient


LARGE_CONTENT_CHARS = 8_000


def resolve_credentials() -> tuple[str, str]:
    api_key = (
        os.getenv("ACONTEXT_API_KEY")
        or os.getenv("API_KEY")
        or "sk-ac-your-root-api-bearer-token"
    )
    base_url = (
        os.getenv("ACONTEXT_BASE_URL") or os.getenv("BASE_URL") or "http://localhost:8029/api/v1"
    )
    return api_key, base_url


def banner(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def ensure(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def store_text(client: AcontextClient, session_id: str, text: str) -> None:
    client.sessions.store_message(
        session_id,
        format="acontext",
        blob={"role": "user", "parts": [{"type": "text", "text": text}]},
    )


def get_acontext_items(
    client: AcontextClient,
    session_id: str,
    edit_strategies: list[dict[str, Any]] | None = None,
) -> list[Any]:
    resp = client.sessions.get_messages(
        session_id,
        format="acontext",
        edit_strategies=edit_strategies,  # type: ignore[arg-type]
    )
    return resp.items


def get_text_parts(items: list[Any]) -> list[str]:
    texts: list[str] = []
    for message in items:
        for part in getattr(message, "parts", []) or []:
            if getattr(part, "type", None) == "text" and getattr(part, "text", None):
                texts.append(part.text)
    return texts


def has_tool_call(items: list[Any], tool_call_id: str) -> bool:
    for message in items:
        for part in getattr(message, "parts", []) or []:
            if getattr(part, "type", None) != "tool-call":
                continue
            meta = getattr(part, "meta", None) or {}
            if meta.get("id") == tool_call_id:
                return True
    return False


def has_tool_result(items: list[Any], tool_call_id: str) -> bool:
    for message in items:
        for part in getattr(message, "parts", []) or []:
            if getattr(part, "type", None) != "tool-result":
                continue
            meta = getattr(part, "meta", None) or {}
            if meta.get("tool_call_id") == tool_call_id:
                return True
    return False


def exercise_basic_middle_out(client: AcontextClient) -> None:
    banner("middle_out preserves head/tail and removes middle")

    session_id = client.sessions.create(configs={"mode": "sdk-e2e-middle-out"}).id
    try:
        for i in range(30):
            if 10 <= i <= 19:
                payload = f"msg-{i} " + ("x" * LARGE_CONTENT_CHARS)
            else:
                payload = f"msg-{i} short"
            store_text(client, session_id, payload)

        items = get_acontext_items(
            client,
            session_id,
            edit_strategies=[{"type": "middle_out", "params": {"token_reduce_to": 2000}}],
        )
        texts = get_text_parts(items)
        joined = "\n".join(texts)

        ensure("msg-0 short" in joined, "Expected earliest messages to be kept")
        ensure("msg-1 short" in joined, "Expected earliest messages to be kept")
        ensure("msg-28 short" in joined, "Expected most recent messages to be kept")
        ensure("msg-29 short" in joined, "Expected most recent messages to be kept")
        ensure("msg-15 " not in joined, "Expected middle message to be removed")
    finally:
        client.sessions.delete(session_id)


def exercise_even_determinism(client: AcontextClient) -> None:
    banner("even-count determinism (right-middle removed)")

    session_id = client.sessions.create(configs={"mode": "sdk-e2e-middle-out"}).id
    try:
        store_text(client, session_id, "m0")
        store_text(client, session_id, "m1")
        store_text(client, session_id, "m2 " + ("x" * LARGE_CONTENT_CHARS))
        store_text(client, session_id, "m3")

        items = get_acontext_items(
            client,
            session_id,
            edit_strategies=[{"type": "middle_out", "params": {"token_reduce_to": 200}}],
        )
        texts = get_text_parts(items)
        joined = "\n".join(texts)

        ensure("m0" in joined, "Expected head to be kept")
        ensure("m1" in joined, "Expected head to be kept")
        ensure("m2 " not in joined, "Expected right-middle to be removed")
        ensure("m3" in joined, "Expected tail to be kept")
    finally:
        client.sessions.delete(session_id)


def exercise_keep_tail(client: AcontextClient) -> None:
    banner("keep-tail fallback (2 messages)")

    session_id = client.sessions.create(configs={"mode": "sdk-e2e-middle-out"}).id
    try:
        store_text(client, session_id, "old " + ("x" * LARGE_CONTENT_CHARS))
        store_text(client, session_id, "new")

        items = get_acontext_items(
            client,
            session_id,
            edit_strategies=[{"type": "middle_out", "params": {"token_reduce_to": 200}}],
        )
        texts = get_text_parts(items)
        joined = "\n".join(texts)

        ensure("old " not in joined, "Expected keep-tail fallback to drop oldest")
        ensure("new" in joined, "Expected keep-tail fallback to keep newest")
    finally:
        client.sessions.delete(session_id)


def exercise_tool_pairing(client: AcontextClient) -> None:
    banner("tool-call / tool-result pairing")

    session_id = client.sessions.create(configs={"mode": "sdk-e2e-middle-out"}).id
    try:
        store_text(client, session_id, "prefix")

        client.sessions.store_message(
            session_id,
            format="openai",
            blob={
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": "call_1",
                        "type": "function",
                        "function": {"name": "f", "arguments": "x" * LARGE_CONTENT_CHARS},
                    }
                ],
            },
        )
        client.sessions.store_message(
            session_id,
            format="openai",
            blob={"role": "tool", "tool_call_id": "call_1", "content": "ok"},
        )

        store_text(client, session_id, "suffix")

        items = get_acontext_items(
            client,
            session_id,
            edit_strategies=[{"type": "middle_out", "params": {"token_reduce_to": 500}}],
        )

        ensure(not has_tool_call(items, "call_1"), "Expected tool-call to be removed")
        ensure(not has_tool_result(items, "call_1"), "Expected tool-result to be removed")
    finally:
        client.sessions.delete(session_id)


def exercise_validation_errors(client: AcontextClient) -> None:
    banner("validation errors")

    session_id = client.sessions.create(configs={"mode": "sdk-e2e-middle-out"}).id
    try:
        cases = [
            {"type": "middle_out", "params": {}},
            {"type": "middle_out", "params": {"token_reduce_to": "x"}},
            {"type": "middle_out", "params": {"token_reduce_to": 0}},
        ]

        for c in cases:
            try:
                client.sessions.get_messages(
                    session_id,
                    format="acontext",
                    edit_strategies=[c],  # type: ignore[arg-type]
                )
            except Exception:
                continue
            raise AssertionError(f"Expected validation error for: {c}")
    finally:
        client.sessions.delete(session_id)


def main() -> None:
    api_key, base_url = resolve_credentials()
    client = AcontextClient(api_key=api_key, base_url=base_url)

    exercise_basic_middle_out(client)
    exercise_even_determinism(client)
    exercise_keep_tail(client)
    exercise_tool_pairing(client)
    exercise_validation_errors(client)

    banner("OK")


if __name__ == "__main__":
    main()
