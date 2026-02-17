# Antfarm PR Pipeline Hardening (VPS)

This change records the minimal operational hardening applied directly on the VPS host to improve non-interactive Antfarm workflow reliability.

## Host-side files created/updated

- `/root/openclaw/bin/create_pr.sh`
- `/etc/profile.d/openclaw_path.sh`
- `/usr/local/bin/antfarm`
- `/usr/local/bin/gh`
- `/usr/local/bin/antfarm-run`
- `/root/.openclaw/antfarm/workflows/feature-dev/workflow.yml`
- `/workspace/openclaw-agent-sandbox/{package.json,server.js,server.test.js}` (only if missing)

## What was hardened

1. Added robust PR creation script with safety checks:
   - verifies repo context
   - checks `gh` availability and auth
   - requires `origin` remote
   - no-op when no changes
   - auto-detects base branch
   - creates feature branch, commit, push, and PR

2. Added PATH guard for login shells:
   - `/etc/profile.d/openclaw_path.sh` prepends `/root/openclaw/bin` and `/usr/local/bin`

3. Added non-interactive command visibility wrappers:
   - `/usr/local/bin/antfarm` -> delegates to `/root/openclaw/bin/antfarm`
   - `/usr/local/bin/gh` -> delegates to `/root/openclaw/bin/gh` or `/usr/bin/gh.real`

4. Updated workflow `pr` step to execute:
   - `bash -lc 'cd /workspace/openclaw-agent-sandbox && /root/openclaw/bin/create_pr.sh ...'`

5. Added observability wrapper:
   - `/usr/local/bin/antfarm-run`
   - writes run logs under `/workspace/openclaw-agent-sandbox/.runs/<timestamp>/run.log`
   - writes heartbeat updates to `heartbeat.txt`

## Validation summary

- `command -v antfarm` and `command -v gh` resolve to `/usr/local/bin/*` wrappers.
- Workflow schema validation (Python + yaml) passes: agents list + `workspace.baseDir` for all agents.
- Sandbox repo tests pass for `/health` and `/version`.
- `antfarm-run ...` creates run directory + `run.log` + `heartbeat.txt`.

## Current blocker in this container snapshot

The underlying host binaries are still absent:
- `/root/openclaw/bin/antfarm`
- `/root/openclaw/bin/gh` (or equivalent real `gh` binary)

So wrapper invocation currently exits non-zero until those binaries are present.
