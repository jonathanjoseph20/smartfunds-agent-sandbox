# Mission Proposals

## Purpose

Mission Proposals introduce a bounded suggestion layer between intelligence signals and mission creation.

This layer exists so agents and system logic can suggest work without creating or executing work autonomously.

## Proposal vs Mission

A `MissionProposal` is not a `MissionInstance`.

- proposals are suggestive, review-gated, and pre-creation
- missions are concrete bounded work objects

A proposal may become a mission only through explicit approval and deterministic conversion.

## Lifecycle

Proposal status families:

- proposal: `draft | submitted | under_review | approved | rejected | withdrawn | archived`
- approval: `pending_review | approved | rejected | not_required`
- conversion: `not_converted | mission_created | mission_linked_existing | conversion_blocked | conversion_inconclusive`

Proposal lifecycle remains distinct from mission lifecycle.

## Deterministic Identity

`proposalId` is derived from canonical identity payload fields only:

- `proposalType`
- `objective`
- `summary`
- `rationale`
- `proposedMissionType`
- `proposedTemplateId`
- normalized `proposedParameters`
- normalized `requestedDeliverables`
- normalized `sourceReferences`
- normalized `linkedMissionIds`
- normalized `linkedDagIds`
- normalized `linkedActionPlanIds`
- `createdBy.kind`
- `createdFrom.kind`

Excluded from identity:

- timestamps
- artifact paths
- approval outcomes
- proposal state
- history entries
- materialization outputs

Approval or rejection never changes `proposalId`.

## Approval and Conversion

Conversion requires approval unless `approvalState = not_required`.

Two deterministic conversion paths are supported:

1. Template conversion
- Uses `proposedTemplateId + proposedParameters`
- Reuses mission template utilities
- Derives deterministic mission identity

2. Explicit mission conversion
- Uses `proposedMissionType + objective + requestedDeliverables`
- Derives deterministic mission identity

If the mission identity already exists, conversion links the existing mission instead of creating a duplicate.

Conversion stops at mission create/link only.

Not included:

- execution
- team activation
- scheduling
- runtime hooks
- DAG mutation

## History and Artifacts

Proposal history is append-only with deterministic dedupe keys.

Artifacts are projection-only outputs under `artifacts/mission-proposals/<proposalId>/`:

- `proposal-status.json`
- `proposal-report.json`
- `proposal-report.md`
- `proposal-history.json`
- `proposal-conversion.json` (when conversion data exists)

Artifacts are never source of truth.

## System Philosophy

This layer preserves governance boundaries:

- agents may suggest
- founders decide
- execution comes later
