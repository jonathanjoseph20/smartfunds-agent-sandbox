# Activation Runtime Integration Operations

## Scope

This runbook covers Sprint 8.2 runtime-dispatch integration operations.

This layer is deterministic, append-only, and projection-first.

## List Runtime Dispatch Attempts

```bash
npm run mission-control:runtime-dispatch-list
```

## Inspect Runtime Dispatch Attempt

```bash
npm run mission-control:runtime-dispatch-inspect -- --attempt <activationDispatchAttemptId>
```

## Inspect Dispatch Queue Posture

```bash
npm run mission-control:runtime-dispatch-queue -- --attempt <activationDispatchAttemptId>
```

## Inspect Runtime Links

```bash
npm run mission-control:runtime-links -- --attempt <activationDispatchAttemptId>
```

## Inspect Runtime Feedback Ingestion

```bash
npm run mission-control:runtime-feedback -- --attempt <activationDispatchAttemptId>
```

## Inspect Reconciliation

```bash
npm run mission-control:runtime-reconciliation -- --attempt <activationDispatchAttemptId>
```

## Inspect Status and History

```bash
npm run mission-control:runtime-status -- --attempt <activationDispatchAttemptId>
npm run mission-control:runtime-history -- --attempt <activationDispatchAttemptId>
```

## Materialize Runtime Integration Artifacts

```bash
npm run mission-control:runtime-materialize -- --attempt <activationDispatchAttemptId>
```

Writes under:

- `artifacts/mission-control/runtime-integration/<activationDispatchAttemptId>/`

Files:

- `activation-runtime-dispatch-status.json`
- `activation-runtime-dispatch-queue.json`
- `activation-runtime-links.json`
- `activation-runtime-feedback-ingestion.json`
- `activation-runtime-reconciliation.json`
- `activation-runtime-history.json`
- `activation-runtime-outcome.json`
- `activation-runtime-report.json`
- `activation-runtime-report.md`

## Optional Append-Only Control Actions

```bash
npm run mission-control:runtime-defer -- --attempt <activationDispatchAttemptId>
npm run mission-control:runtime-mark-submitted -- --attempt <activationDispatchAttemptId>
npm run mission-control:runtime-mark-complete -- --attempt <activationDispatchAttemptId>
```

## Reading Reconciliation State

- `feedback_applied`: feedback set is coherent and applied.
- `feedback_conflict`: conflicting terminal feedback observed.
- `feedback_incomplete`: no feedback available yet.
- `feedback_deferred`: feedback indicates deferred/retrying posture.
- `feedback_inconclusive`: feedback cannot produce a conclusive runtime posture.

## Troubleshooting

1. Inspect runtime status and dispatch queue first.
2. Inspect runtime links and feedback ingestion records for missing runtime IDs.
3. Inspect reconciliation for conflict/incomplete/inconclusive classification.
4. Replay and inspect integration history for append-only event traceability.
