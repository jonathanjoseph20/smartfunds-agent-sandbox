# Swarm Runner Runbook

## Overview

Swarm runner provides deterministic lifecycle commands:

- create run
- execute run
- inspect run status

All state is recorded in the Execution Journal.

## Create a Run

```bash
npm run swarm:create -- --project control-plane --kind swarm --entrypoint swarm:default
```

Expected behavior:

- validates project from canonical registry
- derives entity/pod/mode from registry metadata
- creates run record in journal
- appends `RUN_CREATED`
- prints JSON summary with status `created`

## Execute a Run

```bash
npm run swarm:run -- --run run_control-plane_0001
```

Expected behavior:

- executes phases in canonical order
- executes tasks in each phase ordered by `order`, then `taskId`
- appends task and phase lifecycle events to journal
- on first task failure emits `TASK_FAILED` then `RUN_FAILED` and stops
- on success emits `RUN_COMPLETED`
- prints final JSON run summary

## Inspect Run Status

```bash
npm run swarm:status -- --run run_control-plane_0001
```

Expected behavior:

- replays journal events for the run
- derives current status/phase/task summaries
- prints deterministic JSON summary

## Failure Signals

When a task fails:

- event stream includes `TASK_FAILED` and terminal `RUN_FAILED`
- no later phase events are emitted
- summary includes `status: failed` and `failedPhase`

## Debugging Failed Runs

1. Inspect run events:

```bash
npm run journal:inspect -- --run run_control-plane_0001
```

2. Confirm failure task + phase ordering.

3. Re-check project metadata resolution:

- project exists in `entities/projects/*.json`
- entity/pod/mode values are valid

## Determinism Guarantees

- fixed phase list and transition order
- stable task sort keys
- append-only journal sequencing
- replay-based state derivation
- deterministic CLI JSON serialization

## Local Verification

```bash
npm install
npm run build
npm test
npm run typecheck
npx vitest run control-plane/swarm/phase-engine.test.ts control-plane/swarm/task-executor.test.ts control-plane/swarm/swarm-runner.test.ts control-plane/cli/swarm-create.test.ts control-plane/cli/swarm-run.test.ts control-plane/cli/swarm-status.test.ts
```
