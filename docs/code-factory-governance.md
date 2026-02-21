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

CI fails if the PR body evidence tier differs from the tier label. Update the PR body to match the label.

## Stale payload rule

GitHub Actions re-runs may use stale PR payload data for labels/body. If governance checks still show old labels/body after edits, push a new commit to refresh what CI reads.

## Required Evidence block format

Every PR body must include this fenced block exactly:

```evidence
Risk Tier: <0|1|2|3>
Justification: <why this tier>
Affected Paths: <comma-separated globs or file list>
Tests Added: <what you ran/added, or "N/A" with reason>
Determinism Statement: <why this change is deterministic and reproducible>
```

## Tier examples

### Tier 0 (docs-only)

```evidence
Risk Tier: 0
Justification: Updates governance documentation only.
Affected Paths: docs/code-factory-governance.md
Tests Added: N/A (docs-only change)
Determinism Statement: No runtime behavior changed.
```

### Tier 1 (low-risk app surface)

```evidence
Risk Tier: 1
Justification: API route validation refinement without control-plane impact.
Affected Paths: apps/api/src/index.ts
Tests Added: npm --workspace @smartfunds/api run test
Determinism Statement: Assertions are deterministic and do not depend on external services.
```

### Tier 2 (core package)

```evidence
Risk Tier: 2
Justification: Mission-engine transition guard update.
Affected Paths: packages/mission-engine/src/transitions.ts
Tests Added: npm --workspace @smartfunds/mission-engine run test
Determinism Statement: In-memory SQLite fixtures and deterministic state assertions.
```

### Tier 3 (control-plane/policy/shared)

```evidence
Risk Tier: 3
Justification: Governance validator update under control-plane.
Affected Paths: control-plane/validate-pr.ts, control-plane/risk-contract.json
Tests Added: npx vitest run control-plane/validate-pr.test.ts
Determinism Statement: Pure parser/inference logic with mocked PR payload data.
```

## Beginner-friendly preflight checklist

1. Add exactly one risk tier label (`tier-0`..`tier-3`).
2. If Tier 3, add `tier-3-approved`.
3. Paste the required `evidence` block and fill every field.
4. Ensure the `Risk Tier` value in the evidence block equals the tier label.
5. Confirm declared tier is not lower than changed-path tier from `control-plane/risk-contract.json`.
6. Run relevant tests/type checks and include what you ran in `Tests Added`.
7. If a rerun still shows old labels/body, push a new commit and rerun.


