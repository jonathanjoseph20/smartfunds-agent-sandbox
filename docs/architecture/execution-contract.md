# Mission Execution Contract Layer (Sprint 5.1)

## Purpose

Sprint 5.1 introduces the deterministic execution contract boundary between activation and future runtime envelope/runtime engine layers.

Flow in this sprint:

mission
-> compatibility set
-> assignment decision
-> activation decision
-> execution contract evaluation
-> execution contract projection/materialization (descriptive)

This sprint does not execute missions, invoke teams, schedule work, enqueue jobs, dispatch tasks, or call external runtime systems.

## Separation of Concerns

- Assignment decides who should perform mission work.
- Activation decides whether assignment is ready for execution handoff.
- Execution contract defines the formal runtime-facing handoff object.

Execution contract evaluation is projection-only and does not mutate mission, assignment, or activation truth.

## Domain Model

`MissionExecutionContract` includes:

- `executionContractId`
- `missionId`
- `assignmentDecisionId`
- `activationDecisionId`
- `selectedTeamId`
- `executionPolicyId`
- `contractState`
- `executionEligibilityState`
- `executionTarget`
- `missionType`
- `missionSummary`
- `deliverableScope`
- `authorizedActions`
- `prohibitedActions`
- `dependencySummary`
- `remainingBlockers`
- `limitations`
- `runtimeEnvelopeStub`
- `createdFrom`
- `historyDigest`

`ExecutionContractPreconditionResult` includes:

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

`executionContractId` is derived only from semantic payload:

- `missionId`
- `assignmentDecisionId`
- `activationDecisionId`
- normalized precondition results
- `executionPolicyId`
- `executionTarget`
- normalized deliverable scope

Excluded from semantic identity:

- timestamps
- artifact paths
- CLI metadata
- filesystem ordering
- markdown materialization output

Repeated evaluation with identical inputs must produce identical `executionContractId`.

## Policy Model

Policy schema (`execution-contract-policy-types.ts`):

- `executionPolicyId`
- `displayName`
- `description`
- `requiresReadyActivationDecision`
- `requiresConfirmedAssignmentDecision`
- `requiresSelectedTeamAvailable`
- `requiresSelectedTeamReady`
- `requiresExplicitExecutionTarget`
- `requiresFounderRuntimeApproval`
- `enabled`

Seeded policies:

- `strict-runtime-handoff-default` (default)
- `manual-runtime-handoff-only`
- `operator-reviewed-contract`

## Preconditions

Execution contract evaluation computes:

- `mission_exists`
- `assignment_exists`
- `assignment_confirmed`
- `activation_exists`
- `activation_ready`
- `team_ready`
- `team_available`
- `execution_target`
- `runtime_governance`

Precondition states:

- `satisfied`
- `waiting`
- `blocked`
- `incomplete`
- `inconclusive`

## Status Semantics

`contractState` and `executionEligibilityState` are separate.

`executionEligibilityState`:

- `eligible`
- `waiting_on_runtime_preparation`
- `blocked`
- `incomplete`
- `inconclusive`

`contractState`:

- `evaluated`
- `under_review`
- `ready_for_runtime_handoff`
- `blocked`
- `rejected`

## Execution Target and Runtime Envelope Stub

Execution target categories are descriptive in this sprint:

- `team_runtime`
- `swarm_runtime`
- `manual_operator`
- `external_runtime`
- `unassigned_target`

`runtimeEnvelopeStub` is intentionally non-executable and all capability flags are false:

- `executionAttemptSupported: false`
- `taskGraphSupported: false`
- `retryPolicySupported: false`
- `resourceBindingSupported: false`

## History and Artifacts

Append-only execution contract events:

- `execution_contract_evaluated`
- `execution_contract_ready`
- `execution_contract_blocked`
- `execution_contract_confirmed`
- `execution_contract_rejected`
- `execution_contract_materialized`

Artifacts:

- `artifacts/execution-contract/<executionContractId>/execution-contract-status.json`
- `artifacts/execution-contract/<executionContractId>/execution-contract-report.json`
- `artifacts/execution-contract/<executionContractId>/execution-contract-report.md`
- `artifacts/execution-contract/<executionContractId>/execution-contract-history.json`
- `artifacts/execution-contract/<executionContractId>/execution-contract-preconditions.json`
- `artifacts/execution-contract/<executionContractId>/execution-runtime-envelope.json`

Artifacts are projections, not system truth.

## Sprint 5.1 Non-Goals

- runtime invocation
- team execution
- task dispatch
- scheduling/queueing
- retries/concurrency semantics
- swarm runtime orchestration
- external API calls
