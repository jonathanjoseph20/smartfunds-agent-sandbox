# Runtime Feedback Reconciliation Operations (Closed-Loop Propagation)

## Scope

This runbook covers Sprint 8.3 runtime outcome propagation operations.

The propagation layer is deterministic, append-only, projection-first, and additive.

## List Propagation Records

```bash
npm run mission-control:propagation-list
```

## Inspect Propagation Record

```bash
npm run mission-control:propagation-inspect -- --record <runtimeOutcomePropagationRecordId>
```

## Inspect Surface Propagation

```bash
npm run mission-control:propagation-activation -- --record <runtimeOutcomePropagationRecordId>
npm run mission-control:propagation-coordination -- --record <runtimeOutcomePropagationRecordId>
npm run mission-control:propagation-orchestration -- --record <runtimeOutcomePropagationRecordId>
npm run mission-control:propagation-portfolio -- --record <runtimeOutcomePropagationRecordId>
```

## Inspect Status and History

```bash
npm run mission-control:propagation-status -- --record <runtimeOutcomePropagationRecordId>
npm run mission-control:propagation-history -- --record <runtimeOutcomePropagationRecordId>
```

## Materialize Propagation Artifacts

```bash
npm run mission-control:propagation-materialize -- --record <runtimeOutcomePropagationRecordId>
```

Writes under:

- `artifacts/mission-control/propagation/<runtimeOutcomePropagationRecordId>/`

Files:

- `runtime-outcome-propagation-status.json`
- `activation-lifecycle-propagation.json`
- `execution-coordination-propagation.json`
- `mission-orchestration-propagation.json`
- `mission-portfolio-state-propagation.json`
- `runtime-outcome-propagation-history.json`
- `runtime-outcome-propagation-outcome.json`
- `runtime-outcome-propagation-report.json`
- `runtime-outcome-propagation-report.md`

## Bounded Append-Only Actions

```bash
npm run mission-control:propagation-defer -- --record <runtimeOutcomePropagationRecordId>
npm run mission-control:propagation-mark-applied -- --record <runtimeOutcomePropagationRecordId>
npm run mission-control:propagation-mark-complete -- --record <runtimeOutcomePropagationRecordId>
```

## Artifact Interpretation

- Status file reports operational posture only.
- Outcome file reports summarized upstream change result only.
- Surface files show deterministic propagation summaries for activation, coordination, orchestration, and portfolio layers.
- History file is append-only event traceability and replay evidence.
- Report files are projection snapshots for CLI inspection and audit.
