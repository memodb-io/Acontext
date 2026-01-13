import json

from tests.e2e._client import client
from tests.e2e._helpers import banner, new_session, store_text


def main() -> None:
    banner("tool-call / tool-result pairing")

    sid = new_session()

    client.sessions.store_message(
        sid,
        format="openai",
        blob={
            "role": "assistant",
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {"name": "f", "arguments": "{}"},
                }
            ],
        },
    )

    client.sessions.store_message(
        sid,
        format="openai",
        blob={
            "role": "tool",
            "tool_call_id": "call_1",
            "content": "ok",
        },
    )

    store_text(sid, "noise")

    resp = client.sessions.get_messages(
        sid,
        format="openai",
        edit_strategies=[
            {
                "type": "middle_out",
                "params": {"token_reduce_to": 50},
            }
        ],
    )

    print(json.dumps(resp.model_dump(), indent=2))

    print("\nEXPECT:")
    print("- tool-call and tool-result appear together or not at all")


if __name__ == "__main__":
    main()

