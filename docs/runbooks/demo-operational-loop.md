# Operational Demo Loop Runbook

## Purpose
Provide a deterministic, operator-ready workflow for the 3-cycle demo loop.

## Demo Prep
Run from repo root:
- `npm run demo:prepare`

## Governance Workflow Commands
If present in `package.json`, run the following after each cycle:
- `npm run governance:generate`
- `npm run governance:normalize`
- `npm run governance:preflight`
- `npm run pr:create`
- `npm run pr:verify`
- `npm run pr:refresh-metadata`

## Verify PR Body + Labels (GitHub CLI)
Ensure the PR body has an unfenced tier line and evidence block, and that tier labels are applied.
Example commands (replace PR number):
- `gh pr view 123 --json body --jq '.body'`
- `gh pr view 123 --json labels --jq '.labels[].name'`

## Refresh Metadata (Empty Commit)
If governance reports stale metadata:
- `npm run pr:refresh-metadata`

## Expected CI Checks
Green means:
- Governance checks pass
- Unit tests pass
- Type checks (if configured) pass

## Recovery
- If `demo:prepare` fails, address the printed remediation and re-run.
- If tests fail, fix locally and rerun the workspace tests.
- If governance preflight fails, follow the next-action guidance in its output.
