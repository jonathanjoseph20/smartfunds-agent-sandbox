# Mission Coordination And Lifecycle Management

## Purpose
Sprint 7.2 adds a deterministic mission coordination layer above mission control. It provides lifecycle coordination, operator intervention semantics, dependency blocking visibility, priority signals, and append-only coordination history.

This layer is projection-first:
- Mission control projections remain authoritative for runtime execution truth.
- Coordination projections derive lifecycle coordination truth from mission-control projection plus append-only coordination history.
- Materialization only persists derived projection output.

## Deterministic Identity
All coordination semantic identities are deterministic:
1. Build canonical payload via `canonicalStringify(payload)`.
2. Hash payload via `sha256`.
3. Use hash as semantic identity.

No timestamps, randomness, process metadata, or environment-dependent fields are included in semantic identities.

Implemented deterministic IDs:
- `missionLifecycleTransitionId`
- `missionInterventionId`
- `missionRelationshipId`
- `priorityUpdateId`
- `eventDedupeKey`

## Lifecycle Model
Lifecycle states:
- `created`
- `ready`
- `active`
- `paused`
- `resuming`
- `blocked`
- `cancelled`
- `completed`
- `failed`
- `archived`

Valid transitions:
- `created -> ready`
- `ready -> active`
- `active -> paused`
- `paused -> resuming`
- `resuming -> active`
- `active -> blocked`
- `blocked -> active`
- `active -> completed`
- `active -> failed`
- `active -> cancelled`
- `paused -> cancelled`

Invalid transitions return stable payload:
```json
{
  "error": "invalid_lifecycle_transition",
  "fromState": "...",
  "toState": "...",
  "missionRunId": "..."
}
```

## Intervention Model
Interventions are append-only records and do not mutate runtime execution state.

Fields:
- `missionInterventionId`
- `missionRunId`
- `interventionType`
- `requestedBy`
- `reasonTokens`
- `targetLifecycleState`
- `linkedEscalationIds`
- `state`

Types:
- `pause`
- `resume`
- `cancel`
- `reprioritize`
- `acknowledge_escalation`
- `defer`
- `force_review`

## Dependency Model
Coordination dependencies are structural mission relationships.

Fields:
- `missionRelationshipId`
- `sourceMissionRunId`
- `targetMissionRunId`
- `relationshipType`
- `blockingReasonTokens`
- `state`

Relationship types:
- `depends_on`
- `blocks`
- `follows`
- `requires_review_from`
- `related_to`

States:
- `active`
- `unblocked`

## Priority Model
Priority levels:
- `critical`
- `high`
- `normal`
- `low`
- `deferred`

Priority affects only coordination reporting/projection surfaces. It does not change worker scheduling or runtime execution semantics.

## Coordination History Store
History is append-only and deduped by semantic identity.

Event types:
- `mission_lifecycle_transitioned`
- `mission_intervention_recorded`
- `mission_priority_updated`
- `mission_dependency_linked`
- `mission_dependency_unblocked`
- `mission_paused`
- `mission_resumed`
- `mission_cancelled`
- `mission_coordination_blocked`
- `mission_coordination_unblocked`

Ordering is deterministic (`eventDedupeKey` sorted). Replay is deterministic.

## Coordination Projection
Projection derives:
- `lifecycleState`
- `coordinationState`
- `priority`
- `activeInterventions`
- `dependencySummaries`
- `blockingMissionRunIds`
- `blockedByEscalations`
- `resumeEligibility`
- `lastLifecycleTransitionId`
- `lastInterventionId`

Coordination states:
- `awaiting_start`
- `active`
- `paused_by_operator`
- `blocked_by_dependency`
- `blocked_by_escalation`
- `cancelled_by_operator`
- `ready_to_resume`
- `completed`
- `failed`
- `inconclusive`

## Inspection Surface
Inspection API provides JSON-only, deterministic outputs:
- `inspectMissionLifecycle`
- `inspectMissionInterventions`
- `inspectMissionPriority`
- `inspectMissionDependencies`
- `inspectMissionBlocking`
- `inspectMissionCoordinationHistory`
- `inspectMissionCoordination`

## Materialization
Coordination artifacts are materialized under:
- `artifacts/mission-control/<missionRunId>/`

Files:
- `mission-coordination-status.json`
- `mission-lifecycle.json`
- `mission-interventions.json`
- `mission-dependencies.json`
- `mission-priority.json`
- `mission-coordination-history.json`
- `mission-coordination-report.md`

Materialization persists projection truth and never mutates runtime state.

## CLI Surface
Inspection commands:
- `mission-control:lifecycle`
- `mission-control:coordination`
- `mission-control:dependencies`
- `mission-control:priority`
- `mission-control:interventions`

Action commands:
- `mission-control:pause`
- `mission-control:resume`
- `mission-control:cancel`
- `mission-control:reprioritize`

History/materialization commands:
- `mission-control:coordination-history`
- `mission-control:materialize-coordination`

All commands:
- parse flags manually
- output JSON only
- preserve stable error payloads
- remain deterministic
