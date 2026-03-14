# Product Factory Release Closeout and Acceptance (PF-9)

## Purpose

PF-9 introduces deterministic release acceptance above completed Product Factory layers.

Flow after PF-9:

ProductSpec
-> EngineeringPlan
-> ImplementationTaskGraph
-> CodexExecutionPackets
-> RepositoryScaffoldBundles
-> BuildExecutionRuns
-> BuildEvidenceBundles
-> Commerce / Rails
-> ProductFactoryReleaseAcceptance

PF-9 is additive only. It does not change lower-layer semantics.

## Deterministic Identity

All semantic identities use:

`canonicalStringify(payload) -> sha256`

Identity payloads exclude nondeterministic runtime metadata.

## Release Acceptance Record

`ProductFactoryReleaseAcceptanceRecord` anchors release closeout.

Fields:

- `productFactoryReleaseAcceptanceRecordId`
- `releaseTrack`
- `coveredLayerIds`
- `lifecycleAcceptanceId`
- `replayValidationId`
- `docsCompletenessId`
- `releaseHardeningId`
- `status`
- `outcome`

## Lifecycle Acceptance

Evaluates Product Factory completeness posture:

- `lifecycle_complete`
- `lifecycle_partially_complete`
- `lifecycle_blocked`
- `lifecycle_failed`
- `lifecycle_inconclusive`

## Replay Validation

Evaluates deterministic replay/reference consistency:

- `replay_validated`
- `replay_partially_validated`
- `replay_blocked`
- `replay_failed`
- `replay_inconclusive`

## Docs Completeness

Docs/runbook completeness is evaluated against deterministic required documents:

- `docs/architecture/product-factory-release-closeout-and-acceptance.md`
- `docs/runbooks/product-factory-release-closeout-operations.md`

Classes:

- `docs_complete`
- `docs_partially_complete`
- `docs_missing`
- `docs_blocked`
- `docs_inconclusive`

PF-9 uses explicit document presence input only. It does not perform nondeterministic filesystem scans.

## Release Hardening

Hardening posture summarizes lifecycle, replay, docs, and commerce closeout readiness:

- `hardened`
- `partially_hardened`
- `blocked`
- `failed`
- `inconclusive`

## Status and Outcome

Status:

- `draft`
- `validating`
- `acceptance_ready`
- `blocked`
- `failed`
- `closed`
- `inconclusive`

Outcome:

- `not_ready`
- `partially_ready`
- `acceptance_ready`
- `blocked`
- `failed`
- `closed`
- `inconclusive`

## Append-Only Release History

Events are append-only, deterministically ordered, replay-safe, and deduplicated by semantic identity.

Event types:

- `product_factory_release_acceptance_record_created`
- `product_factory_lifecycle_acceptance_recorded`
- `product_factory_replay_validation_recorded`
- `product_factory_docs_completeness_recorded`
- `product_factory_release_hardening_recorded`
- `product_factory_release_materialized`
- `product_factory_release_failed`
- `product_factory_release_closed`

## Projection-First Truth

Release acceptance truth is derived by projection from:

- ProductSpec projection
- EngineeringPlan projection
- TaskGraph projection
- CodexExecutionPacket projection
- RepositoryScaffold projection
- BuildExecution projection
- BuildEvidence projection
- Commerce projection
- Release history

Materialized files are persistence outputs only, not source of truth.
