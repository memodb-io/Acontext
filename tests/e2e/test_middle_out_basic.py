from tests.e2e._helpers import banner, get_texts, new_session, store_text


def main() -> None:
    banner("middle_out preserves head and tail")

    sid = new_session()

    for i in range(30):
        store_text(sid, f"msg-{i} " + "x" * 200)

    texts = get_texts(
        sid,
        format="acontext",
        edit_strategies=[
            {
                "type": "middle_out",
                "params": {"token_reduce_to": 500},
            }
        ],
    )

    for t in texts:
        print(t[:20])

    print("\nEXPECT:")
    print("- msg-0, msg-1 present")
    print("- msg-28, msg-29 present")
    print("- gaps in the middle")


if __name__ == "__main__":
    main()

