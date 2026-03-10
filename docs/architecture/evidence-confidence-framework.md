# Evidence And Confidence Framework

## Scope

Sprint 2.8 introduces a deterministic, investigation-scoped evidence and confidence layer.

This layer is:
- deterministic
- explainable
- append/merge based
- CLI inspectable
- backward-compatible with existing investigation lifecycle semantics

This layer is not:
- orchestration
- swarm coordination
- model-based scoring

## Evidence Records

Evidence is a first-class durable artifact persisted at:

`artifacts/investigations/<investigationRunId>/evidence/evidence.json`

Each record includes:
- deterministic `evidenceId`
- `investigationRunId`
- `phaseId`
- `evidenceType`
- optional source references (`sourceArtifactPath`, `sourceDatasetKey`)
- normalized `summary`
- structured `payload`
- linked `findingIds`

## Evidence Taxonomy

Supported evidence types:
- `raw_observation`
- `derived_metric`
- `cross_cycle_confirmation`
- `contextual_support`
- `counter_evidence`
- `unresolved_gap`

## Evidence Accumulation

Evidence flow:
1. phase executes
2. artifacts are produced
3. evidence is extracted and normalized
4. evidence is merged into `evidence/evidence.json`
5. confidence projection is recomputed

Merging is deterministic and idempotent:
- existing evidence is loaded
- merged by `evidenceId`
- canonical serialization is written
- output ordering is stable: `evidenceType`, `phaseId`, `evidenceId`

## Deterministic Identity

Evidence IDs use `canonicalStringify` + `sha256` with stable inputs:
- investigation run id
- phase id
- evidence type
- source references
- summary
- payload hash

No randomness, UUIDs, or timestamp-derived identity is used.

## Confidence Model

Confidence is rule-based and inspectable.

Positive factors:
- supporting evidence count
- supporting evidence type diversity
- cross-cycle confirmation presence

Negative factors:
- counter-evidence count
- unresolved gap count

Outputs:
- `confidenceBand` (`low` | `medium` | `high`)
- `confidenceScore`
- `confidenceReason`
- `strengths[]`
- `limitations[]`

The report-level confidence summary and finding-level confidence are derived from persisted evidence.

## Findings Linkage

Existing finding strings remain valid. Evidence-backed findings are additive and include:
- `supportingEvidenceIds`
- `counterEvidenceIds`
- `unresolvedGapIds`
- confidence fields

## Inspection Surfaces

CLI inspection surfaces:
- `investigations:evidence`
- `investigations:confidence`
- `investigations:findings`

These surfaces project from persisted investigation state and evidence artifacts.
