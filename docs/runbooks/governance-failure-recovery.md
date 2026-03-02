# Governance Failure Recovery

## Purpose

Provide deterministic, copy/paste recovery steps for governance failures. Governance reads PR **body**, not PR comments.

## Quick Diagnostics

```bash
gh pr view --json body --jq .body
gh pr view --json labels --jq '.labels[].name'
```

## Common Fixes

- Add or align tier labels (labels are authoritative).
- Ensure the unfenced `tier-0`..`tier-3` line exists in the PR body.
- Ensure the fenced `evidence` block is present and complete.

## Label Bootstrap

If required labels are missing in the repo, run:

```bash
npm run bootstrap:labels -- --repo owner/name --yes
npm run bootstrap:labels -- --repo owner/name --dry-run
```

## Stale PR Metadata

GitHub Actions re-runs can read stale PR body/labels. If you edited the PR body/labels after a failed run, push a new commit to refresh the PR payload:

```bash
git commit --allow-empty -m "chore: refresh governance"
git push
```

## Local Preflight

Run the local governance preflight against a PR body file:

```bash
npm run governance:check
npm run governance:check -- --body-file path/to/pr-body.md
```

## Evidence Block Reminder

```evidence
Risk Tier: <0|1|2|3>
Justification: <why this tier>
Affected Paths: <comma-separated globs or file list>
Tests Added: <what you ran/added, or "N/A" with reason>
Determinism Statement: <why this change is deterministic and reproducible>
```
