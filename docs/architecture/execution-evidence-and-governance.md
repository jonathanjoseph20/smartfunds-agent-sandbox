# Execution Evidence and Governance Layer (PF-7)

## Purpose

PF-7 introduces a deterministic governance layer above build execution runtime.

Flow after PF-7:

ProductSpec
-> EngineeringPlan
-> ImplementationTaskGraph
-> CodexExecutionPackets
-> RepositoryScaffoldBundles
-> BuildExecutionRuns
-> BuildEvidenceBundles

This layer does not change execution semantics. It derives governance truth from execution truth.

## Why Evidence Is Separate from Execution

- Build execution remains the source for runtime truth.
- Evidence projection computes trust posture from existing run, packet, and scaffold projections.
- Evidence materialization emits artifacts only; files are not semantic truth.
- Lower-layer identities and behaviors are preserved.

## Evidence Bundle Model

`BuildEvidenceBundle` captures deterministic identity and evidence context for one run.

Fields:

- `buildEvidenceBundleId`
- `runId`
- `packetId`
- `bundleId`
- `promptHash`
- `executionPlanHash`
- `artifactHashes`
- `verificationStatus`
- `outcome`

Identity is derived from normalized semantic payload via `canonicalStringify` + `sha256`.

Excluded from identity:

- timestamps
- temp paths
- process metadata
- environment metadata
- materialized artifact paths

## Verification Surfaces

PF-7 keeps three bounded verification surfaces separate:

- artifact verification
- prompt attestation
- execution plan attestation

### Artifact Verification

Classifies each artifact as:

- `artifact_hash_verified`
- `artifact_hash_mismatch`
- `artifact_missing`
- `artifact_unexpected`
- `artifact_inconclusive`

### Prompt Attestation

Classifies prompt integrity as:

- `prompt_verified`
- `prompt_mismatch`
- `prompt_missing`
- `prompt_inconclusive`

### Execution Plan Attestation

Classifies plan integrity as:

- `execution_plan_verified`
- `execution_plan_mismatch`
- `execution_plan_partial`
- `execution_plan_inconclusive`

## Governance Validation and Outcome

Governance posture is derived from the three bounded surfaces:

- `valid`
- `partially_valid`
- `blocked`
- `failed`
- `inconclusive`

Outcome is derived from governance posture:

- `verified`
- `partially_verified`
- `blocked`
- `failed`
- `inconclusive`

PF-7 prefers blocked/failed/inconclusive states over optimistic inference.

## Append-Only Evidence History

Evidence history events are append-only, deduped, deterministically ordered, and replay-safe.

Events:

- `build_evidence_bundle_created`
- `artifact_verification_recorded`
- `prompt_attestation_recorded`
- `execution_plan_attestation_recorded`
- `build_evidence_governance_validated`
- `build_evidence_materialized`
- `build_evidence_failed`

## Materialization

Evidence artifacts are materialized only under:

`artifacts/build-evidence/<buildEvidenceBundleId>/`

Files:

- `build-evidence-status.json`
- `build-evidence-artifact-verification.json`
- `build-evidence-prompt-attestation.json`
- `build-evidence-execution-plan-attestation.json`
- `build-evidence-history.json`
- `build-evidence-outcome.json`
- `build-evidence-report.json`
- `build-evidence-report.md`

## Scope Boundaries

PF-7 does not implement:

- build runtime rewrites
- packet/scaffold/task graph rewrites
- deployment automation
- publishing/commerce rails
- dashboards/notifications
- external integrations
