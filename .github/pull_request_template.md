## Evidence (required)

```evidence
Risk Tier: <0|1|2|3>
Justification: <why this tier>
Affected Paths: <comma-separated globs or file list>
Tests Added: <what you ran/added, or "N/A" with reason>
Determinism Statement: <why this change is deterministic and reproducible>
```

## Governance checklist

- [ ] Exactly one risk tier label is set: `tier-0`, `tier-1`, `tier-2`, or `tier-3`
- [ ] Evidence block is present and all required fields are populated
- [ ] Evidence `Risk Tier` matches the risk tier label (labels are authoritative)
- [ ] Declared tier is at least as high as the tier implied by changed paths in `control-plane/risk-contract.json`
- [ ] If Tier 3, `tier-3-approved` label is applied
- [ ] If labels/body were updated after a failed run, push a new commit to refresh PR payload (re-run alone can be stale)
