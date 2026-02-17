#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/srv/repos/smartfunds-agent-sandbox"
WRAPPER_DIR="${REPO_ROOT}/ops/templates/bin"

mkdir -p "${WRAPPER_DIR}"

cat > "${WRAPPER_DIR}/cdsf" <<'WRAP'
#!/usr/bin/env bash
set -euo pipefail
cd /srv/repos/smartfunds-agent-sandbox
pwd
git status --short
WRAP

chmod +x "${WRAPPER_DIR}/cdsf"

cat <<MSG
[install_wrappers] Repo-local wrapper generated:
  ${WRAPPER_DIR}/cdsf
[install_wrappers] Add ${WRAPPER_DIR} to PATH manually if desired.
MSG
