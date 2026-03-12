# Team Compatibility Bridge Layer (Sprint 4.2)

## Purpose

Sprint 4.2 introduces a deterministic bridge between mission instances and persistent team definitions.

Flow in this sprint:

approved mission
-> compatibility evaluation
-> candidate team set
-> inspectable readiness surface

This sprint does not implement routing, assignment, activation, invocation, or execution.

## Boundary

The `MissionTeamCompatibilitySet` answers:

- Which teams are structurally compatible for a mission?
- Which candidates are assignment-ready vs blocked/manual/incomplete?
- Why each candidate was included, limited, or excluded?

Compatibility output is advisory and pre-assignment only.

## Deterministic Model

Each candidate entry includes:

- `teamId`
- `compatibilityClass`
- `assignmentReadiness`
- `matchReasons`
- `blockingReasons`
- `limitations`
- `supportedMissionType`
- `supportedTemplateMatch`
- `domainOverlap`
- `capabilityOverlap`
- `availabilityState`
- `teamReadinessState`
- `teamLifecycleState`

`compatibilitySetId` is deterministic:

- canonical identity payload
- `canonicalStringify(...)`
- `sha256(...)`

No timestamps, no randomness, no filesystem ordering are used in identity.

## Rationale Tokens

The layer emits stable explainability tokens, including:

- `supported_mission_type:<missionType>`
- `supported_template:<templateId>`
- `domain_overlap:<tag>`
- `capability_overlap:<tag>`
- `availability_manual_only`
- `availability_restricted`
- `team_readiness_partial`
- `team_lifecycle_dormant`
- `unsupported_mission_type`
- `unsupported_template`

## Readiness Interpretation

Candidate readiness is derived deterministically from:

- compatibility class
- lifecycle gating
- availability gating
- team readiness gating
- metadata completeness

Set-level state is derived from candidate readiness and compatibility distribution:

- `ready`
- `partial`
- `blocked`
- `unsupported`
- `inconclusive`

## History and Projection

The layer includes an append-only compatibility history store with event families:

- `compatibility_evaluated`
- `candidate_added`
- `candidate_removed`
- `candidate_state_changed`
- `compatibility_materialized`

Projection is the inspectable truth surface for CLI and artifacts.

## Materialization

Artifacts are projection-derived and written under:

- `artifacts/team-compatibility/<compatibilitySetId>/`

Files:

- `compatibility-status.json`
- `compatibility-report.json`
- `compatibility-report.md`
- `compatibility-history.json`

## Sprint 4.2 Limitations

Explicitly out of scope:

- assignment writes
- routing winner selection
- mission activation
- scheduling
- team invocation
- runtime execution semantics
- execution authorization
