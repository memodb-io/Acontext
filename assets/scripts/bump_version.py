#!/usr/bin/env python3
"""
Bump SDK versions for Acontext Python and TypeScript SDKs.

Usage (from repo root):
    python assets/scripts/bump_version.py [--part patch|minor|major] [--dry-run]

Defaults to bumping the patch version.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

PY_PYPROJECT = REPO_ROOT / "src" / "client" / "acontext-py" / "pyproject.toml"
TS_PACKAGE = REPO_ROOT / "src" / "client" / "acontext-ts" / "package.json"


def parse_version(version_str: str) -> tuple[int, int, int]:
    """Parse a semver string like '0.1.10' into (major, minor, patch)."""
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)$", version_str)
    if not match:
        raise ValueError(f"Invalid version format: {version_str}")
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def bump(version: tuple[int, int, int], part: str) -> str:
    """Bump the specified part of the version and return the new version string."""
    major, minor, patch = version
    if part == "major":
        return f"{major + 1}.0.0"
    elif part == "minor":
        return f"{major}.{minor + 1}.0"
    else:  # patch
        return f"{major}.{minor}.{patch + 1}"


def read_py_version() -> str:
    """Read the current version from pyproject.toml."""
    content = PY_PYPROJECT.read_text()
    match = re.search(r'^version\s*=\s*"([^"]+)"', content, re.MULTILINE)
    if not match:
        raise RuntimeError(f"Could not find version in {PY_PYPROJECT}")
    return match.group(1)


def write_py_version(old: str, new: str) -> None:
    """Write the new version to pyproject.toml."""
    content = PY_PYPROJECT.read_text()
    updated = content.replace(f'version = "{old}"', f'version = "{new}"', 1)
    PY_PYPROJECT.write_text(updated)


def read_ts_version() -> str:
    """Read the current version from package.json."""
    data = json.loads(TS_PACKAGE.read_text())
    return data["version"]


def write_ts_version(new: str) -> None:
    """Write the new version to package.json."""
    data = json.loads(TS_PACKAGE.read_text())
    data["version"] = new
    TS_PACKAGE.write_text(json.dumps(data, indent=2) + "\n")


def git_commit_and_tag(py_old: str, py_new: str, ts_old: str, ts_new: str) -> None:
    """Stage changed files, create a git commit, and add version tags."""
    files = [str(PY_PYPROJECT), str(TS_PACKAGE)]
    subprocess.run(["git", "add"] + files, cwd=REPO_ROOT, check=True)

    msg = (
        f"chore: bump SDK versions\n\n"
        f"- Python SDK: {py_old} -> {py_new}\n"
        f"- TypeScript SDK: {ts_old} -> {ts_new}"
    )
    subprocess.run(["git", "commit", "-m", msg], cwd=REPO_ROOT, check=True)

    # Add version tags
    ts_tag = f"sdk-ts/v{ts_new}"
    py_tag = f"sdk-py/v{py_new}"
    subprocess.run(["git", "tag", ts_tag], cwd=REPO_ROOT, check=True)
    subprocess.run(["git", "tag", py_tag], cwd=REPO_ROOT, check=True)
    print(f"\nTags created: {ts_tag}, {py_tag}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bump Acontext SDK versions")
    parser.add_argument(
        "--part",
        choices=["patch", "minor", "major"],
        default="patch",
        help="Which part of the semver to bump (default: patch)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would happen without making changes",
    )
    args = parser.parse_args()

    # --- Read current versions ---
    py_old = read_py_version()
    ts_old = read_ts_version()

    py_new = bump(parse_version(py_old), args.part)
    ts_new = bump(parse_version(ts_old), args.part)

    print(f"Python SDK : {py_old} -> {py_new}  ({PY_PYPROJECT.relative_to(REPO_ROOT)})")
    print(
        f"TypeScript SDK: {ts_old} -> {ts_new}  ({TS_PACKAGE.relative_to(REPO_ROOT)})"
    )

    if args.dry_run:
        print("\n[dry-run] No changes made.")
        return

    print(f"\nTags to create: sdk-ts/v{ts_new}, sdk-py/v{py_new}")

    # --- Confirm before committing ---
    answer = input("\nCommit and tag these changes? [y/N] ").strip().lower()
    if answer not in ("y", "yes"):
        print("Aborted. Files were updated but NOT committed.")
        sys.exit(0)

    # --- Write new versions ---
    print("\nVersions updated.")
    write_py_version(py_old, py_new)
    write_ts_version(ts_new)

    # --- Git commit & tag ---
    git_commit_and_tag(py_old, py_new, ts_old, ts_new)

    print("Done! Committed and tagged successfully.")


if __name__ == "__main__":
    main()
