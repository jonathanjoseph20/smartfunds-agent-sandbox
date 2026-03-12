# Mission Execution Engine (Sprint 5.5)

## Scope

Mission Execution Engine is the bounded, deterministic runtime lifecycle layer for a `MissionExecutionAttempt`.

Pipeline position:

- runtime envelope
- execution attempt
- execution journal
- mission execution engine run

This layer does not orchestrate work, dispatch agents, call external systems, or schedule runtime tasks.

## Boundary

Mission Execution Engine is implemented under:

- `control-plane/execution-engine/*`

It consumes existing projections:

- execution attempt
- execution journal
- runtime envelope
- execution contract

It appends runtime lifecycle events through existing execution journal history storage only.

## Deterministic Identity

`executionEngineRunId` is derived from semantic execution identity only:

- `executionAttemptId`
- `executionJournalId`
- `runtimeEnvelopeId`
- `executionContractId`
- `enginePolicyId`
- `runMode`
- `normalizedRunInputs`

Algorithm:

- `sha256(canonicalStringify(identityPayload))`

Excluded from identity and dedupe:

- timestamps
- CLI metadata
- process metadata
- filesystem paths
- random values

## Policy Model

Seeded policies:

- `simulation-only-default`
- `manual-engine-gated`
- `bounded-local-execution`

Default policy:

- `simulation-only-default`

Each policy controls:

- readiness preconditions
- simulation-only vs bounded local execution allowance
- founder confirmation gating
- enabled/disabled behavior

## Lifecycle and Eligibility

Lifecycle state (`engineState`) is separate from eligibility state (`engineEligibilityState`).

Lifecycle states:

- `initialized`
- `eligible_to_start`
- `started`
- `running`
- `completed`
- `failed`
- `cancelled`
- `archived`

Eligibility states:

- `eligible`
- `waiting_on_support`
- `blocked`
- `incomplete`
- `inconclusive`

Runner transition matrix:

- `initialized -> eligible_to_start`
- `eligible_to_start -> started`
- `started -> running`
- `running -> completed | failed | cancelled`

Invalid transitions fail deterministically.

## Journal Integration

The engine does not create a parallel event stream.

Runtime lifecycle events are appended via existing execution-journal history store using these event types:

- `execution_started`
- `execution_completed`
- `execution_failed`
- `execution_cancelled`

`execution_progressed` remains reserved and is not required for this sprint.

## Append-only Engine History

Engine history events:

- `engine_run_initialized`
- `engine_run_eligible`
- `engine_run_started`
- `engine_run_completed`
- `engine_run_failed`
- `engine_run_cancelled`
- `engine_run_materialized`

History guarantees:

- append-only
- semantic dedupe
- deterministic ordering

## Projection-first Truth

Truth flow:

- evaluator derives run identity and readiness from upstream projections + history
- projection composes run + status + journal linkage + output summary + history summary
- materializer persists projection artifacts only

No upstream semantic state is mutated.

## Artifacts

Materialization path:

- `artifacts/execution-engine/<executionEngineRunId>/`

Files:

- `execution-engine-status.json`
- `execution-engine-report.json`
- `execution-engine-report.md`
- `execution-engine-history.json`
- `execution-engine-outputs.json`

All artifact files are deterministic projection outputs.
