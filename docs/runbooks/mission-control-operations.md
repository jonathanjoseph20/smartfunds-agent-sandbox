# Mission Control Operations

## Scope

This runbook covers mission-level operational inspection and artifact materialization via the Mission Control layer.

Mission Control is read-only over runtime semantics.

## Commands

List mission runs:

```bash
npm run mission-control:list
```

Inspect a mission run:

```bash
npm run mission-control:inspect -- --run <missionRunId>
```

Inspect operational status:

```bash
npm run mission-control:status -- --run <missionRunId>
```

Inspect progress:

```bash
npm run mission-control:progress -- --run <missionRunId>
```

Inspect health posture:

```bash
npm run mission-control:health -- --run <missionRunId>
```

Inspect completion posture:

```bash
npm run mission-control:completion -- --run <missionRunId>
```

Inspect escalations:

```bash
npm run mission-control:escalations -- --run <missionRunId>
```

Inspect append-only mission history:

```bash
npm run mission-control:history -- --run <missionRunId>
```

Materialize mission control artifacts:

```bash
npm run mission-control:materialize -- --run <missionRunId>
```

## Interpreting Status Surfaces

Operational state:

- current runtime posture (`active`, `retrying`, `blocked`, etc.)

Completion state:

- outcome posture (`completed`, `failed`, `partially_complete`, etc.)

Health state:

- trust/stability posture (`healthy`, `degraded`, `unstable`, etc.)

Treat these as separate signals.

## Escalation Handling

Common escalation classes:

- retry_exhaustion
- terminal_node_failure
- orchestration_deadlock
- worker_capacity_exhausted
- worker_compatibility_gap
- policy_failure
- unresolved_blocking_chain

Use escalation `reasonTokens`, linked node IDs, and linked execution IDs to trace root cause in lower runtime layers.

## Report Generation

`mission-control:materialize` writes deterministic artifacts to:

- `artifacts/mission-control/<missionRunId>/`

Re-running materialization with unchanged semantic inputs should produce byte-stable outputs.

## Determinism Checks

1. Run `mission-control:inspect` twice for the same run ID.
2. Run `mission-control:materialize` twice for the same run ID.
3. Verify mission-run ID, status/progress/escalation output, and artifact contents remain stable.
