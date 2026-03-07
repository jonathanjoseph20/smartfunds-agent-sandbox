#!/usr/bin/env bash
set -euo pipefail

node --experimental-strip-types control-plane/service/server.ts
