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

## Normalize PR Body (Optional but Recommended)

npm run governance:normalize -- .pr-body.md

Ensures deterministic formatting and correct tier/evidence structure.

## Run Governance Preflight

npm run governance:preflight

Runs governance validation checks before PR creation.

## Create PR (Blessed Path)

npm run pr:create -- --body-file .pr-body.md

This command:

- Validates the PR body
- Ensures gh CLI is available
- Ensures gh is authenticated
- Creates the PR
- Verifies the PR body on GitHub

## Verify PR After Creation

npm run pr:verify

Re-validates PR body and confirms correct tier detection.

## Refresh PR Metadata (If CI Reads Stale Data)

npm run pr:refresh-metadata

If CI still reads stale data, run:

git commit --allow-empty -m "chore: refresh metadata"
git push

## Manually Inspect PR Body

gh pr view --json body --jq .body

Confirms PR body matches required contract.

## Merge Checklist

- CI is green
- Correct tier label applied
- Evidence block present
- No unintended file changes
