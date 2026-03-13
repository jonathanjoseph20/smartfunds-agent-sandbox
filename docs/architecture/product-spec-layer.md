# Product Spec Layer (PF-1)

## Purpose

The Product Spec layer is the deterministic bridge from mission outputs into a canonical product definition.

Flow segment:

signals -> investigations -> syntheses -> cohorts -> programs -> intelligence -> missions -> assignment -> mission execution -> runtime propagation -> product spec

PF-1 adds only the ProductSpec substrate. Engineering plans and implementation-task generation are intentionally out of scope.

## Core Model

A `ProductSpec` is a deterministic definition derived from mission context:

- `specId`
- `name`
- `problem`
- `targetUser`
- `solution`
- `architectureSummary?`
- `mvpScope`
- `constraints?`
- `dependencies?`
- `originMissionIds`
- `status`

`ProductSpec` state is advanced through append-only history events and projected views.

## Deterministic Identity

`specId` is derived from SHA-256 over canonical JSON of only:

- `name`
- `problem`
- `targetUser`
- `solution`
- `architectureSummary`
- `mvpScope`
- `constraints`
- `dependencies`
- `originMissionIds`

Excluded from identity:

- timestamps
- artifact paths
- CLI metadata
- environment variables
- filesystem paths
- status
- validation outputs
- history metadata

This enables replay-safe, deterministic identity.

## Projection-First Truth

Authoritative state is derived by projection from:

- spec definition
- validation result
- append-only history

Materialized artifacts are derived outputs for inspection and operational handoff, not the source of truth.

## History and Status

History events are append-only and deterministically deduped via stable event hashing.

Event types:

- `product_spec_created`
- `product_spec_updated`
- `product_spec_validated`
- `product_spec_status_changed`

Status derivation:

- missing required fields -> `incomplete`
- validation errors/constraint violations -> `blocked`
- valid but not promoted -> `draft`
- explicit validation advancement -> `validated`

## Relationship to Missions and Future Layers

In PF-1, ProductSpec captures product intent from mission context in a canonical deterministic form.

Future sprints consume ProductSpec as upstream input:

- PF-2 Engineering Plan Layer
- PF-3 Engineering Task Generator
- PF-4 Codex Prompt Generator
