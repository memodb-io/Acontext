from tests.e2e._helpers import banner, get_texts, new_session, store_text


def main() -> None:
    banner("keep-tail fallback")

    sid = new_session()

    store_text(sid, "old " + "x" * 200)
    store_text(sid, "new " + "x" * 200)

    texts = get_texts(
        sid,
        format="acontext",
        edit_strategies=[
            {
                "type": "middle_out",
                "params": {"token_reduce_to": 10},
            }
        ],
    )

    print("Returned:", texts)
    print("\nEXPECT:")
    print("- only 'new' remains")


if __name__ == "__main__":
    main()

