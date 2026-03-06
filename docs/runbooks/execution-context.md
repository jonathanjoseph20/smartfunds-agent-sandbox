# Execution Context Runbook

## Purpose
Use this runbook to debug deterministic context propagation in swarm runs.

## Inspect a Run
Run:

```bash
npm run swarm:inspect -- --run <runId>
```

Output includes:

- `runId`
- `currentPhase`
- `tasks`
- `context.memory`
- `context.artifacts`
- `context.metadata`

All output is canonical JSON with stable ordering.

## Expected `context_updates` Shape
Each task can return:

```ts
{
  context_updates: {
    key_name: value
  }
}
```

Rules:

- Keys must be deterministic strings.
- Values must be structured JSON-compatible data.
- No direct context mutation.

## Debugging Propagation
If downstream tasks do not see expected values:

1. Inspect `TASK_COMPLETED` payload for upstream task and verify `task_outputs` and `context_snapshot`.
2. Inspect `TASK_STARTED` payload for downstream task and verify `context_snapshot.memory` includes expected keys.
3. Check that upstream adapter returned `context_updates` (not only `outputs`).

## Common Failure Modes
- Returning data in `outputs` but not `context_updates`.
- Attempting to mutate `executionContext` directly inside adapter (blocked by frozen snapshot).
- Assuming deep-merge behavior for object/array values.

## Determinism Pitfalls to Avoid
- Do not add timestamps to context snapshots.
- Do not depend on filesystem enumeration order.
- Do not depend on object insertion order from non-canonical sources.
- Do not add random identifiers to context state.

## Best Practices
- Keep `context_updates` small and explicit.
- Use stable key names for memory fields.
- Prefer one logical update payload per task.
- Validate context flow with `swarm:inspect` and task lifecycle journal events.
