tier-3

```evidence
Risk Tier: 3
Justification: Sprint 28 swarm formalization changes in control-plane governance + swarm modules.
Affected Paths: control-plane/cli/governance-preflight.ts, control-plane/governance-check.ts, control-plane/governance/*, control-plane/swarm/*, control-plane/validate-pr.ts
Tests Added: control-plane/__tests__/swarm-contract.test.ts, control-plane/__tests__/governance-report-schema.test.ts
Determinism Statement: No timestamps/UUIDs/randomness; stable parsing + deterministic outputs; tests validate invariants.
```
