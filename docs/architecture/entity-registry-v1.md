# Entity Registry v1

## What an Entity Is
An entity is a legal or operational boundary that owns rails (banking, Stripe, wallets, escrow), compliance posture, and custody mode. Entities are the control-plane unit for segregating regulated operations and preparing for spin-outs, acquisitions, or audited reporting.

## Why It Matters
We need a deterministic mapping from project boundaries to legal/operational entities. This enables:
- Segregated rails and custody modes by entity
- Clear compliance ownership
- Auditable separation as the platform grows

## Mapping Model
- Ownership detection already resolves `projectsTouched` from changed paths.
- Entity Registry v1 provides a deterministic mapping: `projectId -> entityId`.
- Each project belongs to exactly one entity.

The registry is stored in `control-plane/entities/registry.json` and validated at load time.

## Sprint 20 Behavior (Observability Only)
Sprint 20 adds entity telemetry to the governance JSON report without enforcement:
- `entitiesTouched`
- `entityOwnershipStatus`
- `unmappedProjects`
- `entityByProject`

This is report-only. No PRs are blocked for multi-entity or unmapped projects in Sprint 20.

## Sprint 21 Preview (Enforcement)
Sprint 21 will enforce:
- PRs must be scoped to a single entity.
- All touched projects must be mapped to an entity.
- Rail binding will be validated per entity.

## Determinism Requirements
- Entities are sorted by `entityId` in `registry.json`.
- Each entity's `projects` array is sorted lexicographically.
- Duplicate `entityId` or duplicate project membership across entities is rejected.
- Unknown project IDs are rejected.
