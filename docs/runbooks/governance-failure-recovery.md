# Governance Failure Recovery

## Purpose

Provide deterministic, copy/paste recovery steps for governance failures. Governance is profile-native and scope-driven.

## Quick Diagnostics

```bash
gh pr view --json labels --jq '.labels[].name'
gh pr view --json body --jq .body
```

## Common Fixes

- Confirm the changed files should route to the observed profile.
- If optional profile metadata is present, align it with the actual changed scope.
- Review ownership diagnostics as informational only.

## Label Bootstrap

If required labels are missing in the repo, run:

```bash
npm run bootstrap:labels -- --repo owner/name --yes
npm run bootstrap:labels -- --repo owner/name --dry-run
```

## Stale PR Metadata

GitHub Actions re-runs can read stale PR metadata. If you edited PR metadata after a failed run, push a new commit to refresh the PR payload:

```bash
git commit --allow-empty -m "chore: refresh governance"
git push
```

## Local Preflight

Run the local governance preflight:

```bash
npm run governance:preflight
```

## Legacy Metadata Reminder

Legacy tier labels and ` ```evidence ` blocks are tolerated for backward compatibility, but they do not affect governance enforcement.
