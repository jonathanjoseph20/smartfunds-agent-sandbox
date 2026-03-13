# Venture Registry

## Purpose

Venture Registry is the first deterministic Venture object layer in the control plane.

Sprint 9.1 introduces venture definition, validation, status derivation, append-only history replay, projection, inspection, and artifact materialization.

## Scope Boundary

Sprint 9.1 is structural and descriptive only.

Not supported in this sprint:

- startup factory generation
- product spec generation
- repo or infrastructure provisioning
- payment rails and treasury behavior
- capital formation or token issuance
- external API surfaces
- dashboards or UI
- autonomous execution logic

## Deterministic Identity Model

`ventureId` is derived from canonicalized semantic identity payload only:

- `ventureSlug`
- `ventureClass`
- `ownershipModel`
- `originMissionIds`
- `domainTags`
- `productTypeTags`
- `linkedEntityIds`

Identity generation uses control-plane determinism utilities:

- `canonicalStringify(payload)`
- `sha256(payloadString)`

Excluded from identity:

- `ventureName`
- `summary`
- artifact paths
- CLI arguments
- materialized outputs
- timestamps/random/environment metadata

## Lifecycle vs Status

Lifecycle is structural posture:

`defined | incubating | ready_for_launch | operating | paused | stabilizing | spinning_out | archived`

Status is evaluation posture:

`active | blocked | incomplete | degraded | manual_review_required | inconclusive`

Validation never mutates lifecycle.

## Validation Model

Validator produces findings and outcome:

` satisfied | incomplete | blocked | inconclusive `

Validation checks include:

- required fields and enum constraints
- slug normalization and format
- duplicate tag normalization
- ownership contradictions
- class/operatingMode combinations
- mission/team/entity reference integrity
- provenance completeness

## Projection Rule

Projection is semantic truth.

Projection combines:

- registry definition
- validation result
- derived status
- history replay

Artifacts are persisted projections only.

## History Model

Venture history is append-only and replay-safe.

- deterministic event ordering (`sequence` then dedupe key)
- deterministic event dedupe keys from semantic event payload hashes
- deterministic event IDs derived from event dedupe keys

## CLI Surface

- `ventures:list`
- `ventures:inspect -- --venture <ventureId>`
- `ventures:status -- --venture <ventureId>`
- `ventures:history -- --venture <ventureId>`
- `ventures:materialize -- --venture <ventureId>`

All CLI outputs are canonical JSON and stable errors:

- `VENTURE_NOT_FOUND`
- `INVALID_VENTURE_DEFINITION`
- `MISSING_ARGUMENT`
- `VENTURE_REGISTRY_EMPTY`

## Artifacts

Materialization path:

`artifacts/ventures/<ventureId>/`

Outputs:

- `venture-status.json`
- `venture-report.json`
- `venture-report.md`
- `venture-history.json`
- `venture-links.json`
- `venture-summary.json`
