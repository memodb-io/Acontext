from tests.e2e._client import client
from tests.e2e._helpers import banner, new_session


def main() -> None:
    banner("validation errors")

    sid = new_session()

    cases = [
        {"type": "middle_out", "params": {}},
        {"type": "middle_out", "params": {"token_reduce_to": "x"}},
        {"type": "middle_out", "params": {"token_reduce_to": 0}},
    ]

    for c in cases:
        print("\nCase:", c)
        try:
            client.sessions.get_messages(
                sid,
                format="acontext",
                edit_strategies=[c],  # type: ignore[arg-type]
            )
            print("❌ Unexpected success")
        except Exception as e:
            print("✅ Error:", e)


if __name__ == "__main__":
    main()

