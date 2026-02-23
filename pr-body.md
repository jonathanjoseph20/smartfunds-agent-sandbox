tier-3

```evidence
Risk Tier: 3
Justification: Governance diagnostics, local preflight, and CI summary updates across control-plane and workflow.
Affected Paths: control-plane/validate-pr.ts, control-plane/governance/diagnostics.ts, control-plane/governance-check.ts, .github/workflows/code-factory.yml, docs/code-factory-governance.md, docs/runbooks/governance-failure-recovery.md, package.json
Tests Added: npm test; npx vitest run control-plane/validate-pr.test.ts control-plane/governance-check.test.ts control-plane/governance/diagnostics.test.ts control-plane/__tests__/risk-contract.test.ts
Determinism Statement: Deterministic parsing and sorted outputs; no randomness or external state mutation.
```
