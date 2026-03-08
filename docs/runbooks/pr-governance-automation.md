# PR Governance Automation Runbook

## Model

- PR labels are authoritative for tier detection once present.
- PR body is still mandatory and must include:
  - exactly one unfenced `tier-0|tier-1|tier-2|tier-3` line
  - exactly one fenced ```evidence block

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

## Auto-Apply Tier Label From PR Body

```bash
export GITHUB_TOKEN="$(gh auth token)"
export GITHUB_REPOSITORY="<owner>/<repo>"
export GITHUB_EVENT_PATH="<event-json-path>" # in CI this is provided
npm run governance:auto-label
```

Expected output:

- `Applied tier label from PR body: tier-X`
- or `Tier label already present: tier-X`

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

1. `governance:generate`
2. `governance:normalize`
3. `governance:preflight`
4. `pr:body:check`
5. optional `bootstrap:labels`
6. optional `pr:create` + `pr:verify`

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

- Provide correct risk tier intent.
- Ensure evidence fields are accurate and complete.
- Apply `tier-3-approved` when required by governance policy.
- Push a fresh commit when metadata refresh is needed.
