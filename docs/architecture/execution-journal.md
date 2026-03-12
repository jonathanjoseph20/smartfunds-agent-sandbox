# Mission Execution Journal (Sprint 5.4)

## Scope

Mission Execution Journal is the bounded, deterministic, append-only event layer for a `MissionExecutionAttempt`.

Pipeline position:

- runtime envelope
- execution attempt
- mission execution journal
- execution engine (future)

This layer does not execute mission work. It records pre-execution attempt lifecycle events and materializes observability artifacts.

## Boundary

Mission Execution Journal is implemented under:

- `control-plane/execution-journal/*`

It is intentionally decoupled from legacy runtime-run journaling under:

- `control-plane/execution/journal.ts`

## Deterministic Identity

`executionJournalId` is derived from semantic attempt identity only:

- `executionAttemptId`
- `runtimeEnvelopeId`
- `executionContractId`
- `missionId`

Algorithm:

- `sha256(canonicalStringify(identityPayload))`

Excluded from identity and dedupe:

- timestamps
- filesystem paths
- CLI invocation metadata
- markdown artifact content
- random values
- process/runtime ambient noise

## Event Model

Mission Execution Journal event fields:

- `eventType`
- `eventDedupeKey`
- `executionJournalId`
- `executionAttemptId`
- `eventIndex`
- `eventPayload`
- `reasonTokens`
- `blockingReasons`
- `limitations`

### Live event types (Sprint 5.4)

- `attempt_created`
- `attempt_prepared`
- `attempt_ready_for_execution`
- `attempt_cancelled`
- `journal_materialized`

### Reserved future event types (defined, inactive)

- `execution_started`
- `execution_progressed`
- `execution_completed`
- `execution_failed`
- `execution_retried`

Reserved events are schema-valid but never auto-emitted in Sprint 5.4.

## Append-only History Guarantees

History store guarantees:

- append-only writes
- semantic dedupe using `eventDedupeKey`
- deterministic `eventIndex` assignment
- stable read ordering by `eventIndex` with lexical fallback

Semantic dedupe key:

- `sha256(canonicalStringify({ executionAttemptId, eventType, normalizedEventPayload }))`

## Projection-first Truth

Truth computation:

- execution attempt projection computes attempt truth
- journal projection composes attempt truth + journal history + derived status

Materialization:

- persists projection output only
- never mutates attempt truth
- never invents semantic state

## Journal State Derivation

Journal states:

- `initialized`
- `collecting`
- `ready_for_runtime_events`
- `blocked`
- `archived`

State is derived from attempt truth and journal events, including blockers and limitations.

## Artifact Outputs

Materialization path:

- `artifacts/execution-journal/<executionJournalId>/`

Files:

- `execution-journal-status.json`
- `execution-journal-report.json`
- `execution-journal-report.md`
- `execution-journal-history.json`
- `execution-journal-events.json`

All files are deterministic projection outputs.

## Sprint 5.4 Limitations

- no execution engine integration
- no runtime event producers
- no task dispatch or retries
- no scheduling or live runtime orchestration
- no external API/agent runtime execution behavior
