# Cross-Investigation Synthesis Runbook

## Purpose

Use this runbook to inspect deterministic, bounded synthesis across related investigations.

This runbook covers cross-investigation synthesis only.
It does not cover cohorts, swarms, generalized orchestration, dashboards, or Slack loops.

## Commands

List synthesis sets:

```bash
npm run synthesis:list
```

Inspect one synthesis set:

```bash
npm run synthesis:inspect -- --synthesis <synthesisId>
```

Inspect deterministic linking rationale:

```bash
npm run synthesis:links -- --synthesis <synthesisId>
```

Inspect synthesis confidence only:

```bash
npm run synthesis:confidence -- --synthesis <synthesisId>
```

Read synthesis markdown report:

```bash
npm run synthesis:report -- --synthesis <synthesisId>
```

## Operator Interpretation

### Status

- `pending`: synthesis set exists but linked inputs are not yet sufficient.
- `active`: linked investigations exist and synthesis is partially supported but still limited by incomplete readiness.
- `completed`: linked investigations converge with sufficient support and no material unresolved contradiction.
- `inconclusive`: conflicts dominate or aggregate support is too weak to conclude safely.

### Confidence

Inspect:
- `overallBand`
- `supportingFactors[]`
- `weakeningFactors[]`
- `unresolvedConflicts[]`

Do not use `overallBand` alone. Always review weakening factors and unresolved conflicts.

### Reinforcement vs Conflict

Use `synthesis:inspect` output to verify:
- reinforcing investigation IDs
- conflicting investigation IDs
- conflict summaries
- conflicting finding references

Conflicts are intentionally explicit and never hidden.

## Traceability Checks

For each synthesis conclusion, verify:
- linked investigation IDs
- supporting/conflicting finding IDs
- propagated limitations or blocking reasons
- linked reasons (`same protocol=...`, `same signalType=...`)

## Artifact Locations

Synthesis artifacts:
- `artifacts/synthesis/<synthesisId>/synthesis-report.json`
- `artifacts/synthesis/<synthesisId>/synthesis-report.md`

Synthesis event history:
- `syntheses/<YYYY-MM-DD>/synthesis-events.json`

## Operational Boundary

This layer is the substrate for future bounded coordination layers.

Current sprint boundary is strict:
- bounded deterministic cross-investigation synthesis only
- no cohorts
- no swarms
- no generalized orchestration
