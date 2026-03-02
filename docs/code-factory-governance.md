# Code Factory Governance (Machine-Readable Contract)

## Single source of truth

PR risk governance is defined in `control-plane/risk-contract.json`.

- `tiers`: descriptive metadata and documentation-only `required_checks`
- `paths`: glob-to-tier mappings used to infer minimum required tier from changed files

All CI risk-tier validation must read this contract.

## Labels are authoritative

Canonical labels:

- `tier-0`
- `tier-1`
- `tier-2`
- `tier-3`
- `tier-3-approved` (required when tier is 3)

CI fails if `governance/evidence.json` tier differs from the tier label. Update `governance/evidence.json` to match labels.

## Stale payload rule

GitHub Actions re-runs may use stale PR payload data for labels/evidence. If governance checks still show old data after edits, push a new commit to refresh what CI reads.

## Label bootstrap

If a required label is missing (for example `tier-3`), run the label bootstrap runbook to create or update labels before re-running governance checks. See `docs/runbooks/label-bootstrap.md`.

## Governance failure recovery

Use `docs/runbooks/governance-failure-recovery.md` for step-by-step recovery, including evidence file verification, label checks, bootstrap commands, and stale payload refresh guidance.

## Governance Evidence Contract

Governance evidence is file-based only. The required contract is:

- `governance/evidence.json` must exist.
- PR body is informational only and is not parsed for governance evidence.
- Generate or refresh evidence with:
  - `npm run governance:emit`
- Validate locally with:
  - `npm run governance:preflight`

## Beginner-friendly preflight checklist

1. Add exactly one risk tier label (`tier-0`..`tier-3`).
2. If Tier 3, add `tier-3-approved`.
3. Generate and commit `governance/evidence.json` (`npm run governance:emit`).
4. Ensure `governance/evidence.json` tier equals the tier label.
5. Confirm declared tier is not lower than changed-path tier from `control-plane/risk-contract.json`.
6. Run relevant tests/type checks and include what you ran in `Tests Added`.
7. If a rerun still shows old labels/evidence, push a new commit and rerun.
