# Execution Journal (Sprint 62)

## Purpose

Execution Journal is the deterministic runtime memory substrate for control-plane execution runs.

It is intentionally limited to append-only event capture and reducer-based state derivation.

## Event Sourcing Model

Journal state is represented by:

- Run metadata: `runtime-data/journal/runs/<runId>.json`
- Ordered events: `runtime-data/journal/events/<runId>.json`

Allowed event types:

- `RUN_CREATED`
- `PHASE_STARTED`
- `PHASE_COMPLETED`
- `TASK_STARTED`
- `TASK_COMPLETED`
- `TASK_FAILED`
- `ARTIFACT_RECORDED`
- `RUN_COMPLETED`
- `RUN_FAILED`

The source of truth is event history, not mutable aggregate state.

## Reducer Architecture

`control-plane/journal/reducer.ts` deterministically derives `RunSummary` from:

- `ExecutionRun`
- ordered `ExecutionEvent[]`

Derived fields:

- `status`
- `currentPhase`
- `lastCompletedPhase`
- `totalEvents`
- `tasksCompleted`
- `tasksFailed`
- `artifactsProduced`

The reducer validates strict sequence ordering before computing summary output.

## Deterministic IDs

No timestamps, UUIDs, or randomness are used.

ID formats:

- Run: `run_<projectId>_<counter>`
- Event: `evt_<runId>_<sequence>`
- Artifact: `art_<runId>_<sequence>`

Counters are zero-padded to 4 digits.

## Run Kinds

Run kind is one of:

- `swarm`
- `mission`
- `maintenance`
- `governance`

## Phase Model

Execution phases are constrained to:

- `plan`
- `setup`
- `implement`
- `verify`
- `test`
- `release`

## Governance Relationship

Run creation resolves `entity`, `pod`, and `mode` from canonical project registry:

- `entities/projects/*.json`

This keeps runtime metadata aligned with governance ownership and mode policy.

## Non-Goals

Execution Journal does not implement:

- orchestration
- scheduling
- retries
- parallel execution
- agent runtime
- Slack or web interfaces
