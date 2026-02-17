# VPS Fix Notes: Antfarm `feature-dev` workflow and `/version` endpoint

Applied on host paths:
- `/root/.openclaw/antfarm/workflows/feature-dev/workflow.yml`
- `/workspace/openclaw-agent-sandbox`

## What was done
1. Replaced `workflow.yml` with schema-compliant `agents` list and `workspace.baseDir: /workspace/openclaw-agent-sandbox` for all agents.
2. Bootstrapped `/workspace/openclaw-agent-sandbox` as a git repo.
3. Created baseline app on `main` with `GET /health`.
4. Created branch `feature/version-endpoint` and added `GET /version` returning `{ "version": "1.0.0" }`.
5. Added Node test coverage for `/version`.

## Current blockers
- `antfarm` binary is not installed on this host PATH.
- `gh` binary is not installed on this host PATH.

These blockers prevent running the Antfarm workflow and opening a GitHub PR from this environment.
