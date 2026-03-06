# Execution Memory Bus

## Why It Exists
Sprint 65 introduces a deterministic execution memory bus so swarm tasks can pass structured state to downstream tasks and phases without hidden mutation.

Before this change, tasks executed in isolation. After this change, each task may emit `context_updates` and the runtime applies those updates to a shared execution context that is threaded through the run.

## Execution Context Model
`ExecutionContext` lives in `control-plane/execution/context-types.ts`:

- `runId: string`
- `missionId?: string`
- `phase: string`
- `taskId: string`
- `memory: Record<string, unknown>`
- `artifacts: string[]`
- `metadata: Record<string, unknown>`

Construction and identity helpers are in `control-plane/execution/execution-context.ts`.

## Merge Semantics
`control-plane/execution/context-merge.ts` implements deterministic merge rules:

- Shallow key replacement only.
- No deep merge.
- Arrays are replaced wholesale.
- Objects are replaced wholesale.
- `undefined` update values are ignored.
- `null` is preserved.

The merge API is pure and returns a new context.

## Runtime Propagation Flow
Swarm runtime flow in `control-plane/swarm/swarm-runner.ts` and `control-plane/swarm/task-executor.ts`:

1. Initialize context for run.
2. Set task identity (`phase`, `taskId`) before each task.
3. Pass frozen read-only context into adapter execution.
4. Apply `TaskResult.context_updates` through merge engine.
5. Emit journal event payload with `task_inputs`, `task_outputs`, `context_snapshot`.
6. Pass updated context to downstream tasks.

## Determinism Guarantees
- Context serialization uses canonical key ordering via `canonicalStringify`.
- No timestamps are stored in context snapshots.
- No random IDs are introduced.
- Task ordering remains deterministic by `(order, taskId)`.
- Empty updates are a no-op at serialized context level.

## Adapter Contract
Adapters receive `TaskContext.executionContext` as a frozen read-only snapshot.

Adapters must not mutate it directly. All state changes must be returned in `TaskResult.context_updates`.

## Journal Snapshot Behavior
No new event types were added. Existing task lifecycle event payloads now include deterministic fields:

- `task_inputs`
- `task_outputs`
- `context_snapshot`

These snapshots are replayable and used by `swarm:inspect` to reconstruct current memory/artifact state.
