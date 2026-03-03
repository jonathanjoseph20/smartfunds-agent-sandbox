#!/usr/bin/env bash

print_usage() {
  echo "Usage: scripts/governance/emit-ci-parity.sh <prNumber>"
}

if [ "$#" -ne 1 ]; then
  print_usage
  exit 2
fi

PR_NUMBER="$1"
case "$PR_NUMBER" in
  ''|*[!0-9]*)
    echo "Invalid PR number: $PR_NUMBER"
    print_usage
    exit 2
    ;;
esac

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install from: https://cli.github.com/"
  exit 2
fi

GITHUB_TOKEN_VALUE="$(gh auth token 2>/dev/null)"
if [ "$?" -ne 0 ] || [ -z "$GITHUB_TOKEN_VALUE" ]; then
  echo "Run: gh auth login"
  exit 2
fi

REMOTE_URL="$(git remote get-url origin 2>/dev/null)"
if [ "$?" -ne 0 ] || [ -z "$REMOTE_URL" ]; then
  echo "Unable to read git remote URL from origin."
  exit 2
fi

REPO_REF=""
case "$REMOTE_URL" in
  git@github.com:*.git)
    REPO_REF="${REMOTE_URL#git@github.com:}"
    REPO_REF="${REPO_REF%.git}"
    ;;
  git@github.com:*)
    REPO_REF="${REMOTE_URL#git@github.com:}"
    ;;
  https://github.com/*.git)
    REPO_REF="${REMOTE_URL#https://github.com/}"
    REPO_REF="${REPO_REF%.git}"
    ;;
  https://github.com/*)
    REPO_REF="${REMOTE_URL#https://github.com/}"
    ;;
  *)
    echo "Unsupported origin URL format: $REMOTE_URL"
    echo "Expected git@github.com:owner/repo.git or https://github.com/owner/repo.git"
    exit 2
    ;;
esac

if [ -z "$REPO_REF" ] || [ "$REPO_REF" = "$REMOTE_URL" ]; then
  echo "Failed to parse GITHUB_REPOSITORY from origin URL: $REMOTE_URL"
  exit 2
fi

export GITHUB_TOKEN="$GITHUB_TOKEN_VALUE"
export GITHUB_REPOSITORY="$REPO_REF"

EMIT_OUTPUT="$(npm run governance:emit:ci -- --pr "$PR_NUMBER" 2>&1)"
EMIT_EXIT="$?"
echo "$EMIT_OUTPUT"
if [ "$EMIT_EXIT" -ne 0 ]; then
  echo "governance:emit:ci failed."
  exit "$EMIT_EXIT"
fi

if [ ! -f governance/evidence.json ]; then
  echo "governance/evidence.json not found after emit."
  exit 1
fi

EVIDENCE_LINE="$(printf '%s\n' "$EMIT_OUTPUT" | grep '^Evidence SHA: ' | tail -n 1)"
if [ -z "$EVIDENCE_LINE" ]; then
  echo "Evidence SHA line not found in emitter output."
  exit 1
fi

echo "$EVIDENCE_LINE"

STATUS_SHORT="$(git status --short)"
if [ -z "$STATUS_SHORT" ]; then
  echo "Working tree: clean"
else
  echo "Working tree changes:"
  echo "$STATUS_SHORT"
fi

if git diff --exit-code -- governance/evidence.json >/dev/null 2>&1; then
  echo "✅ Evidence is already canonical. No changes."
  exit 0
fi

echo "❌ Evidence drift detected. Commit required."
exit 1
