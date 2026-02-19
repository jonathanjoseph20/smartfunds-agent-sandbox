## Risk Tier

- [ ] Tier 0
- [ ] Tier 1
- [ ] Tier 2
- [ ] Tier 3

**Tier justification (required):**

<!-- Explain why this risk tier is appropriate for this PR. -->

## Evidence provided

### Tier 0 (required when Tier 0)
- [ ] Lint/typecheck passed for impacted workspace(s)
- [ ] Unit tests passed for impacted workspace(s)

### Tier 1 (required when Tier 1)
- [ ] Unit tests passed for impacted workspace(s)

### Tier 2 (required when Tier 2)
- [ ] Unit tests passed for impacted workspace(s)
- [ ] Integration tests passed for impacted workspace(s)
- [ ] Schema/type validation included when touching exports/doc-factory paths
- [ ] Verifier approval requested

### Tier 3 (required when Tier 3)
- [ ] All Tier 2 evidence provided
- [ ] `tier-3-approved` label applied (maintainers only)
- [ ] Human merge approval requested

## Regression test added?

- [ ] Not a bug fix
- [ ] Yes: regression test added
- [ ] Yes: regression test existed and was updated

If bug fix, include:
- Regression test file + test name:
- Proof of pre-fix failure (log/snippet/link):

## Paths touched

<!-- List key paths changed, e.g. packages/doc-factory/src/*, .github/workflows/* -->

## Known monorepo constraints

CI is workspace-scoped. Do not require whole monorepo checks unless explicitly needed by the change.
