# Mission Execution Journal Operations

## Scope

This runbook covers Sprint 5.4 Mission Execution Journal operations:

- list
- inspect
- status
- history
- evaluate
- materialize

All commands emit canonical JSON and stable error payloads:

- `{ "error": "message" }`

## Prerequisite

A mission must already have an execution attempt.

Typical upstream chain:

- `team-compatibility:evaluate`
- `mission-assignment:confirm`
- `mission-activation:evaluate`
- `execution-contract:evaluate`
- `runtime-envelope:confirm`
- `execution-attempt:create`

## List Journals

```bash
npm run execution-journal:list
```

Output includes:

- `executionJournalId`
- `executionAttemptId`
- `journalState`
- `eventCount`
- `latestEventType` (when present)

## Inspect Journal

```bash
npm run execution-journal:inspect -- --attempt <executionAttemptId>
```

Returns the full projected `MissionExecutionJournal` object.

## Journal Status

```bash
npm run execution-journal:status -- --attempt <executionAttemptId>
```

Use this to quickly evaluate:

- `journalState`
- blockers
- limitations
- readiness signals

## Journal History

```bash
npm run execution-journal:history -- --attempt <executionAttemptId>
```

Returns append-only event history for the derived journal identity.

## Evaluate Journal

```bash
npm run execution-journal:evaluate -- --attempt <executionAttemptId>
```

Evaluation appends deterministic pre-execution lifecycle events derived from attempt truth.

It does not execute mission work.

## Materialize Journal Artifacts

```bash
npm run execution-journal:materialize -- --attempt <executionAttemptId>
```

Artifacts are written to:

- `artifacts/execution-journal/<executionJournalId>/`

Files:

- `execution-journal-status.json`
- `execution-journal-report.json`
- `execution-journal-report.md`
- `execution-journal-history.json`
- `execution-journal-events.json`

## Diagnose Blocked Journals

If status is `blocked`, inspect:

1. execution attempt blockers in journal `provenanceInputs`
2. journal history `blockingReasons`
3. upstream runtime-envelope / execution-contract state

## Determinism Checks

For reproducibility:

1. run `execution-journal:evaluate` twice for the same attempt
2. run `execution-journal:materialize` twice
3. verify identical output payloads and artifact file contents

Expected:

- same `executionJournalId`
- stable event ordering
- no reserved runtime events auto-emitted
