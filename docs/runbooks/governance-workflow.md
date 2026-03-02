# Governance Workflow Runbook

## Preconditions

- Node installed
- npm installed
- GitHub CLI (gh) installed
- gh authenticated (run: gh auth login if needed)

## Create a New Branch

git checkout main
git pull
git checkout -b feature-branch-name

## Emit Governance Evidence (Required)

npm run governance:emit

Writes canonical `governance/evidence.json`.

## Run Governance Preflight

npm run governance:preflight

Runs governance validation checks before PR creation.

## Create PR (Blessed Path)

npm run pr:create -- --body-file .pr-body.md

This command:

- Validates local metadata
- Ensures gh CLI is available
- Ensures gh is authenticated
- Creates the PR
- Verifies metadata on GitHub

## Verify PR After Creation

npm run pr:verify

Re-validates governance metadata and confirms correct tier detection.

## Refresh PR Metadata (If CI Reads Stale Data)

npm run pr:refresh-metadata

If CI still reads stale data, run:

git commit --allow-empty -m "chore: refresh metadata"
git push

## Validate Evidence Contract

npm run governance:preflight

Confirms `governance/evidence.json` and labels match the required contract.

## Merge Checklist

- CI is green
- Correct tier label applied
- `governance/evidence.json` present and valid
- No unintended file changes
