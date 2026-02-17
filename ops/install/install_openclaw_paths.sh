#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/srv/repos/smartfunds-agent-sandbox"
TARGET_PROFILE_SNIPPET="${REPO_ROOT}/ops/templates/openclaw_paths.sh"

cat <<MSG
[install_openclaw_paths] Repo-local installer only.
[install_openclaw_paths] No system-level files will be modified.
[install_openclaw_paths] To apply manually, source:
  source "${TARGET_PROFILE_SNIPPET}"
MSG

mkdir -p "${REPO_ROOT}/ops/templates"
cat > "${TARGET_PROFILE_SNIPPET}" <<'SNIPPET'
# SmartFunds canonical repo helpers
export SMARTFUNDS_REPO="/srv/repos/smartfunds-agent-sandbox"
cdsf() {
  cd "${SMARTFUNDS_REPO}"
}
SNIPPET

echo "[install_openclaw_paths] Wrote ${TARGET_PROFILE_SNIPPET}"
