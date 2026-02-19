#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run this script inside a git repository." >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%d-%H%M%S)"
BRANCH="preflight/${USER:-codex}-${STAMP}"

cat <<CMDS
[1/5] Verify remotes/auth
  git remote -v
  git fetch origin
  gh auth status

[2/5] Create preflight branch + empty commit
  git checkout -b ${BRANCH}
  git commit --allow-empty -m "chore: push preflight"

[3/5] Push + verify on origin
  git push -u origin HEAD
  git ls-remote --heads origin "${BRANCH}"

[4/5] Open PR + verify visibility
  gh pr create --fill --base main --head ${BRANCH}

[5/5] VPS verification commands
  git fetch origin ${BRANCH}
  git rev-parse FETCH_HEAD
  git branch --contains <commit_sha>
CMDS

echo "Suggested preflight branch: ${BRANCH}"
