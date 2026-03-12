# Task Concurrency Operations

## Purpose

Inspect deterministic scheduling decisions produced by task execution runtime in Sprint 6.4.

## Commands

- `npm run task-execution:runnable -- --graph <taskGraphId>`
- `npm run task-execution:concurrency-status -- --graph <taskGraphId>`
- `npm run task-execution:schedule-wave -- --graph <taskGraphId>`
- `npm run task-execution:concurrency-history -- --graph <taskGraphId>`

All outputs are canonical JSON.

## Interpreting Outputs

Runnable set:
- candidate nodes for scheduling in current cycle
- excludes blocked/running/retry-waiting/completed nodes

Concurrency status:
- current policy and slot capacity
- runnable/scheduled/deferred counts
- wave index and scheduling state

Schedule wave preview:
- deterministic wave split into scheduled/deferred nodes

Concurrency history:
- append-only record of wave evaluation, slot allocation, scheduling, deferral, and completion events

## Artifact Files

Per execution run (`artifacts/task-execution/<executionEngineRunId>/`):
- `task-execution-concurrency.json`
- `task-execution-runnable-set.json`
- `task-execution-scheduling-waves.json`

Existing status/report/history artifacts also include concurrency metadata.

## Deferred vs Blocked

- Deferred: runnable but not scheduled due to slot limit in current wave.
- Blocked: not runnable due to lifecycle/dependency/failure state.

## Simulation-Only Guardrail

Sprint 6.4 does not dispatch work to workers.
Scheduling results are deterministic simulation state transitions within the engine loop.
