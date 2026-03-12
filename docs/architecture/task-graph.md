# Mission Task Graph (Sprint 6.1)

## Why Task Graphs Exist

Mission Execution Engine (Sprint 5.5) tracks bounded execution lifecycle readiness.
Sprint 6.1 introduces a deterministic graph representation of work structure so the system can reason about tasks and dependencies before any execution runtime behavior exists.

Task graph scope in this sprint is structural:

- task nodes
- dependency edges
- deterministic identities
- deterministic state derivation
- append-only history
- projection and artifact materialization

No dispatch, scheduling, retries, queues, or workers are introduced in Sprint 6.1.

## Relationship To Execution Engine

Pipeline position:

- mission
- compatibility
- assignment
- activation
- execution contract
- runtime envelope
- execution attempt
- execution journal
- execution engine
- task graph

Task graph is derived from execution-engine and runtime-envelope projections.
It does not mutate upstream semantic truth and does not execute tasks.

## Sprint 6.1 Deterministic Derivation Rule

Upstream data does not yet provide a rich authored task plan.
For Sprint 6.1, a bounded deterministic derivation is used:

1. Read execution engine run + runtime envelope projections.
2. Build task nodes from `executionEngineRun.runInputs.allowedActions`.
3. If no allowed actions are present, derive a single fallback validation task.
4. Build a linear `finish_to_start` chain across derived nodes.

This rule is explicit, deterministic, and intentionally narrow.
It creates a stable structural graph without speculative planning logic.

## Deterministic Identity

All semantic IDs use:

- `canonicalStringify(...)`
- `sha256(...)`

Task graph identity payload:

- `executionEngineRunId`
- `executionAttemptId`
- `runtimeEnvelopeId`
- `executionContractId`
- `missionId`
- normalized graph structure

Node identity payload:

- `taskGraphId`
- `taskType`
- `taskName`
- normalized task inputs

Edge identity payload:

- `taskGraphId`
- `sourceNodeId`
- `targetNodeId`
- `dependencyType`

Excluded from identity:

- timestamps
- randomness
- process metadata
- filesystem metadata

## Dependency Model

Supported dependency types:

- `finish_to_start`
- `start_to_start`
- `finish_to_finish`

Sprint 6.1 semantics primarily operate on `finish_to_start` for initial ready-state derivation.
Other dependency types validate structurally only in this sprint.

Validation enforces:

- valid node references
- valid dependency types
- no cycles (deterministic DAG check)
- deterministic connectivity rules (no disconnected graph components)

## Node Lifecycle

Node states:

- `pending`
- `ready`
- `running`
- `completed`
- `failed`
- `blocked`
- `skipped`

Initial derivation (Sprint 6.1):

- nodes with no unsatisfied `finish_to_start` dependencies become `ready`
- dependency-waiting nodes remain `pending` with deterministic blocking reasons
- if upstream execution engine is blocked, nodes become `blocked`

No runtime transitions are executed in Sprint 6.1.
Transition event types exist in bounded history schema for forward compatibility.

## Graph Lifecycle

Graph states:

- `initialized`
- `evaluated`
- `ready_for_execution`
- `running`
- `completed`
- `blocked`
- `archived`

Graph state is derived from node states and history signals, not assigned ad hoc.

## Projection-First Truth And Materialization

Truth flow:

1. evaluator derives deterministic structure and status
2. projection composes canonical read model
3. materializer writes artifacts from projection output only

Materialization must never redefine semantic state.

## Artifacts

Artifacts are written to:

- `artifacts/task-graph/<taskGraphId>/`

Files:

- `task-graph-status.json`
- `task-graph-report.json`
- `task-graph-report.md`
- `task-graph-history.json`
- `task-graph-nodes.json`
- `task-graph-edges.json`
