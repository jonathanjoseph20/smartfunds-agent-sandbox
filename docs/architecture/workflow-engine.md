# Workflow Engine (Sprint 68)

## Purpose

The workflow engine adds a deterministic DAG orchestration layer between mission/team/agent definitions and runtime task execution.

It upgrades execution from flat or phase-only sequencing to explicit node dependency orchestration while preserving existing runtime and governance invariants.

## Placement in Architecture

Workflow execution flow:

1. Mission selects `workflowId`
2. Workflow loader resolves and validates workflow definition
3. Workflow DAG computes deterministic execution order
4. Workflow runner executes nodes sequentially through an executor seam
5. Executor delegates into existing runtime layers (swarm/agent/task)

The engine does not replace swarm runtime or agent runtime. It only orchestrates node scheduling.

## Model

A workflow definition contains:

- `workflowId`
- `nodes[]`

Each node contains:

- `id` (unique)
- `task`
- optional `agent`
- optional `dependsOn[]`
- optional `phase`

Dependencies create a DAG where edges are `dependency -> dependent`.

## Validation Rules

Validation enforces:

- root schema integrity (`workflowId`, `nodes`)
- node schema integrity (`id`, `task`, optional fields)
- unique node IDs
- valid dependency references
- no self-dependency
- no cycles

Errors are emitted in deterministic sorted order.

## Determinism Guarantees

The subsystem is deterministic by design:

- node IDs and dependencies are sorted lexicographically
- tie-breaks use lexicographic node ID ordering
- topological order is stable for equivalent DAGs
- serialized CLI output uses canonical stringification
- no randomness/timestamps in identity or ordering

## Execution Semantics (Sprint 68)

Execution is sequential-only in Sprint 68:

- runner queries runnable nodes each loop
- if multiple nodes are runnable, it picks the first lexicographically
- one node executes at a time

Parallel execution is intentionally deferred.

## Context Propagation

Each node execution receives:

- `missionId`
- `workflowId`
- `workflowNodeId`
- `task`
- optional `agent`
- `previousOutputs`

`previousOutputs` is a dependency-keyed map of upstream node outputs for downstream consumption.

## Runtime Integration

Primary contract is an injected executor interface (`WorkflowTaskExecutor`).

A thin adapter (`createSwarmWorkflowExecutor`) maps workflow node execution to existing swarm runtime semantics by carrying workflow metadata in run entrypoint/metadata/initial memory without rewriting swarm internals.

## Future Extension

Parallelism can be added later by executing the full runnable set in batches while preserving deterministic batch ordering and output collation rules.
