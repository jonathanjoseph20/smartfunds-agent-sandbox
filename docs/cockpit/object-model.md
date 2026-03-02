# Cockpit Object Model v1

Sprint 53 introduces a product-layer cockpit object model under `control-plane/cockpit`.

## ID strategy

Cockpit object IDs are server-assigned and stable after persistence.

- Format: `<prefix>-<n>` (for example: `project-1`, `run-3`, `approval-2`).
- Allocation: per-prefix monotonic counters stored in SQLite table `cockpit_id_counters`.
- Determinism: IDs are monotonic for each prefix within a database file; no UUIDv4/random IDs are used.

## Core objects

- `Entity` is the namespace root.
- `Project` belongs to one `Entity` and can be archived.
- `Team` belongs to one `Project` (immutable project binding).
- `Role` belongs to one `Team` (immutable team binding).
- `Goal` belongs to one `Project` and one `Team` (both immutable, cross-project match required).
- `Run` belongs to one `Goal` and `Project` with `runIndex` monotonic per goal.
- `RunAttempt` belongs to one `Run` with `attemptIndex` monotonic per run.
- `RunEvent` is append-only and ordered by `(runId, attemptIndex, eventSeq)`.
- `ApprovalRequest` is tied to a specific run attempt; decisions are immutable.
- `PRArtifact` is tied to a specific run attempt and can be updated.
- `BillingProfile` is project-scoped with unique active `(projectId, label)` among non-archived rows.
- `RailBinding` belongs to one billing profile.

## Invariant boundaries

- Cross-project references are rejected on writes.
- Immutable foreign-key bindings are rejected on updates.
- Archived goals cannot start runs.
- Default list endpoints exclude archived records unless `includeArchived=true`.
- Run ordering is sequence-based (`runIndex`, `attemptIndex`, `eventSeq`), never timestamp-based.
