# Task Adapter Layer (Sprint 64)

## Purpose

Sprint 64 introduces a task adapter execution boundary between swarm orchestration and task implementations.

Layering after this sprint:

Governance Layer
-> Project / Control Plane
-> Execution Journal
-> Swarm Runtime Engine
-> Task Adapter Layer
-> Task Implementations

The swarm runtime remains responsible for run/phase/task orchestration and journal lifecycle events.
The adapter layer is responsible for deterministic execution behavior per `task.type`.

## Orchestration vs Execution Boundary

Swarm runtime (`control-plane/swarm/*`) now:

- builds `TaskContext` from run/phase/task metadata
- resolves adapter by `task.type` via deterministic registry
- calls `await adapter.execute(context)`
- emits `TASK_STARTED`, `TASK_COMPLETED`, `TASK_FAILED`
- preserves existing stop-on-first-failure semantics

Task adapters (`control-plane/tasks/adapters/*`) now:

- consume typed task context
- return deterministic `TaskResult`
- avoid hidden side effects and nondeterministic output

## Core Contract

- `TaskType`: `"llm" | "shell" | "repo"`
- `TaskContext`:
  - `runId`, `phase`, `taskId`, `taskType`
  - `inputs`
  - `executionContext`
- `TaskResult`:
  - `status`: `success | failed`
  - `outputs`
  - `artifacts`
  - `logs`
  - optional `errorCode`, `errorMessage`

## Registry Design

Sprint 64 uses a static in-repo registry (`adapter-registry.ts`):

- no filesystem discovery
- no runtime plugin loading
- deterministic mapping from task type to adapter instance
- stable explicit error for unknown types

Registered adapters:

- `llm`
- `shell`
- `repo`

## Adapter Scope in Sprint 64

- `llm`: deterministic mock/stub only; no network calls
- `shell`: local command execution with deterministic output normalization
- `repo`: minimal deterministic file operations with repo-root path safety

## Determinism Rules

Task adapters and dispatch enforce:

- no randomness or timestamp identity
- stable task sort (`order`, then `taskId`)
- normalized line endings for shell/repo text output
- sorted directory listings for `list_dir`
- stable failure messages/codes

## Forward Compatibility

This boundary is foundational for:

- Sprint 65: Execution Memory Bus
- Sprint 66: Declarative Workflow Specs
- Sprint 67: Agent Runtime Integration

Sprint 64 intentionally does not include autonomy, distributed execution, workflow DSL, or external model APIs.
