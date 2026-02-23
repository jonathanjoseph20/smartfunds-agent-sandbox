# Label Bootstrap Runbook

## Purpose

Ensure required governance labels exist so tier enforcement cannot fail with "label not found" errors. The script is idempotent and safe to run multiple times.

## Requirements

- A GitHub token with label management permissions.
  - Public repos: `public_repo` scope (classic) or equivalent fine-grained permissions.
  - Private repos: `repo` scope (classic) or equivalent fine-grained permissions.
- If running in GitHub Actions, ensure workflow permissions include `contents: read` and `issues: write` (labels are treated as issue metadata).

## Local Usage (Codespaces)

```bash
export GITHUB_TOKEN="..."

npm run bootstrap:labels -- --repo jonathanjoseph20/smartfunds-agent-sandbox --yes
npm run bootstrap:labels -- --repo jonathanjoseph20/smartfunds-agent-sandbox --dry-run
```

## Verification

```bash
gh label list --limit 200 | egrep 'tier-0|tier-1|tier-2|tier-3|tier-3-approved'
```

## Notes

- Use `--dry-run` to see planned changes without mutations.
- `--yes` skips the interactive confirmation prompt.
- If `--repo` is omitted, the script uses `GITHUB_REPOSITORY`.
