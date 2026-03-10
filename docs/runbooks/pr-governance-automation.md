# PR Governance Automation Runbook

## Model

- Governance routing is profile-native and scope-driven.
- PR body metadata is optional. If present, `profile: lite|build|core` is the only governance input that may influence requested profile.
- Legacy tier labels and ` ```evidence ` blocks are tolerated but ignored by enforcement.

## Bootstrap Labels

```bash
npm run bootstrap:labels -- --yes
```

Dry-run:

```bash
npm run bootstrap:labels -- --dry-run --yes
```

Expected output shape:

- `created: ...`
- `updated: ...`
- `unchanged: ...`

Missing auth returns exit code `2` and message:

- `Missing GITHUB_TOKEN or GH_TOKEN environment variable.`

## Deterministic Sprint PR Helper

Generate canonical files only:

```bash
npm run sprint-pr -- --tier 1 --no-create
```

Generate and create/update PR:

```bash
npm run sprint-pr -- --tier 1 --title "chore: sprint 81 governance hardening"
```

What helper orchestrates:

1. optional PR body generation/normalization
2. `governance:preflight`
3. `pr:body:check`
4. optional `pr:create` + `pr:verify`

## Verify PR Body on GitHub

Canonical command:

```bash
gh pr view --json body --jq .body
```

## Stale Metadata Recovery

GitHub reruns can use stale PR metadata. A new push is required to refresh payload.

Use:

```bash
npm run pr:refresh-metadata
```

## Human Responsibilities

- Provide an accurate PR summary and, if used, accurate requested profile metadata.
- Ensure tests and validation outputs are accurate.
- Push a fresh commit when metadata refresh is needed.
