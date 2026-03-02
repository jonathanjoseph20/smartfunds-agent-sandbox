# Cockpit Determinism Boundary

Cockpit objects are product metadata for venture studio operations.

## Determinism guaranteed in this sprint

- Canonical ordering of run data is sequence-based only:
  - `Run.runIndex`
  - `RunAttempt.attemptIndex`
  - `RunEvent.eventSeq`
- Ordering queries explicitly use these integer sequence columns.
- Validation errors are stable JSON payloads (`{ "error": "..." }`) without stack traces.

## Determinism not expanded by this sprint

- This sprint does not alter governance/finance deterministic artifact contracts.
- Canonical payload hashing and deterministic governance artifacts remain in existing governance/finance layers.
- No new event-sourcing framework or workflow engine is introduced.
