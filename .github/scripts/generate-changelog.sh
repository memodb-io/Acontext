#!/usr/bin/env bash
# generate-changelog.sh — Generate a path-scoped changelog between consecutive tags.
#
# Usage:
#   generate-changelog.sh \
#     --tag-prefix "cli/v" \
#     --source-dir "src/client/acontext-cli" \
#     --display-name "CLI" \
#     --output "/path/to/CHANGELOG.txt" \
#     --footer "Binary artifacts are available in this release."
#
# Requires GITHUB_REF (e.g. refs/tags/cli/v0.1.16) to be set.

set -euo pipefail

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
TAG_PREFIX=""
SOURCE_DIR=""
DISPLAY_NAME=""
OUTPUT=""
FOOTER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag-prefix)   TAG_PREFIX="$2";   shift 2 ;;
    --source-dir)   SOURCE_DIR="$2";   shift 2 ;;
    --display-name) DISPLAY_NAME="$2"; shift 2 ;;
    --output)       OUTPUT="$2";       shift 2 ;;
    --footer)       FOOTER="$2";       shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$TAG_PREFIX" || -z "$SOURCE_DIR" || -z "$DISPLAY_NAME" || -z "$OUTPUT" ]]; then
  echo "Error: --tag-prefix, --source-dir, --display-name, and --output are required." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Derive version & current tag from GITHUB_REF
# ---------------------------------------------------------------------------
if [[ -z "${GITHUB_REF:-}" ]]; then
  echo "Error: GITHUB_REF is not set." >&2
  exit 1
fi

CURRENT_TAG="${GITHUB_REF#refs/tags/}"
VERSION="${CURRENT_TAG#"$TAG_PREFIX"}"

# ---------------------------------------------------------------------------
# Find previous tag with the same prefix
# ---------------------------------------------------------------------------
PREV_TAG=$(git tag -l "${TAG_PREFIX}*" --sort=-v:refname \
  | { grep -v "^${CURRENT_TAG}$" || true; } \
  | head -1)

# ---------------------------------------------------------------------------
# Build changelog
# ---------------------------------------------------------------------------
{
  echo "# ${DISPLAY_NAME} v${VERSION}"
  echo ""

  if [[ -z "$PREV_TAG" ]]; then
    echo "Initial release."
  else
    # Get path-scoped commits between the two tags
    COMMITS=$(git log --oneline "${PREV_TAG}..${CURRENT_TAG}" -- "${SOURCE_DIR}" 2>/dev/null) || true

    if [[ -n "$COMMITS" ]]; then
      echo "## What's Changed"
      echo ""

      # Collect commits into categories
      FEATS=""
      FIXES=""
      OTHER=""

      while IFS= read -r line; do
        # Strip the short SHA prefix (first word)
        MSG="${line#* }"
        # Strip conventional commit prefix to get the description
        DESC="${MSG#*: }"
        case "$MSG" in
          feat:*|feat\(*) FEATS="${FEATS}- ${DESC}"$'\n' ;;
          fix:*|fix\(*)   FIXES="${FIXES}- ${DESC}"$'\n' ;;
          *)              OTHER="${OTHER}- ${MSG}"$'\n' ;;
        esac
      done <<< "$COMMITS"

      if [[ -n "$FEATS" ]]; then
        echo "### Features"
        printf '%s' "$FEATS"
        echo ""
      fi

      if [[ -n "$FIXES" ]]; then
        echo "### Bug Fixes"
        printf '%s' "$FIXES"
        echo ""
      fi

      if [[ -n "$OTHER" ]]; then
        echo "### Other"
        printf '%s' "$OTHER"
        echo ""
      fi
    else
      echo "No path-scoped changes in this release."
      echo ""
    fi

    echo "**Full Changelog**: https://github.com/memodb-io/Acontext/compare/${PREV_TAG}...${CURRENT_TAG}"
  fi

  if [[ -n "$FOOTER" ]]; then
    echo ""
    echo "---"
    echo ""
    echo "$FOOTER"
  fi
} > "$OUTPUT"

echo "Changelog written to ${OUTPUT}"
