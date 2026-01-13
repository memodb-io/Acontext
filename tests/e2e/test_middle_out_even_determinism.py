from tests.e2e._helpers import banner, get_texts, new_session, store_text


def main() -> None:
    banner("even-count determinism (right-middle removed)")

    sid = new_session()

    for m in ["m0", "m1", "m2", "m3"]:
        store_text(sid, m)

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
    print("- m2 is missing")


if __name__ == "__main__":
    main()

