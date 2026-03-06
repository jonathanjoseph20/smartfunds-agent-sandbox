# Task Adapters Runbook

## Overview

Task adapters provide deterministic task execution for the swarm runtime.
Swarm runner dispatches by `task.type` and records lifecycle events in the execution journal.

## Dispatch Flow

1. Swarm runner enters phase.
2. Tasks are sorted by `order`, then `taskId`.
3. For each task:
   - emit `TASK_STARTED`
   - build `TaskContext`
   - resolve adapter from registry
   - execute adapter
   - emit `TASK_COMPLETED` or `TASK_FAILED`
4. On first task failure, phase/run fail and later phases are not executed.

## Current Task Types

- `llm`
- `shell`
- `repo`

## Adding a New Adapter

1. Add adapter implementation under `control-plane/tasks/adapters/`.
2. Implement `AgentTaskAdapter` with:
   - `type`
   - `execute(context): Promise<TaskResult>`
3. Export from `control-plane/tasks/adapters/index.ts`.
4. Register it in `control-plane/tasks/adapter-registry.ts`.
5. Add unit tests under `control-plane/tasks/tests/`.
6. Add swarm integration coverage for dispatch and journal payloads.

## TaskContext / TaskResult Expectations

`TaskContext` fields:

- `runId`
- `phase`
- `taskId`
- `taskType`
- `inputs`
- `executionContext`

`TaskResult` fields:

- `status`
- `outputs`
- `artifacts`
- `logs`
- optional `errorCode`, `errorMessage`

## Determinism Checklist

Before merging adapter changes:

- no random values, UUIDs, or timestamps in outputs
- stable object/list ordering
- normalized line endings for textual outputs
- deterministic error codes/messages
- no external network dependency unless explicitly allowed by sprint scope

## Repo Adapter Safety Checklist

- reject absolute paths
- reject traversal outside repo root
- operate only on repo-relative paths
- return sorted `list_dir` output

## Debugging Adapter Execution

1. Run relevant adapter tests:

```bash
npx vitest run control-plane/tasks/tests/*.test.ts
```

2. Inspect swarm execution journal for lifecycle payloads:

```bash
npm run journal:inspect -- --run <run-id>
```

3. Validate task event sequence:

- `TASK_STARTED`
- `TASK_COMPLETED` or `TASK_FAILED`

4. Confirm runner stop behavior on first failure.

## Common Failure Modes

- `ERR_TASK_ADAPTER_NOT_FOUND`: task type missing from static registry
- `ERR_SHELL_COMMAND_REQUIRED`: shell task missing `command`
- `ERR_REPO_PATH_ABSOLUTE`: repo task passed absolute path
- `ERR_REPO_PATH_TRAVERSAL`: repo task path escaped repo root
- adapter-level failure result: `TASK_FAILED` emitted and run stops per current semantics
