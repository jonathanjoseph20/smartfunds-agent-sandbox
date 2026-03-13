# Runbook: Mission Review and Decision Operations

## Purpose
Operate mission-level review and operator decisions using deterministic CLI commands.

## Inspect Review State
List active review queue:

```bash
npm run mission-control:review-queue
```

Inspect governance status:

```bash
npm run mission-control:review-status -- --run <missionRunId>
```

Inspect requirement surfaces:

```bash
npm run mission-control:review-requirements -- --run <missionRunId>
```

Inspect decision history/outcome:

```bash
npm run mission-control:decision-history -- --run <missionRunId>
npm run mission-control:decision-outcome -- --run <missionRunId>
```

## Record Operator Decisions
Approve:

```bash
npm run mission-control:approve -- --run <missionRunId> --by operator --reason approved
```

Reject:

```bash
npm run mission-control:reject -- --run <missionRunId> --by operator --reason rejected
```

Defer:

```bash
npm run mission-control:defer-review -- --run <missionRunId> --by operator --reason deferred
```

Request changes:

```bash
npm run mission-control:request-changes -- --run <missionRunId> --by operator --reason changes_requested
```

Force review:

```bash
npm run mission-control:force-review -- --run <missionRunId> --by operator --reason force_review
```

These commands only append review/decision history events. Projection derives current governance posture.

## Materialize Review Artifacts
```bash
npm run mission-control:materialize-review -- --run <missionRunId>
```

Artifacts are written to:
- `artifacts/mission-control/<missionRunId>/mission-review-status.json`
- `artifacts/mission-control/<missionRunId>/mission-review-queue.json`
- `artifacts/mission-control/<missionRunId>/mission-decision-history.json`
- `artifacts/mission-control/<missionRunId>/mission-decision-outcome.json`
- `artifacts/mission-control/<missionRunId>/mission-review-report.json`
- `artifacts/mission-control/<missionRunId>/mission-review-report.md`
- `artifacts/mission-control/<missionRunId>/mission-review-requirements.json`

JSON output is canonical and deterministic.

## Non-Goals Reminder
This operation scope excludes:
- dashboard workflows
- notification integrations
- portfolio governance
- runtime/scheduler/task-execution mutation
