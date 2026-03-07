# Workflow Observability Layer (Sprint 69)

## Purpose

The workflow observability layer provides deterministic, operator-facing read models derived from existing runtime artifacts.

It is additive and projection-only:

- source-of-truth remains execution journal events
- workflow definitions remain source for dependency topology
- execution context snapshots remain source for context state

No second mutable runtime state is introduced.

## Read Models

### WorkflowRunRecord

`WorkflowRunRecord` is projected from run metadata + ordered journal events + node records.

It exposes:

- run/workflow/mission/team/project identity
- run status and sequence boundaries
- node completion/failure counts
- active node signal
- deterministic agent roster
- structured summary object

### WorkflowNodeRecord

`WorkflowNodeRecord` is projected from `TASK_*` events and workflow node definitions.

It exposes:

- node execution status and sequence boundaries
- dependsOn (deterministic ordering)
- agent/adapter metadata
- task inputs and outputs
- previous outputs and context snapshot
- normalized failure record when present

## Trace Model

`buildWorkflowTrace` derives ordered trace entries directly from journal sequence.

Entry types:

- `RUN_STARTED`
- `NODE_BECAME_RUNNABLE`
- `NODE_STARTED`
- `NODE_COMPLETED`
- `NODE_FAILED`
- `RUN_COMPLETED`
- `RUN_FAILED`

Trace ordering is sequence-first and deterministic. Duplicate trace entries are removed by deterministic keying.

## Failure Diagnostics

`failure-types.ts` defines deterministic failure categories and normalized failure records:

- `DEPENDENCY_UNSATISFIED`
- `AGENT_RESOLUTION_FAILED`
- `TOOL_PERMISSION_DENIED`
- `ADAPTER_EXECUTION_FAILED`
- `TASK_RESULT_INVALID`
- `CONTEXT_MERGE_FAILED`
- `WORKFLOW_VALIDATION_FAILED`
- `UNKNOWN_RUNTIME_FAILURE`

Failure details are structured JSON. Optional remediation hints are rule-based and deterministic.

## Determinism

The layer reuses canonical serialization (`canonicalStringify`) and deterministic sorting/normalization helpers:

- stable key ordering
- stable list ordering
- no time/random identity
- JSON-first outputs

## Relationship to Workflow Runtime

The layer does not change:

- DAG scheduling semantics
- workflow runner sequencing
- journal append model
- agent profile schema

It only reads runtime artifacts and builds deterministic operator projections.
