import os
import sys
from pathlib import Path


def _import_client():
    try:
        from acontext import AcontextClient  # type: ignore

        return AcontextClient
    except ModuleNotFoundError:
        repo_root = Path(__file__).resolve().parents[2]
        sdk_src = repo_root / "src" / "client" / "acontext-py" / "src"
        sys.path.insert(0, str(sdk_src))
        from acontext import AcontextClient  # type: ignore

        return AcontextClient


AcontextClient = _import_client()

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080")

if "API_KEY" not in os.environ:
    raise RuntimeError(
        "Missing API_KEY. Run with e.g. `API_KEY=... python tests/e2e/test_middle_out_basic.py`"
    )

API_KEY = os.environ["API_KEY"]

client = AcontextClient(
    api_key=API_KEY,
    base_url=BASE_URL,
)

