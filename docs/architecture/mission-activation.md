# Mission Activation Gate (Sprint 4.4)

## Purpose

Sprint 4.4 adds deterministic mission activation readiness evaluation as the final bounded control-plane layer before any future runtime execution layer.

Flow in this sprint:

mission
-> compatibility set
-> assignment decision
-> activation readiness evaluation
-> activation decision
-> execution handoff contract (descriptive)

This sprint does not execute missions, invoke teams, create runtime tasks, schedule work, enqueue jobs, or bind to runtime orchestrators.

## Separation of Concerns

- Assignment answers who should do work.
- Activation answers whether that assigned work is eligible to move into execution readiness.

Activation does not mutate mission truth, compatibility truth, assignment truth, team truth, or DAG truth.

## Domain Model

`MissionActivationDecision` includes:

- `activationDecisionId`
- `missionId`
- `assignmentDecisionId`
- `selectedTeamId`
- `activationPolicyId`
- `activationMode`
- `activationState`
- `executionReadinessState`
- `preconditionResults`
- `blockingReasons`
- `limitations`
- `activationReasonTokens`
- `handoffContract`
- `createdFrom`
- `historyDigest`

`ActivationPreconditionResult` includes:

- `preconditionId`
- `category`
- `state`
- `reasonTokens`
- `blockingReasons`
- `limitations`

## Determinism Model

Identity and digests use:

- `canonicalStringify(...)`
- `sha256(...)`

`activationDecisionId` is derived from semantic payload only:

- `missionId`
- `assignmentDecisionId`
- `activationPolicyId`
- normalized precondition results
- `activationMode`

Excluded from semantic identity:

- timestamps
- artifact paths
- CLI metadata
- filesystem ordering
- runtime metadata

## Policy Model

Policy schema (`mission-activation-policy-types.ts`):

- `activationPolicyId`
- `displayName`
- `description`
- `requiresConfirmedAssignment`
- `requiresMissionReady`
- `requiresDagDependenciesSatisfied`
- `requiresTeamReady`
- `requiresTeamAvailable`
- `requiresFounderActivationConfirmation`
- `enabled`

Seeded policies:

- `strict-founder-gated-activation` (default)
- `confirmed-assignment-default`
- `manual-gate-only`

## Preconditions

Activation evaluation computes:

- `mission_state`
- `mission_readiness`
- `dag_dependencies`
- `assignment_state`
- `assignment_confirmation`
- `team_lifecycle`
- `team_availability`
- `team_readiness`
- `activation_confirmation`

## Status Semantics

`activationState` and `executionReadinessState` are separate.

`executionReadinessState`:

- `ready`
- `waiting_on_dependencies`
- `waiting_on_confirmation`
- `blocked`
- `incomplete`
- `inconclusive`

`activationState`:

- `evaluated`
- `under_review`
- `ready_for_activation`
- `blocked`
- `rejected`

## Handoff Contract

`ExecutionHandoffContract` is descriptive only and includes:

- mission and assignment references
- selected team
- mission deliverable summary
- precondition satisfaction summary
- remaining blockers
- `runtimeInvocationSupported: false`

## History and Artifacts

Append-only events:

- `activation_evaluated`
- `activation_ready`
- `activation_blocked`
- `activation_confirmed`
- `activation_rejected`
- `activation_materialized`

Artifacts:

- `artifacts/mission-activation/<activationDecisionId>/activation-status.json`
- `artifacts/mission-activation/<activationDecisionId>/activation-report.json`
- `artifacts/mission-activation/<activationDecisionId>/activation-report.md`
- `artifacts/mission-activation/<activationDecisionId>/activation-history.json`
- `artifacts/mission-activation/<activationDecisionId>/activation-preconditions.json`
- `artifacts/mission-activation/<activationDecisionId>/activation-handoff.json`

Artifacts are projections, not truth.

## Sprint 4.4 Non-Goals

- runtime invocation
- mission execution start
- scheduling/queueing
- retries/timeouts
- external API calls
- LLM invocation
