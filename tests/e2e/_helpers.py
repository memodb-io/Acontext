from __future__ import annotations

from typing import Any, List

from tests.e2e._client import client


def new_session() -> str:
    session = client.sessions.create()
    return session.id


def store_text(session_id: str, text: str) -> None:
    client.sessions.store_message(
        session_id,
        format="acontext",
        blob={
            "role": "user",
            "parts": [{"type": "text", "text": text}],
        },
    )


def _extract_texts_from_acontext_messages(items: list[Any]) -> list[str]:
    texts: list[str] = []
    for message in items:
        for part in getattr(message, "parts", []) or []:
            if getattr(part, "type", None) == "text" and getattr(part, "text", None):
                texts.append(part.text)
    return texts


def _extract_texts_from_openai_messages(items: list[Any]) -> list[str]:
    texts: list[str] = []
    for message in items:
        if isinstance(message, dict):
            content = message.get("content")
            if isinstance(content, str) and content:
                texts.append(content)
    return texts


def get_texts(session_id: str, **kwargs: Any) -> List[str]:
    resp = client.sessions.get_messages(session_id, **kwargs)
    format_ = kwargs.get("format", "openai")
    if format_ == "acontext":
        return _extract_texts_from_acontext_messages(resp.items)
    if format_ == "openai":
        return _extract_texts_from_openai_messages(resp.items)
    return []


def banner(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)

