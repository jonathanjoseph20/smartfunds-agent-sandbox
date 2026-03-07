#!/usr/bin/env bash
set -euo pipefail

npm --prefix control-plane/cockpit run dev -- --host 0.0.0.0 --port "${SMARTFUNDS_COCKPIT_PORT:-5173}"
