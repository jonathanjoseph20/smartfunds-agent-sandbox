# Mission Execution Engine Operations

## Scope

This runbook covers Sprint 5.5 execution engine operations:

- list
- inspect
- status
- history
- evaluate readiness
- start
- complete
- fail
- cancel
- materialize

All commands emit canonical JSON with stable error payloads:

- `{ "error": "message" }`

## Prerequisite

A mission must already have an execution journal-ready attempt.

Typical upstream chain:

- `team-compatibility:evaluate`
- `mission-assignment:confirm`
- `mission-activation:evaluate`
- `execution-contract:evaluate`
- `runtime-envelope:confirm`
- `execution-attempt:create`
- `execution-journal:evaluate`

## List Engine Runs

```bash
npm run execution-engine:list
```

Output includes:

- `executionEngineRunId`
- `executionAttemptId`
- `engineState`
- `engineEligibilityState`
- `runMode`

## Inspect Engine Run

```bash
npm run execution-engine:inspect -- --attempt <executionAttemptId>
```

Returns full projected `MissionExecutionEngineRun` with history summary and artifacts metadata.

## Engine Status

```bash
npm run execution-engine:status -- --attempt <executionAttemptId>
```

Use for fast readiness and lifecycle checks.

## Engine History

```bash
npm run execution-engine:history -- --attempt <executionAttemptId>
```

Returns append-only engine history entries.

## Evaluate Readiness

```bash
npm run execution-engine:evaluate -- --attempt <executionAttemptId>
npm run execution-engine:evaluate -- --attempt <executionAttemptId> --policy <enginePolicyId>
```

Appends deterministic initialization/readiness history entries and returns projected run truth.

## Start Engine Run

```bash
npm run execution-engine:start -- --attempt <executionAttemptId>
```

Effects:

- enforces transition rules
- appends `engine_run_started` to engine history
- appends `execution_started` to execution journal history

## Complete Engine Run

```bash
npm run execution-engine:complete -- --attempt <executionAttemptId>
```

Effects:

- enforces transition rules
- appends `engine_run_completed`
- appends `execution_completed`

## Fail Engine Run

```bash
npm run execution-engine:fail -- --attempt <executionAttemptId> --reason-file <path>
```

Effects:

- enforces transition rules
- appends `engine_run_failed`
- appends `execution_failed`

## Cancel Engine Run

```bash
npm run execution-engine:cancel -- --attempt <executionAttemptId> --reason-file <path>
```

Effects:

- enforces transition rules
- appends `engine_run_cancelled`
- appends `execution_cancelled`

## Materialize Artifacts

```bash
npm run execution-engine:materialize -- --attempt <executionAttemptId>
```

Writes deterministic projection artifacts to:

- `artifacts/execution-engine/<executionEngineRunId>/`

## Diagnose Blocked Runs

If status indicates blocked or waiting:

1. inspect `blockingReasons` and `limitations` from `execution-engine:status`
2. inspect linked execution journal state
3. inspect upstream runtime envelope and execution contract eligibility

## Determinism Checks

1. run `execution-engine:evaluate` twice with identical inputs
2. run `execution-engine:materialize` twice
3. verify stable `executionEngineRunId`, status payloads, and artifact file contents
