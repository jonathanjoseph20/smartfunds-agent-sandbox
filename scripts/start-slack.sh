#!/usr/bin/env bash
set -euo pipefail

node --experimental-strip-types control-plane/operator/cli.ts "$@"
