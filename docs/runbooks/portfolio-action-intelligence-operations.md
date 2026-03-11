# Portfolio Action Intelligence Operations

## Purpose

This runbook covers deterministic inspection and materialization of portfolio action routing intelligence.

## Commands

List action candidates:

```bash
npm run portfolio-actions:list
```

Inspect a specific action candidate:

```bash
npm run portfolio-actions:inspect -- --action <id>
```

Inspect status and route category:

```bash
npm run portfolio-actions:status -- --action <id>
```

Inspect linked portfolios and rationale:

```bash
npm run portfolio-actions:links -- --action <id>
```

Inspect readiness and blockers:

```bash
npm run portfolio-actions:readiness -- --action <id>
```

Inspect priority and routing reasons:

```bash
npm run portfolio-actions:priority -- --action <id>
```

Inspect append-only history:

```bash
npm run portfolio-actions:history -- --action <id>
```

Materialize artifacts:

```bash
npm run portfolio-actions:materialize -- --action <id>
```

## Interpreting Status

Readiness:
- `pending`: insufficient linked coverage or not started
- `analyzing`: support is accumulating but not stabilized
- `ready`: coherent support and no blockers
- `blocked`: explicit blockers/conflicts/contradictions present

Completion:
- `completed`: action intelligence stabilized
- `incomplete`: still progressing with no decisive contradiction
- `inconclusive`: conflict/contradiction/insufficient reliability

Priority:
- `low` / `normal` / `high` / `critical`

Route categories (descriptive only):
- `monitor`
- `review`
- `escalate`
- `prepare_allocation_review`

Always review:
- `blockingReasons`
- `limitations`
- `rationale`

## Artifact Locations

Per action candidate:
- `artifacts/portfolio-actions/<actionId>/action-status.json`
- `artifacts/portfolio-actions/<actionId>/action-history.json`
- `artifacts/portfolio-actions/<actionId>/action-report.json`
- `artifacts/portfolio-actions/<actionId>/action-report.md`

## Boundary

This layer is routing intelligence only.

Out of scope:
- allocation math
- rebalancing payloads
- execution/trade adapters
- treasury orchestration
- autonomous execution side effects
