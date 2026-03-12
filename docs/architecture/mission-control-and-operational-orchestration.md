# Mission Control And Operational Orchestration

## Purpose

Mission Control is a deterministic, read-only operational layer above runtime truth.

It provides a mission-run abstraction so operators can inspect mission posture without reconstructing state from low-level runtime artifacts.

## Position In The Stack

Mission Control consumes existing bounded projections and does not mutate runtime semantics:

- runtime envelope
- execution attempt
- execution engine
- task execution
- task orchestration

Mission Control does not alter:

- retry logic
- worker scheduling
- orchestration cycle behavior
- task execution transitions

## Mission Run Abstraction

A `missionRunId` is deterministic and derived from:

- `missionId`
- `executionAttemptId`
- `runtimeEnvelopeId`
- `executionContractId`

Derivation algorithm:

- `sha256(canonicalStringify(identityPayload))`

Excluded from identity:

- timestamps
- filesystem paths
- process metadata
- random values

## Projection Model

Mission Control projection composes:

- operational state
- completion state
- health state
- progress summary
- escalations
- blocking reasons
- worker load summary

Projection is the source of truth for Mission Control outputs.
Materialization is only persistence of projected truth.

## Progress Model

Progress derives from runtime task and orchestration projections, including:

- task counts by state
- completion percent
- critical path state
- remaining blocking nodes

Artifact presence is not used for progress truth.

## Completion vs Health

Completion answers outcome posture:

- not_started
- in_progress
- partially_complete
- blocked
- completed
- failed
- inconclusive

Health answers execution trust/stability posture:

- healthy
- degraded
- unstable
- blocked
- failed
- inconclusive

These are independent surfaces and are not collapsed into one field.

## Operational State

Operational state answers current mission posture:

- pending
- active
- retrying
- blocked
- degraded
- completed
- failed
- cancelled
- inconclusive

State is derived from runtime projection signals and explicit precedence rules.

## Escalation Model

Escalations are deterministic, append-only, and deduplicated by semantic keys.

Classes:

- retry_exhaustion
- terminal_node_failure
- orchestration_deadlock
- worker_capacity_exhausted
- worker_compatibility_gap
- policy_failure
- unresolved_blocking_chain

Escalation IDs are derived with `sha256(canonicalStringify(...))`.

## History Model

Mission Control history is append-only and replay-safe.

Event types:

- mission_run_created
- mission_execution_started
- mission_progress_updated
- mission_blocked
- mission_degraded
- mission_escalated
- mission_completed
- mission_failed
- mission_cancelled

History entries are deduplicated with semantic event keys and lexically ordered for deterministic replay.

## Materialization

Mission Control artifacts are written under:

- `artifacts/mission-control/<missionRunId>/`

Files:

- `mission-run-status.json`
- `mission-run-progress.json`
- `mission-run-report.json`
- `mission-run-report.md`
- `mission-run-history.json`
- `mission-run-escalations.json`
- `mission-run-health.json`

## CLI Surface

Mission Control is CLI-first and JSON-only:

- `mission-control:list`
- `mission-control:inspect`
- `mission-control:status`
- `mission-control:progress`
- `mission-control:health`
- `mission-control:completion`
- `mission-control:escalations`
- `mission-control:history`
- `mission-control:materialize`

All commands use manual argument parsing and stable error payloads:

- `{ "error": "message" }`
