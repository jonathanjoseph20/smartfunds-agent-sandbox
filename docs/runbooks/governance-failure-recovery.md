# Governance Failure Recovery

## Purpose

Provide deterministic, copy/paste recovery steps for governance failures. Governance reads `governance/evidence.json`; PR body is informational only.

## Quick Diagnostics

```bash
cat governance/evidence.json
gh pr view --json labels --jq '.labels[].name'
```

## Common Fixes

- Add or align tier labels (labels are authoritative).
- Ensure `governance/evidence.json` exists and is valid.
- Ensure `governance/evidence.json` tier matches the applied label.

## Label Bootstrap

If required labels are missing in the repo, run:

```bash
npm run bootstrap:labels -- --repo owner/name --yes
npm run bootstrap:labels -- --repo owner/name --dry-run
```

## Stale PR Metadata

GitHub Actions re-runs can read stale evidence/labels. If you edited `governance/evidence.json` or labels after a failed run, push a new commit to refresh the PR payload:

```bash
git commit --allow-empty -m "chore: refresh governance"
git push
```

## Local Preflight

Run the local governance preflight:

```bash
npm run governance:preflight
```

## Evidence File Reminder

```bash
npm run governance:emit
npm run governance:preflight
```
