# Investigation Continuity Framework

## Scope

Sprint 2.9 adds deterministic investigation revision history and continuity evaluation.

This layer is:
- revision/history oriented
- append-only
- single-investigation scoped
- CLI inspectable

This layer is not:
- orchestration
- swarms
- cross-investigation coordination
- dashboarding
- narrative/LLM comparison

## Layer Position

runtime
-> scheduler
-> persistent research runtime
-> signal bus
-> trigger layer
-> investigation layer
-> investigation continuity + revision framework

The framework is additive and passively integrated after existing investigation report/evidence/confidence outputs.

## Artifact Layout

Per investigation:

`artifacts/investigations/<investigationRunId>/revisions/`

Each revision directory:

- `revision-summary.json`
- `revision-summary.md`
- `findings-snapshot.json`
- `confidence-snapshot.json`
- `delta.json`
- `continuity-summary.json`

Revision ids are monotonic and deterministic:
- `revision-0001`
- `revision-0002`
- `revision-0003`

Prior revisions are never overwritten.

## Revision Model

Each revision persists a first-class `InvestigationRevisionRecord` with:
- revision identity
- investigation run identity
- revision number
- report reference path
- findings snapshot path
- confidence snapshot path
- delta path
- continuity summary path

Snapshots are canonical JSON and stably ordered.

## Delta Model

`delta.json` compares current revision vs prior revision using only structured deterministic keys:
- `findingId`
- `confidenceBand`
- `supportCount`
- `counterEvidenceCount`
- `unresolvedGapCount`

Supported change types:
- `added`
- `removed`
- `confidence_increased`
- `confidence_decreased`
- `support_strengthened`
- `counter_evidence_added`
- `gap_resolved`
- `gap_added`
- `unchanged`

No fuzzy matching is used.

## Confidence Trend

Confidence trend is computed over ordered confidence snapshots by revision number:
- `improving`
- `degrading`
- `flat`
- `mixed`

No timestamp ordering is used.

## Continuity States

Continuity summary outputs:
- `stable`
- `evolving`
- `inconclusive`
- `materially_changed`

Heuristics:
- `inconclusive`: fewer than 2 revisions
- `materially_changed`: any added/removed/confidence band change/counter evidence added/gap added/gap resolved
- `evolving`: non-material deterministic change exists
- `stable`: all deltas are `unchanged`

## Backward Compatibility

Existing investigation lifecycle, scheduler semantics, reporting, and evidence/confidence behavior remain unchanged.

Revision tracking augments existing artifacts and inspection surfaces.

## Forward Fit

This framework establishes deterministic continuity primitives required for future higher-level synthesis without implementing cross-investigation synthesis in this sprint.
