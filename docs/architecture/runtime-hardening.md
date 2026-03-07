# Runtime Hardening Layer

## Why Sprint 70 Exists
Sprint 70 hardens workflow runtime behavior so node/workflow execution can fail, retry, timeout, recover, and cancel in deterministic and replayable ways.

## Sprint 71 Canonical Integration
Sprint 71 makes hardened execution the default workflow path.

Canonical path:
- Swarm Runtime / Workflow CLI
- `runWorkflowWithHardening(...)`
- Retry Scheduler
- Timeout Policy
- Safety Limits
- Journal + Observability Projections

## Architectural Placement
Governance -> Project Registry -> Mission Contracts -> Team Definitions -> Agent Profiles -> Agent Runtime -> Workflow DAG Engine -> Runtime Hardening -> Observability -> Swarm Runtime -> Execution Memory Bus -> Task Adapters.

## Core Components
- `control-plane/runtime/failure-states.ts`: Canonical node/workflow runtime states and deterministic transition guards.
- `control-plane/runtime/retry-policy.ts`: Deterministic retry eligibility and tick-delay policy.
- `control-plane/runtime/timeout-policy.ts`: Timeout classification for node/adapter/workflow with deterministic evaluation.
- `control-plane/runtime/retry-scheduler.ts`: Stable retry queue ordering and dependency gating.
- `control-plane/runtime/recovery-engine.ts`: Journal-first state reconstruction, recovery plan derivation, retry and cancel decisions.
- `control-plane/runtime/safety-limits.ts`: Runtime guardrails and structured violation reporting.

## Retry Policy
- Retryable failures include: `ADAPTER_EXECUTION_FAILED`, `TOOL_TIMEOUT`, `TASK_RESULT_INVALID`, `NODE_TIMEOUT`, `ADAPTER_TIMEOUT`, `WORKFLOW_TIMEOUT`.
- Deterministic schedule:
  - retry 1: delay 0 ticks
  - retry 2: delay 1 tick
  - retry 3: delay 2 ticks
- No jitter, randomness, or wall-clock backoff.

## Timeout Policy
- Distinct timeout classes:
  - `NODE_TIMEOUT`
  - `ADAPTER_TIMEOUT`
  - `WORKFLOW_TIMEOUT`
- Timeout policy is validated and evaluated with deterministic elapsed counters.

## Failure State Model
- Node states: `pending`, `ready`, `running`, `completed`, `failed`, `timeout`, `retrying`, `skipped`.
- Workflow states: `created`, `running`, `completed`, `failed`, `cancelled`, `timeout`, `recovering`.
- Invalid transitions return stable deterministic errors.

## Safety Limits
Default runtime limits:
- `maxNodesPerWorkflow=50`
- `maxWorkflowRuntimeSeconds=3600`
- `maxRetriesPerNode=3`
- `maxTotalRetriesPerWorkflow=25`
- `maxContextSize=100000`

## Journal-First Event Model
Runtime hardening extends the existing append-only journal event stream with:
- `NODE_RETRY_SCHEDULED`
- `NODE_RETRY_STARTED`
- `NODE_RETRY_EXHAUSTED`
- `NODE_TIMEOUT`
- `ADAPTER_TIMEOUT`
- `WORKFLOW_TIMEOUT`
- `WORKFLOW_RECOVERY_STARTED`
- `WORKFLOW_RECOVERY_RESUMED`
- `WORKFLOW_CANCELLED`
- `SAFETY_LIMIT_VIOLATION`

No event mutation/rewrite is introduced.

Execution and enforcement are now emitted through the same journal path used by existing projections (`run-record`, `node-record`, `trace-builder`). No side-channel event stream exists.

## Observability Integration
Run/node summaries and traces now project:
- timeout node counts
- retries consumed
- recoverable/resumed/cancelled status
- timeout/retry events in chronological trace order
- safety violation indicators

Retry/timeout/safety enforcement events are visible in:
- run summaries
- node inspection
- execution traces
- failure diagnostics

## Determinism Guarantees
- Stable sorting for all queue/event/ID selection operations.
- Sequence/tick-driven decisions.
- Canonical JSON output for CLI contracts.
- Recovery derived only from journal history.
- No random backoff and no timestamp-based retry scheduling.
- Resume skips completed nodes by journal reconstruction and re-enters hardened execution.
