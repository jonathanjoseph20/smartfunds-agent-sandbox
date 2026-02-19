#!/usr/bin/env bash
set -euo pipefail

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean." >&2
  git status --short
  exit 1
fi

if find . -type f \( -name '*.bak' -o -name '*.save' -o -name '*.tsbuildinfo' -o -name '*.sqlite' -o -name '*.db' \) \
  -not -path './.git/*' | grep -q .; then
  echo "Prohibited debug/local artifacts found." >&2
  find . -type f \( -name '*.bak' -o -name '*.save' -o -name '*.tsbuildinfo' -o -name '*.sqlite' -o -name '*.db' \) -not -path './.git/*'
  exit 1
fi

echo "Working tree is clean and no prohibited artifacts were found."
