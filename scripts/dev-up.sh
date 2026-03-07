#!/usr/bin/env bash
set -euo pipefail

bash scripts/start-runtime.sh &
RUNTIME_PID=$!

bash scripts/start-cockpit.sh &
COCKPIT_PID=$!

wait $RUNTIME_PID $COCKPIT_PID
